import { logger } from "@vendetta";

import Settings from "./Settings";
import { patchGateway } from "./gateway";
import { hideNow } from "./localdelete";

let patches: Array<() => void> = [];

export default {
    onLoad() {
        patches = patchGateway();

        hideNow();

        logger.log("[HideGroupDMs] loaded");
    },

    onUnload() {
        patches.forEach((unpatch) => unpatch?.());
        patches = [];
        // Nothing to restore: hidden channels come back with the next READY.
    },

    settings: Settings,
};
