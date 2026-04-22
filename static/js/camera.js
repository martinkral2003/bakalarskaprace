import {postJSON} from "./api.js";

const CAMERA_KEY_STEP = 2;
const CAMERA_KEY_INTERVAL_MS = 50;
const STREAM_REFRESH_MS = 3000;

export function initCameraControls() {
    const servoX = document.getElementById("servo-x");
    const servoY = document.getElementById("servo-y");
    const homeButton = document.getElementById("home-camera");
    const resolutionSelect = document.getElementById("resolution");
    const cameraImg = document.getElementById("camera-stream");

    if (!servoX || !servoY || !homeButton || !resolutionSelect || !cameraImg) {
        return;
    }

    const activeCameraKeys = new Set();
    let cameraKeyInterval = null;

    function updateServo() {
        postJSON("/servo", {
            x: -Number(servoX.value),
            y: -Number(servoY.value)
        });
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
        if (activeCameraKeys.has("w")) deltaY -= CAMERA_KEY_STEP;
        if (activeCameraKeys.has("s")) deltaY += CAMERA_KEY_STEP;

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

    homeButton.addEventListener("click", () => {
        servoX.value = 0;
        servoY.value = 30;
        updateServo();
    });

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
}
