from flask import Flask, Response, render_template, request
from hardware.motors import MotorController
from hardware.servos import ServoController
from hardware.light import LightController
from hardware.camera import CameraController
from hardware import imu
import time
import threading

app = Flask(__name__)

motors = MotorController()
last_command_time = time.time()
TIMEOUT = 0.1  # stop if no command received for 200 ms

servos = ServoController()
light = LightController()
camera = CameraController()


# ---------- UI ----------
@app.route("/")
def index():
    return render_template("index.html")


# ---------- MOTOR API ----------

@app.route("/motor", methods=["POST"])
def motor_control():
    global last_command_time

    data = request.json
    direction = data.get("direction")
    speed_percent = float(data.get("speed", 100))

    # Convert 0–100 → 0.0–1.0
    speed = max(0.0, min(speed_percent / 100.0, 1.0))

    last_command_time = time.time()  # Reset watchdog timer

    if direction == "stop":
        motors.stop()
    elif direction == "forward":
        motors.forward(speed)
    elif direction == "backward":
        motors.backward(speed)
    elif direction == "left":
        motors.left(speed)
    elif direction == "right":
        motors.right(speed)

    return "", 200

def safety_watchdog():
    global last_command_time

    while True:
        time.sleep(0.1)
        if time.time() - last_command_time > TIMEOUT:
            motors.stop()
threading.Thread(target=safety_watchdog, daemon=True).start()

# ---------- SERVO API ----------

@app.route("/servo", methods=["POST"])
def servo():
    x = request.json.get("x")
    y = request.json.get("y")

    if x is not None:
        servos.set_x(int(x))
    if y is not None:
        servos.set_y(int(y))

    return {"status": "ok"}


# ---------- IMU API ----------

@app.route("/imu")
def get_imu():
    """Get current IMU data (pitch, roll)"""
    data = imu.get_imu_data()
    return {
        "pitch": data.get("pitch", 0.0),
        "roll": data.get("roll", 0.0)
    }


# ---------- LIGHT API ----------

@app.route("/light", methods=["POST"])
def light_control():
    brightness = request.json.get("value")
    light.set_brightness(int(brightness))
    return {"status": "ok"}


# ---------- PING API ----------

@app.route("/ping")
def ping():
    """Simple ping endpoint for latency measurement"""
    return {"timestamp": int(time.time() * 1000)}


# ---------- STREAM ----------

@app.route("/stream.mjpg")
def stream():
    return Response(
        camera.generate_stream(),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )


# ---------- CAMERA RESOLUTION ----------

@app.route('/set_resolution/<int:w>x<int:h>')
def set_res(w, h):
    camera.set_resolution(w, h)
    return f"Resolution set to {w}x{h}"


app.run(host="0.0.0.0", port=8000)
