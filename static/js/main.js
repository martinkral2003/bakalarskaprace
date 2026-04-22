import {initMovementControls} from "./movement.js";
import {initCameraControls} from "./camera.js";
import {initHorizonOverlay} from "./horizon.js";
import {initLatencyWidget} from "./latency.js";
import {initLedControls} from "./led.js";

function initializeUI() {
    initMovementControls();
    initCameraControls();
    initHorizonOverlay();
    initLatencyWidget();
    initLedControls();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeUI);
} else {
    initializeUI();
}
