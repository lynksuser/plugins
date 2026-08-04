import { logger } from "@vendetta";
import { findByProps, findByStoreName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";

import Settings from "./Settings";
import {
    diag,
    hiddenIds,
    isHidden,
    noteCall,
    noteResult,
    originals,
    refreshChannelList,
    rowDiag,
} from "./hidden";
import { channelStoreNames, findListSources, listFunctions } from "./debug";
import { patchDMRow } from "./dmrow";

let patches: (() => void)[] = [];

// Dedup on (module, functionName). Comparing function identity does NOT work:
// the first patch replaces mod[fnName], so a later candidate resolving to the
// same store sees the wrapper, compares unequal, and patches it a second time.
let patchedPairs: Array<[any, string]> = [];

const isPatched = (mod: any, fnName: string) =>
    patchedPairs.some(([m, f]) => m === mod && f === fnName);

/**
 * Filters hidden entries out of an array, handling both id-string arrays and
 * channel-object arrays. Anything else passes through untouched.
 */
function autoFilter(ret: unknown): unknown {
    if (!Array.isArray(ret) || ret.length === 0) return ret;

    const first = ret[0];
    if (typeof first === "string") return ret.filter((id) => !isHidden(id));
    if (first && typeof first === "object" && "id" in first) {
        return ret.filter((c: any) => !isHidden(c?.id));
    }
    return ret;
}

function tryPatch(label: string, mod: any, fnName: string) {
    if (typeof mod?.[fnName] !== "function") return;
    if (isPatched(mod, fnName)) return;
    patchedPairs.push([mod, fnName]);

    // Keep an unpatched handle for the settings page.
    originals[label] = mod[fnName].bind(mod);

    patches.push(
        after(fnName, mod, (_args, ret) => {
            noteCall(label);
            const out = autoFilter(ret);
            noteResult(label, ret, out);
            return out;
        })
    );
    diag.patched.push(label);
}

export default {
    onLoad() {
        // Known candidates first, so their labels stay stable and readable.
        tryPatch(
            "PrivateChannelSortStore.getPrivateChannelIds",
            findByStoreName("PrivateChannelSortStore"),
            "getPrivateChannelIds"
        );
        tryPatch(
            "SortedPrivateChannelStore.getPrivateChannelIds",
            findByStoreName("SortedPrivateChannelStore"),
            "getPrivateChannelIds"
        );
        tryPatch(
            "findByProps.getPrivateChannelIds",
            findByProps("getPrivateChannelIds"),
            "getPrivateChannelIds"
        );
        tryPatch(
            "ChannelStore.getSortedPrivateChannels",
            findByStoreName("ChannelStore"),
            "getSortedPrivateChannels"
        );

        // Then sweep every list-shaped function on every channel-ish store, so we
        // catch whichever one the DM list actually reads. `getMutablePrivateChannels`
        // is excluded: the settings page enumerates through it, and filtering it
        // would hide groups from their own toggle.
        for (const storeName of channelStoreNames()) {
            const store = findByStoreName(storeName);
            for (const fnName of listFunctions(store)) {
                if (/mutable/i.test(fnName)) continue;
                tryPatch(`${storeName}.${fnName}`, store, fnName);
            }
        }

        // The home drawer row, kept in case the experiment is enabled on some builds.
        patches.push(...patchDMRow());

        // Behavioural search: whatever store getter currently returns a list
        // containing a hidden id is, by definition, holding the channel we want
        // gone. Patch those regardless of what they're named.
        const sources = findListSources(hiddenIds());
        diag.sources = sources.map((s) => `${s.store}.${s.fn} (${s.hits})`);

        for (const { store: storeName, fn } of sources) {
            tryPatch(`${storeName}.${fn}`, findByStoreName(storeName), fn);
        }

        if (!patches.length) {
            logger.warn("[HideGroupDMs] Nothing was patched.");
            return;
        }

        logger.log(`[HideGroupDMs] Patched: ${diag.patched.join(", ")}`);
        refreshChannelList();
    },

    onUnload() {
        patches.forEach((unpatch) => unpatch?.());
        patches = [];
        patchedPairs = [];
        diag.patched = [];
        diag.calls = {};
        diag.removed = {};
        diag.sample = {};
        rowDiag.status = "not attempted";
        rowDiag.moduleId = "";
        rowDiag.calls = 0;
        rowDiag.matched = 0;
        rowDiag.noId = 0;
        rowDiag.propKeys = [];
        refreshChannelList();
    },

    settings: Settings,
};
