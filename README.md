# Sewer Inspection Robot — Web Control

A mobile robot controlled over a web browser. A Flask application runs on a Raspberry Pi; it streams camera video, drives motors, pans/tilts the camera with servos, dims an LED light, and overlays an artificial horizon using IMU data.

## Prereqs

- Raspberry Pi OS with Python 3
- Project directory on the Pi (e.g. `~/robot`) with this repository cloned or copied
- Python virtual environment with dependencies installed
- Enabled interfaces: camera, I2C, and hardware PWM as required by your wiring (see hardware doc)
- Robot hardware wired according to [hardware/HARDWARE.md](hardware/HARDWARE.md)

### Python dependencies

Install into the project virtual environment:
```bash
pip install flask gpiozero opencv-python-headless picamera2 smbus2 rpi-hardware-pwm
```

## Running the application

### 1. Connect to the Raspberry Pi

From your PC (same network as the robot):

```bash
ssh user@raspberrypi.local
```

### 2. Start the web server

```bash
cd ~/robot          # or your actual project path on the Pi
source venv/bin/activate
python3 app.py
```

The terminal prints the URLs you can open in a browser:

`http://<pi-ip-address>:8000` — from another device on the LAN 


### 4. Stop

Press `Ctrl+C` in the SSH session. Motors stop automatically if commands are not received for ~100 ms (safety watchdog in `app.py`).

## Project layout

```
app.py                 # Flask routes and hardware wiring
hardware/
  motors.py            # Drive motors (GPIO PWM)
  servos.py            # Camera servos (hardware PWM)
  camera.py            # Pi camera MJPEG stream
  light.py             # LED brightness
  imu.py               # ICM-20948 reader (background thread)
  HARDWARE.md          # Pinout, components, build notes
templates/index.html   # Web UI
static/js/             # Client logic (movement, camera, horizon, …)
```

## API (summary)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/` | GET | Web UI |
| `/motor` | POST | `{ "direction": "forward\|backward\|left\|right\|stop", "speed": 0–100 }` |
| `/servo` | POST | `{ "x": angle, "y": angle }` (degrees, clamped in firmware) |
| `/light` | POST | `{ "value": 0–100 }` brightness |
| `/imu` | GET | `{ "pitch", "roll" }` in degrees |
| `/latency` | GET | Timestamp for round-trip measurement |
| `/stream.mjpg` | GET | MJPEG video stream |
| `/set_resolution/<w>x<h>` | GET | Change camera resolution |


## Further reading

- **[hardware/HARDWARE.md](hardware/HARDWARE.md)**
