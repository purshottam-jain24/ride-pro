FROM python:3.11-slim

WORKDIR /app

# System deps for numpy/pandas/scikit-learn wheels
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY ml_server.py .

EXPOSE 5000

# gunicorn keeps the trained model resident across requests
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "1", "--threads", "4", "--timeout", "120", "ml_server:app"]
