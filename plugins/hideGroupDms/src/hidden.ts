import { findByStoreName } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";

// Discord has renamed this store more than once. Try each; patch whatever exists.
export const SORT_STORES = ["PrivateChannelSortStore", "SortedPrivateChannelStore"];

storage.hidden ??= {};

// Optional-chained: this runs inside patched getters, which can fire before the
// storage proxy has resolved. An exception here would break the store, not just us.
export const isHidden = (id: string): boolean => !!storage.hidden?.[id];

export function setHidden(id: string, hidden: boolean) {
    // Reassign the whole object rather than mutating a key, so the storage
    // proxy definitely sees a top-level write and persists it.
    const next = { ...(storage.hidden ?? {}) };
    if (hidden) next[id] = true;
    else delete next[id];
    storage.hidden = next;

    refreshChannelList();

    // Apply immediately rather than waiting for the next connect. Required late
    // to avoid a circular import: localdelete reads hiddenIds from this module.
    if (hidden) require("./localdelete").hideNow();
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
    // Store getters found to actually contain a hidden id at load time.
    sources: [] as string[],
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

// Report for the DM row patch. `noId` counts renders where we found no channel
// id in props — if that equals `calls`, the id lives somewhere we're not looking
// and `propKeys` tells us where.
export const rowDiag = {
    status: "not attempted",
    moduleId: "",
    calls: 0,
    matched: 0,
    noId: 0,
    propKeys: [] as string[],
};

// Gateway ingestion report. `keys` records the actual shape of CONNECTION_OPEN so
// we can see where the private channel list lives if neither expected key exists.
export const gatewayDiag = {
    connectionOpen: 0,
    listKey: "",
    listLength: 0,
    removed: 0,
    channelCreates: 0,
    keys: [] as string[],
    // CHANNEL_DELETE dispatches we've issued locally.
    deletes: 0,
};

// References captured *before* patching, so the settings page can enumerate
// channels without seeing its own filter applied.
export const originals: Record<string, ((...args: any[]) => any) | undefined> = {};

// Stores we've actually patched. index.ts fills this; refreshChannelList needs it
// because emitting only on SORT_STORES leaves any dynamically-found store stale.
export const patchedStores: any[] = [];

// Patching the store changes what it returns, but nothing has told the DM list
// to ask again. Emitting a change makes subscribed components re-render.
export function refreshChannelList() {
    const targets = [
        ...SORT_STORES.map((name) => {
            try {
                return findByStoreName(name);
            } catch {
                return null;
            }
        }),
        ...patchedStores,
    ];

    const seen = new Set<any>();
    for (const store of targets) {
        if (!store || seen.has(store)) continue;
        seen.add(store);
        try {
            store.emitChange?.();
        } catch {
            // store dislikes being poked — nothing to refresh
        }
    }
}
