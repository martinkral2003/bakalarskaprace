from rpi_hardware_pwm import HardwarePWM

class ServoController:

    def __init__(self):
        self.MIN_ANGLE_X = -120
        self.MAX_ANGLE_X = 120
        self.MIN_ANGLE_Y = -60
        self.MAX_ANGLE_Y = 120

        self.servo_x = HardwarePWM(0, 50)
        self.servo_y = HardwarePWM(1, 50)

        self.angle_x = 0
        self.angle_y = 0

        self.servo_x.start(self.angle_to_duty(0))
        self.servo_y.start(self.angle_to_duty(0))

    def angle_to_duty(self, angle):
        pulse_ms = 1.5 + (angle / 120) * 1.0
        return pulse_ms / 20 * 100

    def set_x(self, angle):
        self.angle_x = max(self.MIN_ANGLE_X, min(self.MAX_ANGLE_X, angle))
        self.servo_x.change_duty_cycle(self.angle_to_duty(self.angle_x))

    def set_y(self, angle):
        self.angle_y = max(self.MIN_ANGLE_Y, min(self.MAX_ANGLE_Y, angle))
        self.servo_y.change_duty_cycle(self.angle_to_duty(self.angle_y))