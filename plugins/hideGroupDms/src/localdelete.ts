import { findByStoreName } from "@vendetta/metro";
import { FluxDispatcher } from "@vendetta/metro/common";

import { gatewayDiag, hiddenIds } from "./hidden";

/**
 * Tells the client each hidden channel was deleted, locally.
 *
 * This is deliberately not a filter. Every read path we tried — the sort store,
 * ChannelStore, the row component, the gateway payload — meant finding the one
 * surface the list happens to use. Dispatching CHANNEL_DELETE instead reuses
 * Discord's own removal logic, so stores and the app database both drop it
 * without us knowing which one the UI reads.
 *
 * The dispatch is local only: it does not hit the API, so you remain a member.
 * The channel returns on next login from READY, which is why this re-runs on
 * load and whenever the channel is re-added.
 */
export function hideNow() {
    const ChannelStore = findByStoreName("ChannelStore");

    for (const id of hiddenIds()) {
        try {
            // Prefer the real record: Discord's handler reads more than just id.
            const channel = ChannelStore?.getChannel?.(id) ?? { id, type: 3 };

            FluxDispatcher.dispatch({ type: "CHANNEL_DELETE", channel });
            gatewayDiag.deletes++;
        } catch {
            // channel already gone, or the handler rejected it — nothing to do
        }
    }
}
