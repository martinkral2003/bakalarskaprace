import {getJSON} from "./api.js";

const LATENCY_INTERVAL_MS = 2000;

export function initLatencyWidget() {
    const statLatency = document.getElementById("stat-latency");
    if (!statLatency) return;

    let latencyValue = null;
    let requestInFlight = false;

    function renderLatency() {
        statLatency.textContent = latencyValue === null ? "--" : `${latencyValue}`;
    }

    function measureLatency() {
        if (requestInFlight) return;
        requestInFlight = true;

        const startTime = Date.now();

        getJSON("/latency")
            .then(() => {
                latencyValue = Date.now() - startTime;
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
