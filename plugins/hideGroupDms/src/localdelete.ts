import { findByStoreName } from "@vendetta/metro";
import { FluxDispatcher } from "@vendetta/metro/common";

import { hiddenIds } from "./hidden";

/**
 * tells the client that the hidden channel(s) were deleted (lie)
 */
export function hideNow(targetId?: string) {
    const ChannelStore = findByStoreName("ChannelStore");

    // if pass one id, only hide that one
    const idsToHide = targetId ? [targetId] : hiddenIds();

    for (const id of idsToHide) {
        try {
            const channel = ChannelStore?.getChannel?.(id) ?? { id, type: 3 };

            FluxDispatcher.dispatch({ type: "CHANNEL_DELETE", channel });
        } catch {
            // already gone, or the handler rejected it: nothing to do
        }
    }
}
