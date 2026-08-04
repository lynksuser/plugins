import { FluxDispatcher } from "@vendetta/metro/common";
import { before } from "@vendetta/patcher";

import { gatewayDiag, isHidden } from "./hidden";

/**
 * Filters hidden channels out of the gateway payload before any store or the
 * local app database ingests it.
 *
 * Both Flux stores and Discord mobile's app_database are downstream of these
 * dispatches, so this is upstream of every read path — which matters because we
 * proved filtering the store getters has no effect on what's drawn.
 *
 * Pattern borrowed from revengeplugin/HideBlockedAndIgnoredMessages, which
 * filters LOAD_MESSAGES_SUCCESS the same way.
 */
export function patchGateway(): Array<() => void> {
    const unpatch = before("dispatch", FluxDispatcher, (args: any[]) => {
        // This runs on EVERY Flux action in the app. An exception escaping here
        // takes down the dispatcher, not just this plugin — so the whole body is
        // guarded. Losing our filter is survivable; breaking dispatch is not.
        try {
            const event = args?.[0];
            if (!event || typeof event !== "object" || !event.type) return;

            if (event.type === "CONNECTION_OPEN") {
                gatewayDiag.connectionOpen++;

                // Record the shape once: if neither key below exists, this tells
                // us where the list actually lives instead of us guessing again.
                if (gatewayDiag.keys.length === 0) {
                    gatewayDiag.keys = Object.keys(event).slice(0, 20);
                }

                // initialPrivateChannels is what this client build actually uses;
                // the other two are kept for older/other builds.
                const found: string[] = [];
                for (const key of [
                    "initialPrivateChannels",
                    "privateChannels",
                    "private_channels",
                ]) {
                    const list = event[key];
                    if (!Array.isArray(list)) continue;

                    found.push(`${key}(${list.length})`);
                    gatewayDiag.listLength = list.length;

                    // Entries are channel objects, but tolerate bare id strings.
                    const kept = list.filter((c: any) =>
                        typeof c === "string" ? !isHidden(c) : !isHidden(c?.id)
                    );
                    gatewayDiag.removed += list.length - kept.length;
                    event[key] = kept;
                }
                // Record every key found, not just the last one examined.
                if (found.length) gatewayDiag.listKey = found.join(" + ");
            }

            // Counted, not blocked. Dropping a live CHANNEL_CREATE risks leaving
            // the client thinking you left the group; worth knowing whether it
            // fires before deciding to interfere with it.
            if (event.type === "CHANNEL_CREATE" && isHidden(event.channel?.id)) {
                gatewayDiag.channelCreates++;
            }
        } catch {
            // never let a diagnostic or filter break Discord's dispatcher
        }
    });

    return [unpatch];
}
