import { findByName } from "@vendetta/metro";
import { before } from "@vendetta/patcher";

import { isHidden, rowDiag } from "./hidden";

const MAX_SHAPES = 25;

/** Every place a row's channel id might live, in rough order of likelihood. */
function extractChannelId(data: any): string | undefined {
    return (
        data.channel?.id ??
        data.channelId ??
        data.channel_id ??
        data.message?.channel_id ??
        undefined
    );
}

/**
 * Records a compact signature per distinct row kind. Capped, because generate()
 * is called once per row per render and an unbounded log would be a leak.
 */
function recordShape(data: any, channelId?: string) {
    if (rowDiag.shapes.length >= MAX_SHAPES) return;

    const keys = Object.keys(data).slice(0, 8).join(",");
    const sig = `type=${data.rowType ?? "?"} chan=${channelId ? "yes" : "no"} keys=${keys}`;

    if (!rowDiag.shapes.includes(sig)) rowDiag.shapes.push(sig);
}

export function patchRows(): Array<() => void> {
    const RowManager = findByName("RowManager");

    if (!RowManager?.prototype?.generate) {
        rowDiag.status = "RowManager.prototype.generate not found";
        return [];
    }

    rowDiag.status = "patched";

    // `before` rather than `after`: generate() builds the row data in place, and
    // HideBlockedAndIgnoredMessages in ../revengeplugin shows mutating the input
    // is how this hook is meant to be used on mobile.
    const unpatch = before("generate", RowManager.prototype, ([data]: [any]) => {
        if (!data || typeof data !== "object") return;

        rowDiag.calls++;

        const channelId = extractChannelId(data);
        recordShape(data, channelId);

        if (!channelId || !isHidden(channelId)) return;

        rowDiag.matched++;

        // A row cannot be removed from here — only emptied. If DM rows do pass
        // through, expect a blank gap rather than a clean disappearance; that
        // still confirms the surface and we can then filter the list feeding it.
        data.renderContentOnly = true;
        data.content = [];
        data.text = "";
        data.revealed = false;
    });

    return [unpatch];
}
