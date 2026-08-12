import { FluxDispatcher } from "@vendetta/metro/common";
import { after, before } from "@vendetta/patcher";

import { isHidden } from "./hidden";
import { hideNow } from "./localdelete";

// Catch everywhere Discord might try to sneak a channel list through
const LIST_KEYS = ["initialPrivateChannels", "privateChannels", "private_channels", "channels"];

// Startups and local cache restorations
const STARTUP_EVENTS = new Set([
    "CONNECTION_OPEN",
    "CONNECTION_OPEN_SUPPLEMENTAL",
    "READY",
    "CACHE_LOADED"
]);

// Every possible event that might resurrect a DM
const GHOST_EVENTS = new Set([
    "CHANNEL_CREATE",
    "CHANNEL_UPDATE",
    "MESSAGE_CREATE",
    "MESSAGE_UPDATE",
    "UNREAD_UPDATE",
    "CHANNEL_UNREAD_UPDATE",
    "MESSAGE_ACK",
    "LOAD_MESSAGES_SUCCESS",
    "UPDATE_CHANNEL_DIMENSIONS"
]);

export function patchGateway(): Array<() => void> {
    const unBefore = before("dispatch", FluxDispatcher, (args: any[]) => {
        try {
            const event = args?.[0];
            const type = event?.type;

            if (!STARTUP_EVENTS.has(type)) return;

            // Scrub the channel from bulk initialization payloads (both Network and Disk Cache)
            for (const key of LIST_KEYS) {
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

    const unAfter = after("dispatch", FluxDispatcher, (args: any[]) => {
        try {
            const event = args?.[0];
            const type = event?.type;

            if (STARTUP_EVENTS.has(type)) {
                // Wait 100ms so React Native finishes mounting its cache before we delete
                setTimeout(() => hideNow(), 100);
                return;
            }

            if (GHOST_EVENTS.has(type)) {
                const channelId = event?.channel?.id || event?.channel_id || event?.message?.channel_id || event?.id;

                if (channelId && isHidden(channelId)) {
                    // Delay slightly to ensure Discord's dispatcher has fully ingested the ghost event 
                    // before we hit it with the fake CHANNEL_DELETE
                    setTimeout(() => hideNow(channelId), 100);
                }
            }
        } catch {
            // as above
        }
    });

    return [unBefore, unAfter];
}
