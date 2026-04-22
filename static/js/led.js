import {postJSON} from "./api.js";

export function initLedControls() {
    const ledSlider = document.getElementById("led-brightness");
    const ledToggle = document.getElementById("led-toggle");
    if (!ledSlider || !ledToggle) return;

    // Hardware starts with LED off, keep UI state aligned.
    let ledOn = false;

    function setLED(value) {
        postJSON("/light", {value});
    }

    function renderToggleLabel() {
        ledToggle.textContent = ledOn ? "Turn LED Off" : "Turn LED On";
    }

    ledSlider.addEventListener("input", () => {
        if (ledOn) setLED(ledSlider.value);
    });

    ledToggle.addEventListener("click", () => {
        ledOn = !ledOn;
        setLED(ledOn ? ledSlider.value : 0);
        renderToggleLabel();
    });

    renderToggleLabel();
}
