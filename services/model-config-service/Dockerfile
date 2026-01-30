FROM python:3.11-slim

WORKDIR /app

# Copy requirements
COPY services/model-config-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy shared common module
COPY shared/python/common /app/common

# Copy service code
COPY services/model-config-service/app /app/app

# Expose port
EXPOSE 8000

# Run the service
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
