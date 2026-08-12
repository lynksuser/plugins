import { logger } from "@vendetta";
import Settings from "./Settings";
import { hideNow, startWatching, stopWatching } from "./localdelete";

export default {
    onLoad() {
        hideNow();
        startWatching();

        logger.log("[HideGroupDMs] loaded");
    },

    onUnload() {
        stopWatching();
    },

    settings: Settings,
};
