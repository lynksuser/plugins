import { logger } from "@vendetta";

import Settings from "./Settings";
import { patchGateway } from "./gateway";
import { hideNow, startWatching, stopWatching } from "./localdelete";

let patches: Array<() => void> = [];

export default {
    onLoad() {
        patches = patchGateway();

        hideNow();
        startWatching(); // watch for server revivals

        logger.log("[HideGroupDMs] loaded");
    },

    onUnload() {
        patches.forEach((unpatch) => unpatch?.());
        patches = [];

        stopWatching();
    },

    settings: Settings,
};
