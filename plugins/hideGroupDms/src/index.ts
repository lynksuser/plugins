
import { logger } from "@vendetta";
import { findByStoreName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";

import Settings from "./settings";
import { SORT_STORES, isHidden, refreshChannelList } from "./hidden";

let patches: (() => void)[] = [];

export default {
    onLoad() {
        for (const name of SORT_STORES) {
            const store = findByStoreName(name);
            if (!store?.getPrivateChannelIds) continue;

            patches.push(
                after("getPrivateChannelIds", store, (_args, ids: string[]) =>
                    Array.isArray(ids) ? ids.filter((id) => !isHidden(id)) : ids
                )
            );
        }

        if (!patches.length) {
            logger.warn(
                "[HideGroupDMs] No private-channel sort store matched — nothing was patched. " +
                    "Discord likely renamed the store on this client version."
            );
            return;
        }

        refreshChannelList();
    },

    onUnload() {
        patches.forEach((unpatch) => unpatch?.());
        patches = [];
        refreshChannelList();
    },

    settings: Settings,
};