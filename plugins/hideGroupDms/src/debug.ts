import { findAll } from "@vendetta/metro";
import { FluxDispatcher } from "@vendetta/metro/common";

// Asking the dispatcher which stores handle an action is the only reliable way
// to learn real store names on a given client build. Borrowed from the
// _computeOrderedActionHandlers trick in revengeplugin/customVoiceMessages.
const PROBE_ACTIONS = [
    "CONNECTION_OPEN",
    "CHANNEL_SELECT",
    "CHANNEL_CREATE",
    "CHANNEL_DELETE",
];

/** Every Flux store name this client actually has. */
export function storeNames(): string[] {
    const names = new Set<string>();

    for (const action of PROBE_ACTIONS) {
        try {
            const handlers =
                (FluxDispatcher as any)?._actionHandlers?._computeOrderedActionHandlers?.(
                    action
                ) ?? [];
            for (const h of handlers) if (h?.name) names.add(h.name);
        } catch {
            // action unknown on this build — skip it
        }
    }

    return [...names].sort();
}

/** Store names that plausibly own the DM list. */
export function channelStoreNames(): string[] {
    return storeNames().filter((n) => /private|channel|dm/i.test(n));
}

/** List-shaped function names on a module. */
export function listFunctions(mod: any): string[] {
    if (!mod) return [];

    const out: string[] = [];
    for (const key in mod) {
        try {
            if (
                typeof mod[key] === "function" &&
                /private|sorted|channelid/i.test(key)
            ) {
                out.push(key);
            }
        } catch {
            // getter threw — ignore this key
        }
    }

    return out.sort();
}

/** Any module exposing a private-channel-ish function, whatever its name. */
export function privateChannelModules(): string[] {
    try {
        const mods = findAll((m: any) => {
            if (!m || typeof m !== "object") return false;
            return (
                typeof m.getPrivateChannelIds === "function" ||
                typeof m.getSortedPrivateChannels === "function" ||
                typeof m.useSortedPrivateChannels === "function"
            );
        });

        return mods.map(
            (m: any) =>
                m?.getName?.() ??
                m?.constructor?.displayName ??
                m?.displayName ??
                "(anonymous)"
        );
    } catch {
        return [];
    }
}
