"""Local U2NetP removal. Image bytes stay on your server; no image API calls."""
import sys
import onnxruntime as ort
ort.disable_telemetry_events()
from rembg import remove, new_session
image = sys.stdin.buffer.read(24 * 1024 * 1024)
session = new_session('u2netp')
sys.stdout.buffer.write(remove(image, session=session))
