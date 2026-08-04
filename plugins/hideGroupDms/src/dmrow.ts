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
        rowDiag.status = `patched default (module ${found.id})`;
    } else if (def && typeof def.type === "function") {
        parent = def;
        key = "type";
        rowDiag.status = `patched default.type (module ${found.id})`;
    } else {
        rowDiag.status = `default export not callable: ${typeof def}`;
        return [];
    }

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
