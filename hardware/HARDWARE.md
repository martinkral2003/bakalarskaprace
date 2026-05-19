# Hardware documentation

## Replication checklist

1. Raspberry Pi with camera, I2C, and PWM capabilities enabled.
2. Wire four motor bridges to BCM pins in the table above.
3. Connect servos to hardware PWM0 and PWM1 (50 Hz).
4. Connect LED to GPIO 21 (with appropriate driver circuit).
5. Mount ICM-20948 on I2C bus 3, address 0x69.
6. Clone/copy this repository to the Pi, create `venv`, install Python packages (see root `README.md`).
7. Run `python3 app.py` and open `http://<pi-ip>:8000`.


## Compute platform

| Item | Detail |
|------|--------|
| Board | Raspberry Pi 5 |
| OS | Raspberry Pi OS (or compatible Linux with `picamera2`) |
| Network | Wi‑Fi / Ethernet; hostname `raspberrypi.local` |

## Architecture

| Layer | Technology |
|-------|------------|
| On-board computer | Raspberry Pi 5, 4GB (`raspberrypi.local`) |
| Backend | Python 3, Flask (`app.py`) |
| Frontend | HTML/CSS/JS in `templates/` and `static/` |
| Motors | `gpiozero.PWMOutputDevice` — 4 dual-channel H-bridge outputs |
| Camera servos | `rpi_hardware_pwm` — 2 servos on hardware PWM channels 0 and 1 |
| Camera | Raspberry Pi Camera (`picamera2`, MJPEG stream) |
| LED | `gpiozero.PWMLED` on GPIO 21 |
| IMU | ICM-20948 over I2C |