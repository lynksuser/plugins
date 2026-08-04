import { logger } from "@vendetta";
import { findByProps, findByStoreName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";

import Settings from "./settings";
import { diag, isHidden, noteCall, originals, refreshChannelList } from "./hidden";

let patches: (() => void)[] = [];

// Some of these candidates resolve to the same underlying function. Patching it
// twice would double-filter (harmless) and pollute diagnostics (not harmless).
const alreadyPatched = new Set<unknown>();

/** Returns an array of channel ids with the hidden ones removed. */
const filterIds = (ids: unknown) =>
    Array.isArray(ids) ? ids.filter((id) => !isHidden(id)) : ids;

/** Returns an array of channel objects with the hidden ones removed. */
const filterChannels = (channels: unknown) =>
    Array.isArray(channels) ? channels.filter((c) => !isHidden(c?.id)) : channels;

function tryPatch(
    label: string,
    mod: any,
    fnName: string,
    transform: (ret: unknown) => unknown
) {
    if (typeof mod?.[fnName] !== "function") return;
    if (alreadyPatched.has(mod[fnName])) return;
    alreadyPatched.add(mod[fnName]);

    // Keep an unpatched handle for the settings page.
    originals[label] = mod[fnName].bind(mod);

    patches.push(
        after(fnName, mod, (_args, ret) => {
            noteCall(label);
            return transform(ret);
        })
    );
    diag.patched.push(label);
}

export default {
    onLoad() {
        const ChannelStore = findByStoreName("ChannelStore");

        // Ordered id lists — the usual desktop shape.
        tryPatch(
            "PrivateChannelSortStore.getPrivateChannelIds",
            findByStoreName("PrivateChannelSortStore"),
            "getPrivateChannelIds",
            filterIds
        );
        tryPatch(
            "SortedPrivateChannelStore.getPrivateChannelIds",
            findByStoreName("SortedPrivateChannelStore"),
            "getPrivateChannelIds",
            filterIds
        );
        // Catch-all: whatever module exposes it, regardless of store name.
        tryPatch(
            "findByProps.getPrivateChannelIds",
            findByProps("getPrivateChannelIds"),
            "getPrivateChannelIds",
            filterIds
        );

        // Channel-object lists.
        tryPatch(
            "ChannelStore.getSortedPrivateChannels",
            ChannelStore,
            "getSortedPrivateChannels",
            filterChannels
        );
        tryPatch(
            "findByProps.useSortedPrivateChannels",
            findByProps("useSortedPrivateChannels"),
            "useSortedPrivateChannels",
            filterChannels
        );

        if (!patches.length) {
            logger.warn(
                "[HideGroupDMs] No private-channel surface matched — nothing was patched."
            );
            return;
        }

        logger.log(`[HideGroupDMs] Patched: ${diag.patched.join(", ")}`);
        refreshChannelList();
    },

    onUnload() {
        patches.forEach((unpatch) => unpatch?.());
        patches = [];
        alreadyPatched.clear();
        diag.patched = [];
        diag.calls = {};
        refreshChannelList();
    },

    settings: Settings,
};