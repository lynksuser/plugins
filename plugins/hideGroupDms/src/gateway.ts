import { FluxDispatcher } from "@vendetta/metro/common";
import { after, before } from "@vendetta/patcher";

import { isHidden } from "./hidden";
import { hideNow } from "./localdelete";

// This build uses initialPrivateChannels; the others are kept for older ones.
const READY_KEYS = ["initialPrivateChannels", "privateChannels", "private_channels"];

// Events that Discord fires which can cause a channel to resurrect in the UI
const GHOST_EVENTS = new Set([
    "CHANNEL_CREATE",
    "CHANNEL_UPDATE",
    "MESSAGE_CREATE",
    "MESSAGE_UPDATE",
    "UNREAD_UPDATE",
    "UPDATE_CHANNEL_DIMENSIONS"
]);

export function patchGateway(): Array<() => void> {
    // Strip hidden channels from the login payload so they are never ingested in
    // the first place. This is what stops the channel appearing at startup and
    // then vanishing a moment later.
    const unBefore = before("dispatch", FluxDispatcher, (args: any[]) => {
        // Runs on every action in the app: an exception escaping here breaks the
        // dispatcher, not just this plugin.
        try {
            const event = args?.[0];
            if (event?.type !== "CONNECTION_OPEN") return;

            for (const key of READY_KEYS) {
                const list = event[key];
                if (!Array.isArray(list)) continue;

                event[key] = list.filter((c: any) =>
                    typeof c === "string" ? !isHidden(c) : !isHidden(c?.id)
                );
            }
        } catch {
            // never let our filter break Discord's dispatcher
        }
    });

    // Safety net for anything the payload filter misses — a channel restored from
    // the local database, or re-added when a message arrives or updates.
    const unAfter = after("dispatch", FluxDispatcher, (args: any[]) => {
        try {
            const event = args?.[0];
            const type = event?.type;

            if (type === "CONNECTION_OPEN") {
                setTimeout(hideNow, 0);
                return;
            }

            // If an event occurs that might bring the channel back to life, 
            // check if it belongs to a hidden channel.
            if (GHOST_EVENTS.has(type)) {
                // Look for the channel ID in common locations within the event payload
                const channelId = event?.channel?.id || event?.channel_id || event?.message?.channel_id;

                if (channelId && isHidden(channelId)) {
                    // Re-trigger the local deletion to banish it again
                    setTimeout(hideNow, 0);
                }
            }
        } catch {
            // as above
        }
    });

    return [unBefore, unAfter];
}
