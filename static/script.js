// ----- Motor Control -----
let speed = 0;
const maxSpeed = 100; // max speed %
const rampStep = 5;   // speed increase per 50ms
let currentDir = null;
let rampInterval = null;
let isButtonHeld = false;

function sendCommand(dir, speedVal = null) {
    fetch('/motor', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({direction: dir, speed: speedVal})
    });
}

// Keyboard arrows
document.addEventListener('keydown', e => {
    let dir = null;
    switch(e.key) {
        case "ArrowUp": dir = "forward"; break;
        case "ArrowDown": dir = "backward"; break;
        case "ArrowLeft": dir = "left"; break;
        case "ArrowRight": dir = "right"; break;
    }
    if (dir) startMovement(dir);
});

document.addEventListener('keyup', stopMovement);

function startMovement(dir) {
    if (currentDir === dir) return; // already moving
    stopMovement(); // reset previous movement

    currentDir = dir;
    speed = 50;

    rampInterval = setInterval(() => {
        if (speed < maxSpeed) speed += rampStep;
        sendCommand(currentDir, speed);
    }, 50); // ramp every 50ms
}

function stopMovement() {
    if (rampInterval) clearInterval(rampInterval);
    speed = 0;
    if (currentDir) sendCommand('stop', 0);
    currentDir = null;
}

// Desktop movement buttons
const desktopButtons = {
    'btn-forward-desktop': 'forward',
    'btn-backward-desktop': 'backward',
    'btn-left-desktop': 'left',
    'btn-right-desktop': 'right'
};

Object.entries(desktopButtons).forEach(([btnId, dir]) => {
    const btn = document.getElementById(btnId);
    if (btn) {
        btn.addEventListener('mousedown', () => startMovement(dir));
        btn.addEventListener('mouseup', stopMovement);
        btn.addEventListener('mouseleave', stopMovement);
    }
});

// Mobile movement buttons (d-pad)
const mobileButtons = {
    'btn-forward': 'forward',
    'btn-backward': 'backward',
    'btn-left': 'left',
    'btn-right': 'right'
};

Object.entries(mobileButtons).forEach(([btnId, dir]) => {
    const btn = document.getElementById(btnId);
    if (btn) {
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startMovement(dir);
        }, {passive: false});
        btn.addEventListener('touchend', stopMovement, {passive: false});
        btn.addEventListener('mousedown', () => startMovement(dir));
        btn.addEventListener('mouseup', stopMovement);
        btn.addEventListener('mouseleave', stopMovement);
    }
});

// Stop button
const stopBtn = document.getElementById('btn-stop');
if (stopBtn) {
    stopBtn.addEventListener('click', stopMovement);
    stopBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        stopMovement();
    }, {passive: false});
}



// ----- Ping Measurement -----
let pingValue = 0;

function measurePing() {
    const startTime = Date.now();
    
    fetch("/ping")
        .then(response => response.json())
        .then(() => {
            pingValue = Date.now() - startTime;
        })
        .catch(err => console.error("Ping failed:", err));
}

// Measure ping every 2 seconds
setInterval(measurePing, 2000);
measurePing(); // Initial measurement
const servoX = document.getElementById("servo-x");
const servoY = document.getElementById("servo-y");
const canvas = document.getElementById("horizon-overlay");
const ctx = canvas.getContext("2d");
const videoContainer = document.getElementById("video-container");
const cameraStream = document.getElementById("camera-stream");

// FPS tracking removed - was causing performance issues
// The onload event on every frame was too expensive

// IMU data
let imuPitch = 0;
let imuRoll = 0;

// Fetch IMU data periodically
function fetchIMUData() {
    fetch("/imu")
        .then(response => response.json())
        .then(data => {
            imuPitch = parseFloat(data.pitch) || 0;
            imuRoll = parseFloat(data.roll) || 0;
            drawHorizon();
            updateStats();
        })
        .catch(err => console.error("Error fetching IMU:", err));
}

setInterval(fetchIMUData, 500);
fetchIMUData();

// Update stats in control panel
function updateStats() {
    const statPitch = document.getElementById("stat-pitch");
    const statRoll = document.getElementById("stat-roll");
    const statIncline = document.getElementById("stat-incline");
    
    if (statPitch) statPitch.textContent = (-imuPitch).toFixed(1) + "°";
    if (statRoll) statRoll.textContent = (-imuRoll).toFixed(1) + "°";
    
    if (statIncline) {
        let status = "LEVEL";
        if (Math.abs(imuRoll) > 2) {
            status = imuRoll > 0 ? "LEFT HIGHER ↑" : "RIGHT HIGHER ↑";
        }
        statIncline.textContent = status;
    }
}

// Setup canvas to fill container
function resizeCanvas() {
    canvas.width = 300;
    canvas.height = 300;
    drawHorizon();
}

// Draw attitude indicator (artificial horizon)
function drawHorizon() {
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.35;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Get IMU pitch/roll (robot is at 0,0 when calibrated at startup)
    const invertedPitch = -imuPitch;
    const invertedRoll = -imuRoll;

    // Clamp values
    const maxPitch = 90;
    const maxRoll = 90;
    const clampedPitch = Math.max(-maxPitch, Math.min(maxPitch, invertedPitch));
    const clampedRoll = Math.max(-maxRoll, Math.min(maxRoll, invertedRoll));

    // Save context
    ctx.save();

    // Set up clipping region (circle)
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.clip();

    // Move to center and rotate based on roll
    ctx.translate(centerX, centerY);
    ctx.rotate((clampedRoll * Math.PI) / 180);

    // Calculate horizon position based on pitch
    const horizonY = (clampedPitch / maxPitch) * radius;

    // Draw sky (blue) - extends based on pitch
    ctx.fillStyle = "#87CEEB";
    ctx.beginPath();
    ctx.moveTo(-radius * 1.5, -radius * 1.5);
    ctx.lineTo(radius * 1.5, -radius * 1.5);
    ctx.lineTo(radius * 1.5, horizonY);
    ctx.lineTo(-radius * 1.5, horizonY);
    ctx.closePath();
    ctx.fill();

    // Draw ground (brown) - extends based on pitch
    ctx.fillStyle = "#8B4513";
    ctx.beginPath();
    ctx.moveTo(-radius * 1.5, horizonY);
    ctx.lineTo(radius * 1.5, horizonY);
    ctx.lineTo(radius * 1.5, radius * 1.5);
    ctx.lineTo(-radius * 1.5, radius * 1.5);
    ctx.closePath();
    ctx.fill();

    // Draw horizon line
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-radius * 1.5, horizonY);
    ctx.lineTo(radius * 1.5, horizonY);
    ctx.stroke();

    // Draw pitch ladder (reference lines)
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 1;

    for (let pitch = -80; pitch <= 80; pitch += 10) {
        if (pitch === 0) continue;

        const y = (pitch / maxPitch) * radius;
        const lineLength = pitch % 20 === 0 ? radius * 0.6 : radius * 0.3;

        ctx.beginPath();
        ctx.moveTo(-lineLength, y);
        ctx.lineTo(lineLength, y);
        ctx.stroke();

        if (pitch % 20 === 0 && Math.abs(pitch) <= 60) {
            ctx.fillStyle = "#FFFFFF";
            ctx.font = "11px Arial";
            ctx.textAlign = "center";
            ctx.fillText(Math.abs(pitch).toString(), lineLength + 12, y + 3);
            ctx.fillText(Math.abs(pitch).toString(), -lineLength - 12, y + 3);
        }
    }

    ctx.restore();

    // Draw outer circle border
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Draw fixed aircraft reference symbol (center, outside clip)
    ctx.strokeStyle = "#FFFF00";
    ctx.lineWidth = 2;

    // Aircraft wings
    ctx.beginPath();
    ctx.moveTo(centerX - radius * 0.25, centerY);
    ctx.lineTo(centerX - radius * 0.1, centerY);
    ctx.moveTo(centerX + radius * 0.1, centerY);
    ctx.lineTo(centerX + radius * 0.25, centerY);
    ctx.stroke();

    // Aircraft body
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - radius * 0.05);
    ctx.lineTo(centerX, centerY + radius * 0.05);
    ctx.stroke();

    // Draw roll indicator marks
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 1;
    for (let angle = 0; angle < 360; angle += 30) {
        const rad = (angle * Math.PI) / 180;
        const innerR = radius + 8;
        const outerR = radius + 14;
        const x1 = centerX + Math.sin(rad) * innerR;
        const y1 = centerY - Math.cos(rad) * innerR;
        const x2 = centerX + Math.sin(rad) * outerR;
        const y2 = centerY - Math.cos(rad) * outerR;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }

    // Draw roll pointer (top)
    ctx.strokeStyle = "#FFFF00";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - radius - 16);
    ctx.lineTo(centerX - 4, centerY - radius - 10);
    ctx.lineTo(centerX + 4, centerY - radius - 10);
    ctx.closePath();
    ctx.fill();

    updateStats();
}

servoX.addEventListener("input", () => updateServo());
servoY.addEventListener("input", () => updateServo());

function updateServo(){
    fetch("/servo", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({x: -servoX.value, y: servoY.value})
    });
}

document.getElementById("home-camera").addEventListener("click", () => {
    servoX.value = 0;
    servoY.value = 30;
    updateServo();
    drawHorizon();
});

// ----- LED Control -----
const ledSlider = document.getElementById("led-brightness");
const ledToggle = document.getElementById("led-toggle");
let ledOn = true;

ledSlider.addEventListener("input", () => setLED(ledSlider.value));
ledToggle.addEventListener("click", () => {
    ledOn = !ledOn;
    setLED(ledOn ? ledSlider.value : 0);
});

function setLED(value){
    fetch("/light", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({value: value})
    });
}

// ----- Camera Control -----
const select = document.getElementById('resolution');
const cameraImg = document.getElementById('camera-stream');

// Periodically refresh stream to prevent buffering delay
// (MJPEG browsers buffer frames; forcing new connection skips old frames)
setInterval(() => {
    cameraImg.src = '/stream.mjpg?' + Date.now();
}, 3000);  // Refresh every 3 seconds

select.addEventListener('change', () => {
    const res = select.value;
    fetch(`/set_resolution/${res}`)
        .then(response => response.text())
        .then(text => {
            console.log(text);
            // Reload the stream to see the resolution change
            setTimeout(() => {
                cameraImg.src = '/stream.mjpg?' + Date.now();
            }, 500);  // Wait 500ms for camera to reconfigure
        })
        .catch(err => console.error(err));
});


// ----- Horizon Overlay Initialization -----
window.addEventListener('load', () => {
    resizeCanvas();
    fetchIMUData();
});
document.addEventListener('DOMContentLoaded', () => {
    resizeCanvas();
    fetchIMUData();
});
resizeCanvas();
