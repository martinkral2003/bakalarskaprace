import {postJSON} from "./api.js";

export function initLedControls() {
    const ledSlider = document.getElementById("led-brightness");
    const ledToggle = document.getElementById("led-toggle");
    if (!ledSlider || !ledToggle) return;

    let ledOn = true;

    function setLED(value) {
        postJSON("/light", {value});
    }

    ledSlider.addEventListener("input", () => setLED(ledSlider.value));
    ledToggle.addEventListener("click", () => {
        ledOn = !ledOn;
        setLED(ledOn ? ledSlider.value : 0);
    });
}
