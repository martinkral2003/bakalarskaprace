import {getJSON} from "./api.js";

const IMU_INTERVAL_MS = 500;

export function initHorizonOverlay() {
    const canvas = document.getElementById("horizon-overlay");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let imuPitch = 0;
    let imuRoll = 0;

    function drawHorizon() {
        const width = canvas.width;
        const height = canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) * 0.35;

        ctx.clearRect(0, 0, width, height);

        const invertedPitch = -imuPitch;
        const displayRoll = imuRoll;

        const maxPitch = 90;
        const maxRoll = 90;
        const clampedPitch = Math.max(-maxPitch, Math.min(maxPitch, invertedPitch));
        const clampedRoll = Math.max(-maxRoll, Math.min(maxRoll, displayRoll));

        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.clip();

        ctx.translate(centerX, centerY);
        ctx.rotate((clampedRoll * Math.PI) / 180);

        const horizonY = (clampedPitch / maxPitch) * radius;

        ctx.fillStyle = "#87CEEB";
        ctx.beginPath();
        ctx.moveTo(-radius * 1.5, -radius * 1.5);
        ctx.lineTo(radius * 1.5, -radius * 1.5);
        ctx.lineTo(radius * 1.5, horizonY);
        ctx.lineTo(-radius * 1.5, horizonY);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#8B4513";
        ctx.beginPath();
        ctx.moveTo(-radius * 1.5, horizonY);
        ctx.lineTo(radius * 1.5, horizonY);
        ctx.lineTo(radius * 1.5, radius * 1.5);
        ctx.lineTo(-radius * 1.5, radius * 1.5);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-radius * 1.5, horizonY);
        ctx.lineTo(radius * 1.5, horizonY);
        ctx.stroke();

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

        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "#FFFF00";
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(centerX - radius * 0.25, centerY);
        ctx.lineTo(centerX - radius * 0.1, centerY);
        ctx.moveTo(centerX + radius * 0.1, centerY);
        ctx.lineTo(centerX + radius * 0.25, centerY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(centerX, centerY - radius * 0.05);
        ctx.lineTo(centerX, centerY + radius * 0.05);
        ctx.stroke();

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

        ctx.strokeStyle = "#FFFF00";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - radius - 16);
        ctx.lineTo(centerX - 4, centerY - radius - 10);
        ctx.lineTo(centerX + 4, centerY - radius - 10);
        ctx.closePath();
        ctx.fill();
    }

    function resizeCanvas() {
        const isMobileOrTablet = window.matchMedia("(max-width: 1024px)").matches;
        const overlaySize = isMobileOrTablet ? 150 : 300;
        canvas.width = overlaySize;
        canvas.height = overlaySize;
        drawHorizon();
    }

    function fetchIMUData() {
        getJSON("/imu")
            .then((data) => {
                imuPitch = parseFloat(data.pitch) || 0;
                imuRoll = parseFloat(data.roll) || 0;
                drawHorizon();
            })
            .catch((err) => console.error("Error fetching IMU:", err));
    }

    window.addEventListener("resize", resizeCanvas);
    setInterval(fetchIMUData, IMU_INTERVAL_MS);
    resizeCanvas();
    fetchIMUData();
}
