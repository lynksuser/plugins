import { storage } from "@vendetta/plugin";

/**
 * Every group DM we've seen: id -> { label, hidden }.
 *
 * Entries are never deleted, only flipped. Two reasons:
 *
 *  - Hiding works by locally deleting the channel, so ChannelStore stops knowing
 *    it exists. Without a stored label the settings page would have nothing to
 *    render and you could never un-hide it.
 *  - Un-hiding doesn't restore the channel immediately either. Deleting the entry
 *    on un-hide made the row vanish from settings until Discord happened to
 *    re-sync, which looked like the plugin losing track of the group.
 */
type Group = { label: string; hidden: boolean };

storage.groups ??= {};

// Migrate the earlier shapes: {id: true} and {id: label}.
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

export const isHidden = (id: string): boolean => !!storage.groups?.[id]?.hidden;

export const hiddenIds = (): string[] =>
    Object.entries(storage.groups ?? {})
        .filter(([, g]) => (g as Group)?.hidden)
        .map(([id]) => id);

export const knownGroups = (): Array<{ id: string; label: string }> =>
    Object.entries(storage.groups ?? {}).map(([id, g]) => ({
        id,
        label: (g as Group)?.label || id,
    }));

/** Records or updates a group without changing whether it's hidden. */
export function remember(id: string, label: string) {
    const existing: Group | undefined = storage.groups?.[id];
    if (existing?.label === label) return;

    storage.groups = {
        ...(storage.groups ?? {}),
        [id]: { label, hidden: existing?.hidden ?? false },
    };
}

export function setHidden(id: string, label: string, hidden: boolean) {
    // Reassign rather than mutating, so the storage proxy sees a top-level write.
    storage.groups = {
        ...(storage.groups ?? {}),
        [id]: { label, hidden },
    };
}
