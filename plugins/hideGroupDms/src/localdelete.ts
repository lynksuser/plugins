import { findByStoreName } from "@vendetta/metro";
import { FluxDispatcher } from "@vendetta/metro/common";

import { hiddenIds } from "./hidden";

/**
 * Tells the client each hidden channel was deleted, locally.
 *
 * Deliberately not a filter. Filtering means finding the one surface the DM list
 * happens to read, and on this client that surface is neither PrivateChannelSortStore
 * nor ChannelStore nor the row component. Dispatching CHANNEL_DELETE reuses
 * Discord's own removal logic, so every store and the local app database drop the
 * channel without us needing to know which one the UI reads.
 *
 * The dispatch is local only — it never reaches the API, so you stay in the group.
 * The channel returns with the next READY, which is why this re-runs on load and
 * whenever something re-adds it.
 */
export function hideNow() {
    const ChannelStore = findByStoreName("ChannelStore");

    for (const id of hiddenIds()) {
        try {
            // Prefer the real record: Discord's handler reads more than just id.
            const channel = ChannelStore?.getChannel?.(id) ?? { id, type: 3 };

            FluxDispatcher.dispatch({ type: "CHANNEL_DELETE", channel });
        } catch {
            // already gone, or the handler rejected it — nothing to do
        }
    }
}
