FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc build-essential \
    && rm -rf /var/lib/apt/lists/*

# TA-Lib-Quellcode liegt im Repo (vendor/) statt per wget geladen zu werden —
# SourceForge war von Railways Build-Servern aus wiederholt unzuverlässig
# erreichbar (exit code 4, mehrfach, auch mit Retries und anderer Mirror-URL).
# Verifiziert vor dem Einchecken: gültiges gzip, korrekte ta-lib/-Struktur,
# configure-Skript vorhanden, byte-identisch mit der offiziellen Quelle.
COPY vendor/ta-lib-0.4.0-src.tar.gz .
RUN tar -xzf ta-lib-0.4.0-src.tar.gz \
    && cd ta-lib && ./configure --prefix=/usr && make && make install \
    && cd .. && rm -rf ta-lib ta-lib-0.4.0-src.tar.gz

COPY requirements.txt .
RUN pip install --no-cache-dir --only-binary :all: pandas "numpy==1.26.4" && \
    pip install --no-cache-dir curl_cffi && \
    pip install --no-cache-dir TA-Lib && \
    pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--loop", "uvloop"]
