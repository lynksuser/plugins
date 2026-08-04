import { after } from "@vendetta/patcher";

import { isHidden, rowDiag } from "./hidden";
import { findByPath } from "./debug";

/**
 * The DM list on mobile is the home drawer, not the desktop channel sidebar —
 * hence modules/home_drawer/native/HomeDrawerDirectMessagesRow.tsx. Returning
 * null from a row component collapses it entirely, unlike RowManager where a
 * row can only be emptied.
 */
const ROW_PATH = /HomeDrawerDirectMessagesRow/;

/** Every place the row's channel id might live in its props. */
function propChannelId(props: any): string | undefined {
    if (!props || typeof props !== "object") return undefined;

    return (
        props.channel?.id ??
        props.channelId ??
        props.channel_id ??
        props.item?.id ??
        props.item?.channel?.id ??
        undefined
    );
}

export function patchDMRow(): Array<() => void> {
    const found = findByPath(ROW_PATH);

    if (!found) {
        rowDiag.status = "HomeDrawerDirectMessagesRow not found";
        return [];
    }

    rowDiag.moduleId = found.id;

    const mod = found.exports;
    const def = mod.default;

    // A component may be exported bare, or wrapped in memo/forwardRef where the
    // real function hides behind `.type`. Patch whichever is actually callable.
    let parent: any;
    let key: string;

    if (typeof def === "function") {
        parent = mod;
        key = "default";
    } else if (def && typeof def.type === "function") {
        parent = def;
        key = "type";
    } else {
        rowDiag.status = `default export not callable: ${typeof def}`;
        return [];
    }

    // Patching works by reassigning parent[key]. Metro's ESM interop often defines
    // exports as accessor-only properties, where that assignment silently does
    // nothing — the patch would report success and never fire. Check first, so a
    // zero call count means "never rendered" rather than "never actually patched".
    const desc = Object.getOwnPropertyDescriptor(parent, key);
    const writable = !desc || desc.writable === true || typeof desc.set === "function";

    if (!writable) {
        rowDiag.status = `${key} is not writable (getter-only) — cannot patch module ${found.id}`;
        return [];
    }

    rowDiag.status = `patched ${key} (module ${found.id})`;

    const unpatch = after(key, parent, (args: any[], ret: any) => {
        rowDiag.calls++;

        const props = args?.[0];
        if (rowDiag.propKeys.length === 0 && props && typeof props === "object") {
            rowDiag.propKeys = Object.keys(props).slice(0, 12);
        }

        const channelId = propChannelId(props);
        if (!channelId) {
            rowDiag.noId++;
            return ret;
        }

        if (!isHidden(channelId)) return ret;

        rowDiag.matched++;
        return null;
    });

    return [unpatch];
}
