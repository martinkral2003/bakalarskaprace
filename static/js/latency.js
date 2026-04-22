import {getJSON} from "./api.js";

const LATENCY_INTERVAL_MS = 2000;

export function initLatencyWidget() {
    const statLatency = document.getElementById("stat-latency");
    if (!statLatency) return;

    let latencyValue = 0;

    function renderLatency() {
        statLatency.textContent = `${latencyValue}`;
    }

    function measureLatency() {
        const startTime = Date.now();

        getJSON("/latency")
            .then(() => {
                latencyValue = Date.now() - startTime;
                renderLatency();
            })
            .catch((err) => console.error("Latency measurement failed:", err));
    }

    setInterval(measureLatency, LATENCY_INTERVAL_MS);
    measureLatency();
}
