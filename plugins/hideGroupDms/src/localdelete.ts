import { findByStoreName } from "@vendetta/metro";
import { FluxDispatcher } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";

/**
 * tells the client the hidden channel was deleted locally.
 */
export function hideNow() {
    if (!storage.hideMyGroup || !storage.targetGroupId) return;

    const ChannelStore = findByStoreName("ChannelStore");
    const targetId = storage.targetGroupId.trim();

    try {
        const channel = ChannelStore?.getChannel?.(targetId) ?? { id: targetId, type: 3 };
        FluxDispatcher.dispatch({ type: "CHANNEL_DELETE", channel });
    } catch {
        // already gone or rejected — nothing to do
    }
}

/**
 * handles incoming websocket events that attempt to recreate the channel.
 */
function handleRevivalAttempt(event: any) {
    if (!storage.hideMyGroup || !storage.targetGroupId) return;

    const id = event.channel?.id || event.channelId || event.channel_id;
    const targetId = storage.targetGroupId.trim();

    if (id && id === targetId) {
        // use setTimeout to bypass flux's "cannot dispatch in the middle of a dispatch" error
        setTimeout(() => {
            hideNow();
        }, 0);
    }
}

/**
 * starts watching for server events that re-add the group dm
 */
export function startWatching() {
    FluxDispatcher.subscribe("CHANNEL_CREATE", handleRevivalAttempt);
    FluxDispatcher.subscribe("MESSAGE_CREATE", handleRevivalAttempt);
    FluxDispatcher.subscribe("CHANNEL_UPDATE", handleRevivalAttempt);
}

/**
 * cleans up subscriptions on reload
 */
export function stopWatching() {
    FluxDispatcher.unsubscribe("CHANNEL_CREATE", handleRevivalAttempt);
    FluxDispatcher.unsubscribe("MESSAGE_CREATE", handleRevivalAttempt);
    FluxDispatcher.unsubscribe("CHANNEL_UPDATE", handleRevivalAttempt);
}
