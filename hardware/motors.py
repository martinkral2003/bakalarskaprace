from gpiozero import PWMOutputDevice
import time
import threading

class MotorController:
    def __init__(self, pwm_freq=100):
        # Use PWMOutputDevice for speed control
        self.RR_A = PWMOutputDevice(4, frequency=pwm_freq)
        self.RR_B = PWMOutputDevice(27, frequency=pwm_freq)

        self.RL_A = PWMOutputDevice(24, frequency=pwm_freq)
        self.RL_B = PWMOutputDevice(23, frequency=pwm_freq)

        self.FR_A = PWMOutputDevice(17, frequency=pwm_freq)
        self.FR_B = PWMOutputDevice(22, frequency=pwm_freq)

        self.FL_A = PWMOutputDevice(5, frequency=pwm_freq)
        self.FL_B = PWMOutputDevice(6, frequency=pwm_freq)

        self.current_speed = 0.0      # 0.0 - 1.0
        self.target_speed = 0.0
        self.ramp_thread = None
        self.ramp_lock = threading.Lock()

        self.stop()

    # ---------- Basic motor control ----------
    def stop(self):
        self._set_all(0, 0)

    def forward(self, speed=1.0):
        self._start_ramp("forward", speed)

    def backward(self, speed=1.0):
        self._start_ramp("backward", speed)

    def left(self, speed=1.0):
        self._start_ramp("left", speed)

    def right(self, speed=1.0):
        self._start_ramp("right", speed)

    # ---------- Internal ramp handling ----------
    def _start_ramp(self, direction, speed):
        with self.ramp_lock:
            self.direction = direction
            self.target_speed = max(0.0, min(speed, 1.0))
            if self.ramp_thread is None or not self.ramp_thread.is_alive():
                self.ramp_thread = threading.Thread(target=self._ramp_loop, daemon=True)
                self.ramp_thread.start()

    def _ramp_loop(self):
        step = 0.05          # increase/decrease per iteration
        delay = 0.05         # 50 ms per step
        while abs(self.current_speed - self.target_speed) > 0.01:
            if self.current_speed < self.target_speed:
                self.current_speed += step
            elif self.current_speed > self.target_speed:
                self.current_speed -= step
            self.current_speed = max(0.0, min(1.0, self.current_speed))
            self._apply_direction(self.direction, self.current_speed)
            time.sleep(delay)
        # Apply final speed to avoid rounding issues
        self._apply_direction(self.direction, self.target_speed)

    # ---------- Apply PWM to pins based on direction ----------
    def _apply_direction(self, direction, speed):
        # Stop all first
        self._set_all(0, 0)
        if direction == "forward":
            self._set_all(0, speed)
        elif direction == "backward":
            self._set_all(speed, 0)
        elif direction == "left":
            # left turn: left wheels backward, right wheels forward
            self.RL_A.value = speed
            self.RL_B.value = 0
            self.FL_A.value = speed
            self.FL_B.value = 0
            self.RR_A.value = 0
            self.RR_B.value = speed
            self.FR_A.value = 0
            self.FR_B.value = speed
        elif direction == "right":
            # right turn: left wheels forward, right wheels backward
            self.RL_A.value = 0
            self.RL_B.value = speed
            self.FL_A.value = 0
            self.FL_B.value = speed
            self.RR_A.value = speed
            self.RR_B.value = 0
            self.FR_A.value = speed
            self.FR_B.value = 0

    def _set_all(self, low_value, high_value):
        # Apply PWM to each motor: (A, B)
        self.RR_A.value = low_value
        self.RR_B.value = high_value
        self.RL_A.value = low_value
        self.RL_B.value = high_value
        self.FR_A.value = low_value
        self.FR_B.value = high_value
        self.FL_A.value = low_value
        self.FL_B.value = high_value
