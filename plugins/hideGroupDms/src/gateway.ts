import { FluxDispatcher } from "@vendetta/metro/common";
import { after, before } from "@vendetta/patcher";

import { isHidden } from "./hidden";
import { hideNow } from "./localdelete";

const READY_KEYS = ["initialPrivateChannels", "privateChannels", "private_channels"];

const GHOST_EVENTS = new Set([
    "CHANNEL_CREATE",
    "CHANNEL_UPDATE",
    "MESSAGE_CREATE",
    "MESSAGE_UPDATE",
    "UNREAD_UPDATE",
    "UPDATE_CHANNEL_DIMENSIONS"
]);

export function patchGateway(): Array<() => void> {
    const unBefore = before("dispatch", FluxDispatcher, (args: any[]) => {
        try {
            const event = args?.[0];
            if (event?.type !== "CONNECTION_OPEN") return;

            for (const key of READY_KEYS) {
                const list = event[key];
                if (!Array.isArray(list)) continue;

                // either hide all hidden dms or the one hidden dm
                event[key] = list.filter((c: any) =>
                    typeof c === "string" ? !isHidden(c) : !isHidden(c?.id)
                );
            }
        } catch {
            // never let filter break discord's dispatcher
        }
    });

    const unAfter = after("dispatch", FluxDispatcher, (args: any[]) => {
        try {
            const event = args?.[0];
            const type = event?.type;

            if (type === "CONNECTION_OPEN") {
                setTimeout(() => hideNow(), 0);
                return;
            }

            if (GHOST_EVENTS.has(type)) {
                const channelId = event?.channel?.id || event?.channel_id || event?.message?.channel_id;

                if (channelId && isHidden(channelId)) {
                    // passes the single ID to hideNow so it doesn't loop all channels
                    setTimeout(() => hideNow(channelId), 0);
                }
            }
        } catch {
            // as above
        }
    });

    return [unBefore, unAfter];
}
