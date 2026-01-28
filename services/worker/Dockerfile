FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy shared common module
COPY shared/python/common ./common

# Copy requirements
COPY services/worker/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY services/worker/app/ ./app/

# Run Celery worker
CMD ["celery", "-A", "app.celery_app", "worker", "--loglevel=info"]
