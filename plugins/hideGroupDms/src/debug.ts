import * as metro from "@vendetta/metro";
import { FluxDispatcher } from "@vendetta/metro/common";

// Kettu records the source path of every module Discord imports, via its
// fileFinishedImporting hook (see kettu/src/metro/internals/modules.ts). Those
// paths are Discord's own file names, so searching them beats guessing at props.
// Reading __filePath does NOT initialise the module, so this is cheap.
const PATH_RE = /private.?channel|direct.?message|\bdms?\b|channel.?list|recipient/i;

function moduleList(): Record<string, any> {
    return (metro as any).modules ?? (globalThis as any).modules ?? {};
}

export function filePathStats(): { total: number; withPath: number } {
    const mods = moduleList();
    let total = 0;
    let withPath = 0;

    for (const id in mods) {
        total++;
        if (typeof mods[id]?.__filePath === "string") withPath++;
    }

    return { total, withPath };
}

/** Every recorded path under a given prefix, for exploring a subtree. */
export function pathsUnder(prefix: string): Array<{ id: string; path: string }> {
    const mods = moduleList();
    const out: Array<{ id: string; path: string }> = [];

    for (const id in mods) {
        const path = mods[id]?.__filePath;
        if (typeof path === "string" && path.includes(prefix)) out.push({ id, path });
    }

    return out.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Resolves a module by source path rather than by id. Ids shift between Discord
 * builds; paths don't. Only returns already-initialised modules, so this never
 * forces a require.
 */
export function findByPath(re: RegExp): { id: string; exports: any } | null {
    const mods = moduleList();

    for (const id in mods) {
        const path = mods[id]?.__filePath;
        if (typeof path !== "string" || !re.test(path)) continue;

        const exports = mods[id]?.publicModule?.exports;
        if (exports) return { id, exports };
    }

    return null;
}

/** Modules whose Discord source path looks DM-list related. */
export function matchingPaths(): Array<{ id: string; path: string }> {
    const mods = moduleList();
    const out: Array<{ id: string; path: string }> = [];

    for (const id in mods) {
        const path = mods[id]?.__filePath;
        if (typeof path === "string" && PATH_RE.test(path)) out.push({ id, path });
    }

    return out.sort((a, b) => a.path.localeCompare(b.path));
}

// --- store helpers, kept from the earlier rounds -------------------------------

const PROBE_ACTIONS = [
    "CONNECTION_OPEN",
    "CHANNEL_SELECT",
    "CHANNEL_CREATE",
    "CHANNEL_DELETE",
];

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

export function channelStoreNames(): string[] {
    return storeNames().filter((n) => /private|channel|dm/i.test(n));
}

/**
 * Zero-argument `get*` functions on a module, prototype chain included.
 *
 * Restricted to `get*` with arity 0 deliberately: those are conventionally pure
 * reads, so calling them to inspect their output is safe. Hooks (`use*`) are
 * excluded because calling one outside render throws.
 */
function zeroArgGetters(mod: any): string[] {
    const out = new Set<string>();
    let obj: any = mod;

    while (obj && obj !== Object.prototype) {
        for (const key of Object.getOwnPropertyNames(obj)) {
            if (key === "constructor" || !/^get/.test(key)) continue;
            try {
                const value = mod[key];
                if (typeof value === "function" && value.length === 0) out.add(key);
            } catch {
                // getter threw — ignore
            }
        }
        obj = Object.getPrototypeOf(obj);
    }

    return [...out].sort();
}

/**
 * Finds which store getters actually return a list containing the given ids.
 *
 * This inverts the approach that failed for six rounds: instead of guessing a
 * name and checking whether it matters, ask every store what it currently holds
 * and keep whatever already contains the channel we want gone.
 */
export function findListSources(
    ids: string[]
): Array<{ store: string; fn: string; hits: number }> {
    const out: Array<{ store: string; fn: string; hits: number }> = [];
    if (!ids.length) return out;

    for (const storeName of storeNames()) {
        let store: any;
        try {
            store = (metro as any).findByStoreName(storeName);
        } catch {
            continue;
        }
        if (!store) continue;

        for (const fn of zeroArgGetters(store)) {
            let ret: any;
            try {
                ret = store[fn]();
            } catch {
                continue;
            }
            if (!Array.isArray(ret) || ret.length === 0) continue;

            let hits = 0;
            for (const entry of ret) {
                const id = typeof entry === "string" ? entry : entry?.id;
                if (id && ids.includes(id)) hits++;
            }

            if (hits) out.push({ store: storeName, fn, hits });
        }
    }

    return out;
}

/**
 * List-shaped function names on a module.
 *
 * Walks the prototype chain with getOwnPropertyNames: Flux store methods are
 * non-enumerable class-prototype members, so `for...in` misses all of them and
 * every store wrongly looks empty.
 */
export function listFunctions(mod: any): string[] {
    if (!mod) return [];

    const out = new Set<string>();
    let obj: any = mod;

    while (obj && obj !== Object.prototype) {
        for (const key of Object.getOwnPropertyNames(obj)) {
            if (key === "constructor") continue;
            try {
                if (
                    typeof mod[key] === "function" &&
                    /private|sorted|channelid/i.test(key)
                ) {
                    out.add(key);
                }
            } catch {
                // getter threw — ignore this key
            }
        }
        obj = Object.getPrototypeOf(obj);
    }

    return [...out].sort();
}
