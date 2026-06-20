import {postJSON} from "./api.js";

const CAMERA_KEY_STEP = 2;
const CAMERA_KEY_INTERVAL_MS = 50;
const SERVO_SEND_MIN_INTERVAL_MS = 120;

// H.264 High Profile, Level 4.0 — matches picamera2's hardware encoder default.
// Try High → Main → Baseline in order so the browser picks what it supports.
const H264_CODEC_CANDIDATES = [
    'video/mp4; codecs="avc1.640028"',
    'video/mp4; codecs="avc1.4D401F"',
    'video/mp4; codecs="avc1.42E01E"',
];

function initH264Stream(video, statFps) {
    if (!('MediaSource' in window)) {
        console.warn('[camera] MSE not supported');
        return;
    }

    const mimeType = H264_CODEC_CANDIDATES.find(c => MediaSource.isTypeSupported(c));
    if (!mimeType) {
        console.warn('[camera] H.264 not supported in MSE');
        return;
    }

    const mediaSource = new MediaSource();
    video.src = URL.createObjectURL(mediaSource);

    mediaSource.addEventListener('sourceopen', () => {
        // Signal a live (unbounded) stream so the browser doesn't treat the
        // missing duration in the moov box as "finished at t=0".
        mediaSource.duration = Infinity;

        const sourceBuffer = mediaSource.addSourceBuffer(mimeType);
        const pending = [];
        let appending = false;

        function tryAppend() {
            if (appending || pending.length === 0 || sourceBuffer.updating) return;
            appending = true;
            try {
                sourceBuffer.appendBuffer(pending.shift());
            } catch (e) {
                appending = false;
                console.error('[camera] appendBuffer error', e);
            }
        }

        sourceBuffer.addEventListener('updateend', () => {
            appending = false;

            // Keep only the last 1 s in the buffer — less for the browser to
            // manage and discourages it from buffering far ahead.
            if (sourceBuffer.buffered.length > 0 && !sourceBuffer.updating) {
                const end = sourceBuffer.buffered.end(0);
                const start = sourceBuffer.buffered.start(0);
                if (end - start > 1) {
                    try { sourceBuffer.remove(start, end - 1); } catch (_) {}
                    return; // tryAppend will run on the remove's updateend
                }
            }

            tryAppend();
        });

        sourceBuffer.addEventListener('error', (e) => {
            console.error('[camera] SourceBuffer error', e);
            appending = false;
        });

        fetch('/stream.h264').then(response => {
            const reader = response.body.getReader();

            function pump() {
                reader.read().then(({ done, value }) => {
                    if (done) return;
                    // Slice to get an independent copy — some browsers reuse the
                    // underlying ArrayBuffer for the next read().
                    pending.push(value.buffer.slice(0));
                    tryAppend();
                    pump();
                }).catch(err => console.error('[camera] stream read error', err));
            }

            pump();
        }).catch(err => console.error('[camera] fetch error', err));
    });

    // Keep playhead within ~200 ms of the live edge.
    setInterval(() => {
        if (video.buffered.length === 0 || video.paused) return;
        const liveEdge = video.buffered.end(video.buffered.length - 1);
        if (liveEdge - video.currentTime > 0.5) {
            video.currentTime = liveEdge - 0.05;
        }
    }, 200);

    video.play().catch(() => {});

    // FPS counter via requestVideoFrameCallback (Chrome 83+, Safari 15.4+).
    if ('requestVideoFrameCallback' in video && statFps) {
        let frameCount = 0;
        let windowStart = performance.now();

        function onFrame() {
            frameCount++;
            const now = performance.now();
            const elapsed = now - windowStart;
            if (elapsed >= 1000) {
                statFps.textContent = ((frameCount * 1000) / elapsed).toFixed(1);
                frameCount = 0;
                windowStart = now;
            }
            video.requestVideoFrameCallback(onFrame);
        }

        video.requestVideoFrameCallback(onFrame);
    }
}

export function initCameraControls() {
    const servoX = document.getElementById("servo-x");
    const servoY = document.getElementById("servo-y");
    const homeButton = document.getElementById("home-camera");
    const resolutionSelect = document.getElementById("resolution");
    const video = document.getElementById("camera-stream");
    const statFps = document.getElementById("stat-fps");

    if (!servoX || !servoY || !homeButton || !resolutionSelect || !video) {
        return;
    }

    initH264Stream(video, statFps);

    const activeCameraKeys = new Set();
    let cameraKeyInterval = null;
    let servoRequestInFlight = false;
    let pendingServoPayload = null;
    let servoSendTimer = null;
    let lastServoSentAt = 0;

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

    resolutionSelect.addEventListener("change", () => {
        const res = resolutionSelect.value;
        fetch(`/set_resolution/${res}`)
            .then(r => r.text())
            .then(text => console.log(text))
            .catch(err => console.error(err));
    });

    homeServos();
}
