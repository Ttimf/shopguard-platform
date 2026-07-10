"""Проверка RTSP-соединения, захват кадра и авто-определение вендора (OpenCV/FFmpeg)."""
import time
import urllib.request
from urllib.parse import urlparse

import cv2

from . import settings


def open_capture(rtsp_url: str) -> cv2.VideoCapture:
    """
    Создаёт VideoCapture с явными таймаутами открытия/чтения и буфером 1.
    Таймауты задаются параметрами до открытия — чтобы не зависнуть на
    недоступной/зависшей камере (независимо от устаревшей ffmpeg 'stimeout').
    """
    cap = cv2.VideoCapture(
        rtsp_url,
        cv2.CAP_FFMPEG,
        [
            cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, settings.RTSP_OPEN_TIMEOUT_MS,
            cv2.CAP_PROP_READ_TIMEOUT_MSEC, settings.RTSP_READ_TIMEOUT_MS,
        ],
    )
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    return cap

# Сигнатуры производителей в пути RTSP-URL (нижний регистр).
_URL_VENDORS = [
    ("Hikvision", ["/streaming/channels", "/isapi", "/h264/ch"]),
    ("Dahua", ["/cam/realmonitor"]),
    ("Axis", ["/axis-media", "/mpeg4/media", "/onvif-media"]),
    ("Reolink", ["/h264preview", "/preview_"]),
    ("Uniview", ["/media/video", "/unicast/c"]),
    ("Amcrest", ["/cam/realmonitor"]),
]

# Сигнатуры в HTTP Server-заголовке камеры.
_SERVER_VENDORS = [
    ("hikvision", "Hikvision"),
    ("dvrdvs", "Hikvision"),
    ("dahua", "Dahua"),
    ("axis", "Axis"),
    ("reolink", "Reolink"),
    ("uniview", "Uniview"),
]


def detect_camera_info(rtsp_url: str, timeout: float = 3.0) -> dict:
    """
    Best-effort авто-определение производителя/модели камеры.
    Эвристика по пути RTSP + Server-заголовок HTTP. Если не удалось — None.
    """
    manufacturer: str | None = None
    model: str | None = None

    parsed = urlparse(rtsp_url)
    path = (parsed.path or "").lower()
    for vendor, sigs in _URL_VENDORS:
        if any(s in path for s in sigs):
            manufacturer = vendor
            break

    host = parsed.hostname
    if host:
        try:
            req = urllib.request.Request(f"http://{host}/", method="HEAD")
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                server = (resp.headers.get("Server") or "").strip()
                low = server.lower()
                for sig, vendor in _SERVER_VENDORS:
                    if sig in low:
                        manufacturer = vendor
                        break
                if server and model is None and manufacturer:
                    # часть камер кладут модель в Server (напр. "Hikvision-Webs")
                    model = server if server.lower() != manufacturer.lower() else None
        except Exception:  # noqa: BLE001 — камера может не иметь HTTP
            pass

    return {"manufacturer": manufacturer, "model": model}


def test_stream(rtsp_url: str, timeout: float = 10.0) -> dict:
    """Открывает поток, берёт первый кадр, меряет задержку/FPS/разрешение."""
    started = time.time()
    cap = open_capture(rtsp_url)
    try:
        ok, frame = cap.read()
        elapsed = time.time() - started
        if not ok or frame is None:
            error = "Timeout" if elapsed >= timeout else "RTSP stream unavailable"
            return {"online": False, "error": error}
        h, w = frame.shape[:2]
        fps = cap.get(cv2.CAP_PROP_FPS)
        fps = int(round(fps)) if fps and fps > 0 else _measure_fps(cap)
        return {
            "online": True,
            "latency": int(elapsed * 1000),
            "fps": fps,
            "resolution": f"{w}x{h}",
        }
    except Exception as e:  # noqa: BLE001
        return {"online": False, "error": f"RTSP stream unavailable: {e}"}
    finally:
        cap.release()


def _measure_fps(cap, frames: int = 10) -> int:
    started = time.time()
    read = 0
    for _ in range(frames):
        ok, _f = cap.read()
        if not ok:
            break
        read += 1
    dt = time.time() - started
    return int(round(read / dt)) if dt > 0 and read > 0 else 0


def encode_jpeg(frame) -> bytes | None:
    ok, buf = cv2.imencode(".jpg", frame)
    return buf.tobytes() if ok else None


def grab_frame(rtsp_url: str) -> bytes | None:
    """Одиночный кадр как JPEG (когда нет активного воркера)."""
    cap = open_capture(rtsp_url)
    try:
        ok, frame = cap.read()
        return encode_jpeg(frame) if ok and frame is not None else None
    finally:
        cap.release()
