import {postJSON} from "./api.js";

const CAMERA_KEY_STEP = 2;
const CAMERA_KEY_INTERVAL_MS = 50;
const STREAM_REFRESH_MS = 3000;
const SERVO_SEND_MIN_INTERVAL_MS = 120;

export function initCameraControls() {
    const servoX = document.getElementById("servo-x");
    const servoY = document.getElementById("servo-y");
    const homeButton = document.getElementById("home-camera");
    const resolutionSelect = document.getElementById("resolution");
    const cameraImg = document.getElementById("camera-stream");
    const statFps = document.getElementById("stat-fps");

    if (!servoX || !servoY || !homeButton || !resolutionSelect || !cameraImg) {
        return;
    }

    const activeCameraKeys = new Set();
    let cameraKeyInterval = null;
    let servoRequestInFlight = false;
    let pendingServoPayload = null;
    let servoSendTimer = null;
    let lastServoSentAt = 0;
    let frameCount = 0;
    let fpsWindowStart = performance.now();

    function getServoPayload() {
        return {
            x: -Number(servoX.value),
            y: -Number(servoY.value)
        };
    }

    function attemptSendServoUpdate() {
        if (servoRequestInFlight || !pendingServoPayload) return;

        const elapsed = Date.now() - lastServoSentAt;
        const remaining = SERVO_SEND_MIN_INTERVAL_MS - elapsed;
        if (remaining > 0) {
            if (!servoSendTimer) {
                servoSendTimer = setTimeout(() => {
                    servoSendTimer = null;
                    attemptSendServoUpdate();
                }, remaining);
            }
            return;
        }

        const payload = pendingServoPayload;
        pendingServoPayload = null;
        servoRequestInFlight = true;
        lastServoSentAt = Date.now();

        postJSON("/servo", payload)
            .catch((err) => console.error("Servo update failed:", err))
            .finally(() => {
                servoRequestInFlight = false;
                attemptSendServoUpdate();
            });
    }

    function updateServo() {
        pendingServoPayload = getServoPayload();
        attemptSendServoUpdate();
    }

    function handleStreamFrameLoaded() {
        if (!statFps) return;

        frameCount += 1;
        const now = performance.now();
        const elapsedMs = now - fpsWindowStart;

        // Keep per-frame work tiny; update DOM only about once a second.
        if (elapsedMs < 1000) return;

        const fps = (frameCount * 1000) / elapsedMs;
        statFps.textContent = fps.toFixed(1);
        frameCount = 0;
        fpsWindowStart = now;
    }

    function homeServos() {
        servoX.value = 0;
        servoY.value = 0;
        updateServo();
    }

    function moveServoByDelta(deltaX = 0, deltaY = 0) {
        const minX = Number(servoX.min);
        const maxX = Number(servoX.max);
        const minY = Number(servoY.min);
        const maxY = Number(servoY.max);

        const currentX = Number(servoX.value);
        const currentY = Number(servoY.value);
        const nextX = Math.max(minX, Math.min(maxX, currentX + deltaX));
        const nextY = Math.max(minY, Math.min(maxY, currentY + deltaY));

        if (nextX === currentX && nextY === currentY) return;
        servoX.value = nextX;
        servoY.value = nextY;
        updateServo();
    }

    function applyCameraKeyMotion() {
        let deltaX = 0;
        let deltaY = 0;

        if (activeCameraKeys.has("a")) deltaX -= CAMERA_KEY_STEP;
        if (activeCameraKeys.has("d")) deltaX += CAMERA_KEY_STEP;
        if (activeCameraKeys.has("w")) deltaY += CAMERA_KEY_STEP;
        if (activeCameraKeys.has("s")) deltaY -= CAMERA_KEY_STEP;

        if (deltaX !== 0 || deltaY !== 0) {
            moveServoByDelta(deltaX, deltaY);
        }
    }

    function startCameraKeyLoop() {
        if (cameraKeyInterval) return;
        cameraKeyInterval = setInterval(applyCameraKeyMotion, CAMERA_KEY_INTERVAL_MS);
    }

    function stopCameraKeyLoopIfIdle() {
        if (activeCameraKeys.size === 0 && cameraKeyInterval) {
            clearInterval(cameraKeyInterval);
            cameraKeyInterval = null;
        }
    }

    servoX.addEventListener("input", updateServo);
    servoY.addEventListener("input", updateServo);

    homeButton.addEventListener("click", homeServos);

    document.addEventListener("keydown", (e) => {
        const key = e.key.toLowerCase();
        if (!["a", "d", "w", "s"].includes(key)) return;

        e.preventDefault();
        activeCameraKeys.add(key);
        applyCameraKeyMotion();
        startCameraKeyLoop();
    });

    document.addEventListener("keyup", (e) => {
        const key = e.key.toLowerCase();
        if (!["a", "d", "w", "s"].includes(key)) return;

        activeCameraKeys.delete(key);
        stopCameraKeyLoopIfIdle();
    });

    cameraImg.addEventListener("load", handleStreamFrameLoaded);

    setInterval(() => {
        cameraImg.src = `/stream.mjpg?${Date.now()}`;
    }, STREAM_REFRESH_MS);

    resolutionSelect.addEventListener("change", () => {
        const res = resolutionSelect.value;
        fetch(`/set_resolution/${res}`)
            .then((response) => response.text())
            .then((text) => {
                console.log(text);
                setTimeout(() => {
                    cameraImg.src = `/stream.mjpg?${Date.now()}`;
                }, 500);
            })
            .catch((err) => console.error(err));
    });

    homeServos();
}
