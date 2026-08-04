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

// Runtime report, surfaced in the settings page.
//   patched — what we hooked
//   calls   — how many times each hook fired; 0 means it isn't what draws the list
//   removed — how many entries the filter actually dropped; 0 with calls > 0 means
//             the ids don't match what we stored
//   sample  — first few raw entries, so we can compare id shape by eye
export const diag = {
    patched: [] as string[],
    calls: {} as Record<string, number>,
    removed: {} as Record<string, number>,
    sample: {} as Record<string, string>,
};

export function noteCall(surface: string) {
    diag.calls[surface] = (diag.calls[surface] ?? 0) + 1;
}

export function noteResult(surface: string, before: unknown, after: unknown) {
    if (!Array.isArray(before) || !Array.isArray(after)) return;

    diag.removed[surface] =
        (diag.removed[surface] ?? 0) + (before.length - after.length);

    if (!diag.sample[surface]) {
        try {
            diag.sample[surface] = JSON.stringify(
                before.slice(0, 3).map((e) => (e && typeof e === "object" ? e.id : e))
            );
        } catch {
            diag.sample[surface] = "(unserialisable)";
        }
    }
}

export const hiddenIds = (): string[] => Object.keys(storage.hidden ?? {});

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
