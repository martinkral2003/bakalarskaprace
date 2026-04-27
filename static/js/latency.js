import {getJSON} from "./api.js";

const LATENCY_INTERVAL_MS = 2000;

export function initLatencyWidget() {
    const statLatency = document.getElementById("stat-latency");
    const statCameraLatency = document.getElementById("stat-camera-latency");
    if (!statLatency && !statCameraLatency) return;

    let latencyValue = null;
    let cameraLatencyValue = null;
    let requestInFlight = false;

    function renderLatency() {
        if (statLatency) {
            statLatency.textContent = latencyValue === null ? "--" : `${latencyValue}`;
        }
        if (statCameraLatency) {
            statCameraLatency.textContent = cameraLatencyValue === null ? "--" : `${cameraLatencyValue}`;
        }
    }

    function measureLatency() {
        if (requestInFlight) return;
        requestInFlight = true;

        const startTime = Date.now();

        Promise.allSettled([
            getJSON("/latency"),
            getJSON("/camera_latency")
        ])
            .then(([browserLatencyResult, cameraLatencyResult]) => {
                if (browserLatencyResult.status === "fulfilled") {
                    latencyValue = Date.now() - startTime;
                }

                if (cameraLatencyResult.status === "fulfilled") {
                    const age = Number(cameraLatencyResult.value.age_ms);
                    cameraLatencyValue = Number.isFinite(age) ? age : null;
                }

                renderLatency();
            })
            .catch((err) => console.error("Latency measurement failed:", err))
            .finally(() => {
                requestInFlight = false;
            });
    }

    setInterval(measureLatency, LATENCY_INTERVAL_MS);
    measureLatency();
}
