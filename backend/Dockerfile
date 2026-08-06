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

# Der Python-Aufsatz oben ist NICHT auf eine Version festgelegt, die
# C-Bibliothek darunter dagegen schon (0.4.0, aus vendor/). Passen die beiden
# nicht zusammen, entsteht ein Abbild, das sich bauen laesst, aber beim Import
# scheitert — und dann meldet jedes Symbol still "TA-Lib nicht installiert",
# waehrend der Dienst aussen gesund aussieht (talib_indicators.py faengt den
# ImportError ab und gibt nur ein Fehlerfeld zurueck).
#
# Statt eine Versionsnummer zu raten wird der Import hier ERZWUNGEN: schlaegt er
# fehl, faellt der Bau sofort auf und das kaputte Abbild geht gar nicht erst in
# Betrieb. Zusaetzlich wird eine echte Berechnung gefahren, denn ein Import
# allein beweist noch nicht, dass die C-Bibliothek dahinter antwortet.
RUN python -c "import talib, numpy; \
    v = talib.__version__; \
    r = talib.RSI(numpy.arange(1.0, 51.0), timeperiod=14); \
    assert not numpy.isnan(r[-1]), 'TA-Lib rechnet nicht'; \
    print('TA-Lib einsatzbereit, Version', v, '- RSI-Probe', round(float(r[-1]), 2))"

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--loop", "uvloop"]
