"""Конфигурация ai-detection из переменных окружения."""
import os

# Таймаут открытия RTSP (ffmpeg): TCP-транспорт + stimeout (мкс) — чтобы
# тест/воркер не висли на недоступной камере. Читается cv2 при VideoCapture.
os.environ.setdefault(
    "OPENCV_FFMPEG_CAPTURE_OPTIONS",
    "rtsp_transport;tcp|stimeout;10000000",
)


def _int(name: str, default: int) -> int:
    return int(os.getenv(name, str(default)))


def _float(name: str, default: float) -> float:
    return float(os.getenv(name, str(default)))


def _bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).lower() in ("1", "true", "yes", "on")


# --- Redis ---
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = _int("REDIS_PORT", 6379)
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD") or None

# Опциональный TLS для Redis (напр. при подключении удалённого воркера без VPN).
# По умолчанию ВЫКЛ — обратная совместимость (VPN шифрует транспорт сам).
# REDIS_TLS_INSECURE — не проверять сертификат (self-signed).
REDIS_TLS = _bool("REDIS_TLS", False)
REDIS_TLS_INSECURE = _bool("REDIS_TLS_INSECURE", False)
REDIS_SSL_KWARGS = (
    {"ssl": True, "ssl_cert_reqs": "none" if REDIS_TLS_INSECURE else "required"}
    if REDIS_TLS
    else {}
)

# --- HTTP health ---
HTTP_PORT = _int("PORT", 8000)

# --- A/B тестирование моделей ---
AB_CANARY_MODEL = os.getenv("AB_CANARY_MODEL") or None  # напр. shopguard_v2.pt
AB_CANARY_PERCENT = _int("AB_CANARY_PERCENT", 0)  # % магазинов на canary

# --- YOLO / модели ---
# Путь к модели задаётся ТОЛЬКО через окружение (без хардкода в коде).
# Отсутствие переменной — явная ошибка на старте (см. ModelManager).
MODELS_DIR = os.getenv("MODELS_DIR", "models")
YOLO_MODEL = os.getenv("YOLO_MODEL")  # напр. models/official/shopguard_v1.pt
YOLO_DEVICE = os.getenv("YOLO_DEVICE", "cpu")
YOLO_CONFIDENCE = _float("YOLO_CONFIDENCE", 0.40)

# --- Хранилище клипов/снимков (MinIO / S3) ---
S3_ENDPOINT = os.getenv("S3_ENDPOINT", "http://localhost:9100")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY", "minioadmin")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY", "minioadmin123")
S3_BUCKET = os.getenv("S3_BUCKET", "event-clips")

# --- Поведение / кулдауны ---
CONFIG_REFRESH_SECONDS = _int("CONFIG_REFRESH_SECONDS", 30)
THEFT_COOLDOWN_SECONDS = _int("THEFT_COOLDOWN_SECONDS", 30)
CLIP_BUFFER_SECONDS = _int("CLIP_BUFFER_SECONDS", 10)
CLIP_FPS = _int("CLIP_FPS", 10)

# --- Распознавание лиц ---
FACE_THRESHOLD = _float("FACE_THRESHOLD", 0.45)
BLACKLIST_COOLDOWN_SECONDS = _int("BLACKLIST_COOLDOWN_SECONDS", 60)

# --- Person Re-Identification (OSNet через TorchReID) ---
# По умолчанию ВЫКЛ: сервис работает без torchreid (graceful), тесты/дев не
# требуют модель. При REID_ENABLED=true и установленном torchreid — межкамерная
# идентификация. Все пороги/лимиты — только из окружения (без хардкода).
REID_ENABLED = _bool("REID_ENABLED", False)
REID_MODEL = os.getenv("REID_MODEL", "osnet_x1_0")  # модель TorchReID
REID_MODEL_PATH = os.getenv("REID_MODEL_PATH", "")  # пусто → предобученные веса
REID_DEVICE = os.getenv("REID_DEVICE", YOLO_DEVICE)  # cuda | cpu
REID_SIMILARITY_THRESHOLD = _float("REID_SIMILARITY_THRESHOLD", 0.7)
REID_EMBEDDING_LIFETIME_SECONDS = _int("REID_EMBEDDING_LIFETIME_SECONDS", 300)
REID_MAX_EMBEDDINGS = _int("REID_MAX_EMBEDDINGS", 10)  # галерея на человека
# RPC к отдельному ReID Service (общая галерея на все AI Worker).
REID_RPC_PATTERN = os.getenv("REID_RPC_PATTERN", "reid.identify")
REID_RPC_TIMEOUT = _float("REID_RPC_TIMEOUT", 3.0)

# --- Переподключение к RTSP (экспоненциальный backoff) ---
RECONNECT_MIN_SECONDS = _int("RECONNECT_MIN_SECONDS", 2)
RECONNECT_MAX_SECONDS = _int("RECONNECT_MAX_SECONDS", 60)

# Явные таймауты OpenCV/FFmpeg на открытие/чтение потока (мс). Работают
# независимо от устаревшей ffmpeg-опции 'stimeout' — чтобы VideoCapture не завис
# на недоступной/зависшей камере (задаются при создании capture).
RTSP_OPEN_TIMEOUT_MS = _int("RTSP_OPEN_TIMEOUT_MS", 10000)
RTSP_READ_TIMEOUT_MS = _int("RTSP_READ_TIMEOUT_MS", 10000)

# Ограничение множества виденных треков (защита от роста памяти при долгой работе).
SEEN_TRACK_CAP = _int("SEEN_TRACK_CAP", 5000)

# --- AI Worker (регистрация + heartbeat) ---
WORKER_VERSION = os.getenv("WORKER_VERSION", "1.0.0")
WORKER_HEARTBEAT_SECONDS = _int("WORKER_HEARTBEAT_SECONDS", 5)

# --- Контракты (должны совпадать с libs/contracts) ---
DETECTION_EVENTS_STREAM = "detection.events"
EVENTS_STREAM = "events.stream"  # шина Event Engine
CONFIG_LIST_PATTERN = "camera.config.list"
BLACKLIST_CONFIG_PATTERN = "camera.blacklist.config"
WORKER_REGISTER_PATTERN = "worker.register"
WORKER_HEARTBEAT_PATTERN = "worker.heartbeat"
