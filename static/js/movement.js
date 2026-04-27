import {postJSON} from "./api.js";
import {isEditableTarget} from "./utils.js";

const MAX_SPEED = 100;
const RAMP_STEP = 5;
const RAMP_INTERVAL_MS = 50;

export function initMovementControls() {
    let speed = 0;
    let currentDir = null;
    let rampInterval = null;

    function sendCommand(dir, speedVal = null) {
        postJSON("/motor", {direction: dir, speed: speedVal});
    }

    function stopMovement() {
        if (rampInterval) clearInterval(rampInterval);
        speed = 0;
        if (currentDir) sendCommand("stop", 0);
        currentDir = null;
    }

    function startMovement(dir) {
        if (currentDir === dir) return;
        stopMovement();

        currentDir = dir;
        speed = 50;

        rampInterval = setInterval(() => {
            if (speed < MAX_SPEED) speed += RAMP_STEP;
            sendCommand(currentDir, speed);
        }, RAMP_INTERVAL_MS);
    }

    function shouldIgnoreArrowMovementHotkeys(target) {
        if (!isEditableTarget(target)) return false;
        return !(target && target.tagName === "INPUT" && target.type === "range");
    }

    document.addEventListener("keydown", (e) => {
        if (shouldIgnoreArrowMovementHotkeys(e.target)) return;

        let dir = null;
        switch (e.key) {
            case "ArrowUp": dir = "forward"; break;
            case "ArrowDown": dir = "backward"; break;
            case "ArrowLeft": dir = "left"; break;
            case "ArrowRight": dir = "right"; break;
        }

        if (!dir) return;
        e.preventDefault();
        startMovement(dir);
    });

    document.addEventListener("keyup", (e) => {
        if (shouldIgnoreArrowMovementHotkeys(e.target)) return;
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
            stopMovement();
        }
    });

    const desktopButtons = {
        "btn-forward-desktop": "forward",
        "btn-backward-desktop": "backward",
        "btn-left-desktop": "left",
        "btn-right-desktop": "right"
    };

    Object.entries(desktopButtons).forEach(([btnId, dir]) => {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        btn.addEventListener("mousedown", () => startMovement(dir));
        btn.addEventListener("mouseup", stopMovement);
        btn.addEventListener("mouseleave", stopMovement);
    });

    const mobileButtons = {
        "btn-forward": "forward",
        "btn-backward": "backward",
        "btn-left": "left",
        "btn-right": "right"
    };

    Object.entries(mobileButtons).forEach(([btnId, dir]) => {
        const btn = document.getElementById(btnId);
        if (!btn) return;

        btn.addEventListener("touchstart", (e) => {
            e.preventDefault();
            startMovement(dir);
        }, {passive: false});
        btn.addEventListener("touchend", stopMovement, {passive: false});
        btn.addEventListener("mousedown", () => startMovement(dir));
        btn.addEventListener("mouseup", stopMovement);
        btn.addEventListener("mouseleave", stopMovement);
    });

    const stopBtn = document.getElementById("btn-stop");
    if (stopBtn) {
        stopBtn.addEventListener("click", stopMovement);
        stopBtn.addEventListener("touchstart", (e) => {
            e.preventDefault();
            stopMovement();
        }, {passive: false});
    }
}
