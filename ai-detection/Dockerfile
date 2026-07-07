FROM python:3.11-slim
WORKDIR /app

# Системные зависимости: FFmpeg/OpenCV (RTSP/видео) + компиляторы для сборки
# insightface/stringzilla из исходников (нет готовых wheel под 3.11-slim).
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg libglib2.0-0 build-essential cmake \
    && rm -rf /var/lib/apt/lists/*

# CPU-only torch с официального индекса PyTorch — без ~2 ГБ CUDA-библиотек
# (сервис работает на CPU). Ставим до остального, чтобы ultralytics не тянул
# CUDA-сборку torch.
RUN pip install --no-cache-dir \
    torch==2.4.1 torchvision==0.19.1 \
    --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Базовая модель ShopGuard v1 (пока = YOLOv8n) в структуре models/official.
# Пользовательские модели кладутся в models/custom (см. MODEL_MANAGEMENT.md).
RUN python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')" \
    && mkdir -p models/official models/custom \
    && cp yolov8n.pt models/official/shopguard_v1.pt

# Модель лиц (buffalo_sc) — тоже в образ, чтобы не качать в рантайме.
RUN python -c "from insightface.app import FaceAnalysis; a=FaceAnalysis(name='buffalo_sc', providers=['CPUExecutionProvider']); a.prepare(ctx_id=0, det_size=(640,640))"

COPY . .

# Модель задаётся только через окружение (без хардкода в коде).
# PYTHONUNBUFFERED — чтобы логи (модель/события/backoff) сразу шли в docker logs.
ENV MODELS_DIR=models \
    YOLO_MODEL=models/official/shopguard_v1.pt \
    PYTHONUNBUFFERED=1

EXPOSE 8000
CMD ["python", "main.py"]
