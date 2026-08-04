import { findByStoreName } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";

// Discord has renamed this store more than once. Try each; patch whatever exists.
export const SORT_STORES = ["PrivateChannelSortStore", "SortedPrivateChannelStore"];

storage.hidden ??= {};

export const isHidden = (id: string): boolean => !!storage.hidden[id];

export function setHidden(id: string, hidden: boolean) {
    // Reassign the whole object rather than mutating a key, so the storage
    // proxy definitely sees a top-level write and persists it.
    const next = { ...storage.hidden };
    if (hidden) next[id] = true;
    else delete next[id];
    storage.hidden = next;

    refreshChannelList();
}

// Runtime report, surfaced in the settings page. `patched` is what we hooked;
// `calls` counts how many times each hook actually fired. A surface that is
// patched but never called is not what renders your DM list.
export const diag = {
    patched: [] as string[],
    calls: {} as Record<string, number>,
};

export function noteCall(surface: string) {
    diag.calls[surface] = (diag.calls[surface] ?? 0) + 1;
}

// References captured *before* patching, so the settings page can enumerate
// channels without seeing its own filter applied.
export const originals: Record<string, ((...args: any[]) => any) | undefined> = {};

// Patching the store changes what it returns, but nothing has told the DM list
// to ask again. Emitting a change makes subscribed components re-render.
export function refreshChannelList() {
    for (const name of SORT_STORES) {
        try {
            findByStoreName(name)?.emitChange?.();
        } catch {
            // store missing on this client version — nothing to refresh
        }
    }
}