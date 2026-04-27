
import cv2
import threading
from picamera2 import Picamera2
from libcamera import Transform


class CameraController:
    def __init__(self, resolution=(1280, 720), jpeg_quality=50, rotate=True):
        self.picam2 = Picamera2()
        self.lock = threading.Lock()

        self.resolution = resolution
        self.jpeg_quality = jpeg_quality
        self.rotate = rotate

        self._configure_camera()
        self.picam2.start()

    # -----------------------------
    # Internal camera configuration
    # -----------------------------
    def _configure_camera(self):
        transform = Transform(hflip=True, vflip=True) if self.rotate else Transform()

        config = self.picam2.create_video_configuration(
            # Request BGR frames directly so we can JPEG-encode without
            # per-frame color conversion overhead.
            main={"size": self.resolution, "format": "BGR888"},
            transform=transform
        )

        self.picam2.configure(config)

    # -----------------------------
    # MJPEG Stream Generator
    # -----------------------------
    def generate_stream(self):
        while True:
            with self.lock:
                frame = self.picam2.capture_array()

            encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), self.jpeg_quality]
            _, buffer = cv2.imencode(".jpg", frame, encode_param)

            yield (b"--frame\r\n"
                   b"Content-Type: image/jpeg\r\n\r\n" +
                   buffer.tobytes() +
                   b"\r\n")

    # -----------------------------
    # Resolution Change
    # -----------------------------
    def set_resolution(self, width, height):
        with self.lock:
            self.resolution = (int(width), int(height))
            self.picam2.stop()
            self._configure_camera()
            self.picam2.start()

    # -------------- & Total Frame Count
    # Stop Camera (optional cleanup)
    # -----------------------------
    def stop(self):
        with self.lock:
            self.picam2.stop()