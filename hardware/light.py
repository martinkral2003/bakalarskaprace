from gpiozero import PWMLED

class LightController:

    def __init__(self, pin=21):
        self.led = PWMLED(pin)
        self.led.value = 0  # Start with light off

    def set_brightness(self, value):
        # value: 0–100
        self.led.value = max(0, min(100, value)) / 100