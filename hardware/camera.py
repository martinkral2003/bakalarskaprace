
import cv2
import queue
import subprocess
import threading
from picamera2 import Picamera2
from picamera2.encoders import H264Encoder
from picamera2.outputs import Output
from libcamera import Transform


class _QueueOutput(Output):
    """Receives H264 NAL units from picamera2 and puts them on a queue."""
    def __init__(self):
        super().__init__()
        self.queue = queue.Queue(maxsize=60)

    def outputframe(self, frame, keyframe=True, timestamp=None, packet=None, audio=None):
        self.queue.put(bytes(frame))


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
    # H.264 fMP4 Stream Generator
    # -----------------------------
    def generate_h264_stream(self):
        h264_out = _QueueOutput()

        ffmpeg = subprocess.Popen(
            [
                "ffmpeg", "-loglevel", "error",
                "-f", "h264", "-i", "pipe:0",
                "-c:v", "copy",
                "-f", "mp4",
                "-movflags", "frag_keyframe+empty_moov+default_base_moof",
                "pipe:1",
            ],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
        )

        def _feed_ffmpeg():
            try:
                while True:
                    try:
                        data = h264_out.queue.get(timeout=1.0)
                        if data is None:
                            break
                        ffmpeg.stdin.write(data)
                        ffmpeg.stdin.flush()
                    except queue.Empty:
                        continue
                    except BrokenPipeError:
                        break
            finally:
                try:
                    ffmpeg.stdin.close()
                except Exception:
                    pass

        feeder = threading.Thread(target=_feed_ffmpeg, daemon=True)
        feeder.start()

        with self.lock:
            self.picam2.stop()
            encoder = H264Encoder(bitrate=2_000_000)
            self.picam2.start_recording(encoder, h264_out)

        try:
            while True:
                chunk = ffmpeg.stdout.read(16384)
                if not chunk:
                    break
                yield chunk
        finally:
            h264_out.queue.put(None)
            self.picam2.stop_recording()
            ffmpeg.terminate()
            ffmpeg.wait()
            feeder.join(timeout=2.0)
            with self.lock:
                self.picam2.start()

    # -----------------------------
    # Resolution Change
    # -----------------------------
    def set_resolution(self, width, height):
        with self.lock:
            self.resolution = (int(width), int(height))
            self.picam2.stop()
            self._configure_camera()
            self.picam2.start()

    # -----------------------------
    # Stop Camera (optional cleanup)
    # -----------------------------
    def stop(self):
        with self.lock:
            self.picam2.stop()
