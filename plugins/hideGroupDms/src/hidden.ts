import { storage } from "@vendetta/plugin";

/**
 * keeps track of hidden group DMs
 */
type Group = { label: string; hidden: boolean };

// local storage of hidden ids
storage.groups ??= {};

if (storage.hidden && !Object.keys(storage.groups).length) {
    const migrated: Record<string, Group> = {};
    for (const [id, value] of Object.entries(storage.hidden)) {
        migrated[id] = {
            label: typeof value === "string" ? value : id,
            hidden: true,
        };
    }
    storage.groups = migrated;
    delete storage.hidden;
}

// cache all hidden group dm ids
const hiddenSet = new Set<string>();

// populate cache on load
for (const [id, group] of Object.entries(storage.groups ?? {})) {
    if ((group as Group)?.hidden) {
        hiddenSet.add(id);
    }
}

// O(1) memory lookup
export const isHidden = (id: string): boolean => hiddenSet.has(id);

export const hiddenIds = (): string[] => Array.from(hiddenSet);

export const knownGroups = (): Array<{ id: string; label: string }> =>
    Object.entries(storage.groups ?? {}).map(([id, g]) => ({
        id,
        label: (g as Group)?.label || id,
    }));

// records or updates a group without changing whether it's hidden.
export function remember(id: string, label: string) {
    const existing: Group | undefined = storage.groups?.[id];
    if (existing?.label === label) return;

    storage.groups = {
        ...(storage.groups ?? {}),
        [id]: { label, hidden: existing?.hidden ?? false },
    };
}

export function setHidden(id: string, label: string, hidden: boolean) {
    // keep cache in sync with database
    if (hidden) {
        hiddenSet.add(id);
    } else {
        hiddenSet.delete(id);
    }

    // write to storage
    storage.groups = {
        ...(storage.groups ?? {}),
        [id]: { label, hidden },
    };
}
