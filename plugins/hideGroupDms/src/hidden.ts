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

// Patching the store changes what it returns, but noth
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
