import smbus2
import time
import math
import threading
from collections import deque

# -----------------------------
# CONFIG
# -----------------------------
I2C_BUS = 3            # your custom bus
ICM_ADDR = 0x69        # ICM-20948
ACC_RANGE = 2          # ±2g
GYRO_RANGE = 250       # ±250°/s
SAMPLES = 200          # for calibration

bus = smbus2.SMBus(I2C_BUS)

# Global IMU data
imu_data = {"pitch": 0.0, "roll": 0.0, "yaw": 0.0}
imu_lock = threading.Lock()

# Moving average filter for smoothing
pitch_buffer = deque(maxlen=10)  # Keep last 10 pitch values
roll_buffer = deque(maxlen=10)   # Keep last 10 roll values

# ICM20948 registers
ICM_PWR_MGMT_1    = 0x06
ICM_ACCEL_XOUT_H  = 0x2D
ICM_GYRO_XOUT_H   = 0x33
ICM_CHIP_ID       = 0x00

# -----------------------------
# HELPER FUNCTIONS
# -----------------------------
def read16(addr, reg):
    """Read signed 16-bit value from I2C"""
    high = bus.read_byte_data(addr, reg)
    low  = bus.read_byte_data(addr, reg+1)
    val = (high << 8) | low
    if val > 32767:
        val -= 65536
    return val

def convert_acc(raw):
    """Convert raw accel to m/s²"""
    return raw * (ACC_RANGE / 32768.0) * 9.80665

def convert_gyro(raw):
    """Convert raw gyro to °/s"""
    return raw * (GYRO_RANGE / 32768.0)

# -----------------------------
# INITIALIZE SENSOR
# -----------------------------
try:
    bus.write_byte_data(ICM_ADDR, ICM_PWR_MGMT_1, 0x01)  # wake up
    time.sleep(0.1)
except Exception as e:
    print("Error initializing ICM20948:", e)
    exit(1)

chip_id = bus.read_byte_data(ICM_ADDR, ICM_CHIP_ID)
print(f"ICM20948 detected! Chip ID: 0x{chip_id:X}\n")

# -----------------------------
# CALIBRATE GYRO & ACCEL OFFSETS
# -----------------------------
gx_offset = gy_offset = gz_offset = 0
ax_offset = ay_offset = 0
print("Calibrating sensors... keep robot perfectly still")
for _ in range(SAMPLES):
    # gyro
    gx_offset += read16(ICM_ADDR, ICM_GYRO_XOUT_H)
    gy_offset += read16(ICM_ADDR, ICM_GYRO_XOUT_H + 2)
    gz_offset += read16(ICM_ADDR, ICM_GYRO_XOUT_H + 4)
    # accel
    ax_offset += read16(ICM_ADDR, ICM_ACCEL_XOUT_H)
    ay_offset += read16(ICM_ADDR, ICM_ACCEL_XOUT_H + 2)
    time.sleep(0.01)

gx_offset /= SAMPLES
gy_offset /= SAMPLES
gz_offset /= SAMPLES
ax_offset /= SAMPLES
ay_offset /= SAMPLES

print(f"Offsets -> gyro: gx={gx_offset:.2f}, gy={gy_offset:.2f}, gz={gz_offset:.2f}")
print(f"Offsets -> accel: ax={ax_offset:.2f}, ay={ay_offset:.2f}\n")

# Helper function to get current pitch
def get_imu_pitch():
    """Return current pitch in degrees"""
    with imu_lock:
        return imu_data["pitch"]

def get_imu_data():
    """Return current IMU data"""
    with imu_lock:
        return imu_data.copy()

# Start IMU reading in background thread
def read_imu_loop():
    """Background thread to continuously read IMU"""
    global imu_data
    
    while True:
        try:
            # read accelerometer
            ax_raw = read16(ICM_ADDR, ICM_ACCEL_XOUT_H) - ax_offset
            ay_raw = read16(ICM_ADDR, ICM_ACCEL_XOUT_H + 2) - ay_offset
            az_raw = read16(ICM_ADDR, ICM_ACCEL_XOUT_H + 4)  # Z not zeroed

            ax = convert_acc(ax_raw)
            ay = convert_acc(ay_raw)
            az = convert_acc(az_raw)

            # read gyro
            gx = convert_gyro(read16(ICM_ADDR, ICM_GYRO_XOUT_H) - gx_offset)
            gy = convert_gyro(read16(ICM_ADDR, ICM_GYRO_XOUT_H + 2) - gy_offset)
            gz = convert_gyro(read16(ICM_ADDR, ICM_GYRO_XOUT_H + 4) - gz_offset)

            # compute roll/pitch (degrees)
            roll  = math.degrees(math.atan2(-ay, az))  # Negated ay to fix left/right reversal
            pitch = math.degrees(math.atan2(-ax, math.sqrt(ay*ay + az*az)))

            # Apply moving average filter for smoothing
            pitch_buffer.append(pitch)
            roll_buffer.append(roll)
            
            smoothed_pitch = sum(pitch_buffer) / len(pitch_buffer)
            smoothed_roll = sum(roll_buffer) / len(roll_buffer)

            # Update global data with smoothed values
            with imu_lock:
                imu_data["pitch"] = smoothed_pitch
                imu_data["roll"] = smoothed_roll
                imu_data["gx"] = gx
                imu_data["gy"] = gy
                imu_data["gz"] = gz

            time.sleep(0.05)  # 20 Hz update rate

        except KeyboardInterrupt:
            print("IMU reader exiting...")
            break
        except Exception as e:
            print("Error reading sensor:", e)
            time.sleep(0.1)

# Start the thread
imu_thread = threading.Thread(target=read_imu_loop, daemon=True)
imu_thread.start()