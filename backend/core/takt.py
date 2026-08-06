"""
Taktgeber fuer yfinance — Abrufe gleichmaessig verteilen statt im Schwall.

WARUM (06.08., bewiesen aus dem Betriebslog):

    21:21:54  [circuit-breaker] yfinance Fehler: Too Many Requests. Rate limited.
    21:21:54  [talib] Fehler GBPUSD: Too Many Requests. Rate limited.

Yahoo begrenzt uns. Gemessen aus dem Quelltext feuert ein Scan-Zyklus rund 300
Abrufe GLEICHZEITIG los (30 TA-Lib + 60 Multi-Timeframe + 210 Strategien), ueber
44 parallele Faeden (12 Arbeiter x 3 TA-Lib-Anfragen + 8 fuer die Strategien).
Danach faellt der Sicherungsschalter fuer 120 Sekunden, und der ganze Zyklus ist
verloren — ohne Kurse gibt es keine Analyse und damit keinen Trade.

Gegen ein RATEN-Limit hilft nicht weniger Arbeit, sondern gleichmaessige
Verteilung. Genau dieses Muster wurde am 03.08. fuer Capital.com gebaut
(6 Gruppen a 5 mit 500ms Pause) und hat dort nachweislich gewirkt: von 10 auf
30 von 30 Maerkten mit Broker-Kurs.

ZUR ZAHL, ehrlich benannt: Yahoo veroeffentlicht sein Limit nicht. Der
Standardwert ist deshalb NICHT aus Yahoos Grenze abgeleitet, sondern aus
UNSERER: der Strategien-Abruf hat 60 Sekunden Zeit (AbortSignal.timeout im
Frontend). Damit die rund 300 Abrufe eines Zyklus mit Abstand darunter bleiben,
ergibt sich

    300 Abrufe / 7 je Sekunde  ~=  43 Sekunden

Das ist ein begruendeter Startwert, kein gemessenes Limit. Er ist ueber die
Umgebungsvariable YFINANCE_CALLS_PER_SEC aenderbar, und dieser Baustein zaehlt
mit, wie lange tatsaechlich gewartet wurde — die naechste Logzeile zeigt also,
ob der Wert reicht. Erst dann ist er belegt.

GRENZE, die dieser Baustein NICHT aufheben kann: der Takt gilt je PROZESS.
Aus backend/ werden zwei Railway-Dienste gebaut (divine-warmth und
exquisite-rejoicing), und beide holen Kurse. Gegen Yahoo liegt die Rate damit
bei bis zu ZWEIMAL dem eingestellten Wert. Wer das schliessen will, braucht
einen gemeinsamen Zaehler ueber Redis — das ist bewusst nicht hier gebaut,
weil es eine neue Abhaengigkeit in den Datenpfad zoege. Wenn die Logzeile nach
dem Deploy zeigt, dass 7/s je Prozess nicht reichen, ist die einfachste
Antwort, den Wert zu halbieren; die Rechnung dazu steht oben.

Bewusst NICHT gebaut: eine selbstregelnde Anpassung (Rate bei Fehlern halbieren
und langsam wieder anheben). Die waere maechtiger, aber sie verschiebt das
Verhalten in eine Automatik, die niemand mehr nachrechnen kann. Ein fester,
sichtbarer, einstellbarer Takt ist ueberpruefbar — und Ueberpruefbarkeit ist
hier mehr wert.
"""

import os
import threading
import time

# Standard 7 Abrufe je Sekunde — Herleitung siehe oben.
_STANDARD_RATE = 7.0


def _gelesene_rate() -> float:
    roh = os.getenv("YFINANCE_CALLS_PER_SEC", "").strip()
    if not roh:
        return _STANDARD_RATE
    try:
        wert = float(roh)
    except ValueError:
        return _STANDARD_RATE
    # 0 oder negativ = abgeschaltet; sinnlos grosse Werte ebenso ignorieren.
    if wert <= 0:
        return 0.0
    return min(wert, 1000.0)


_rate = _gelesene_rate()
_mindestabstand = (1.0 / _rate) if _rate > 0 else 0.0

_sperre = threading.Lock()
_naechster_start = 0.0

# Nur zum Nachweisen, dass der Takt wirkt — keine Entscheidung haengt daran.
_zaehler = {"abrufe": 0, "wartezeit_sec": 0.0}


def warte() -> float:
    """Blockiert, bis der naechste Abruf an der Reihe ist.

    Rueckgabe: wie lange gewartet wurde (Sekunden). 0.0 wenn abgeschaltet.

    Der Abstand wird UNTER DER SPERRE vergeben, nicht darin abgewartet — sonst
    stuenden alle 44 Faeden hintereinander in derselben Sperre und der Takt
    wuerde zur Reihenschaltung. So bekommt jeder Faden sofort seinen Zeitpunkt
    zugeteilt und wartet danach fuer sich.
    """
    if _mindestabstand <= 0:
        return 0.0

    global _naechster_start
    jetzt = time.monotonic()
    with _sperre:
        start = max(jetzt, _naechster_start)
        _naechster_start = start + _mindestabstand
    gewartet = start - jetzt
    if gewartet > 0:
        time.sleep(gewartet)
    with _sperre:
        _zaehler["abrufe"] += 1
        _zaehler["wartezeit_sec"] += max(gewartet, 0.0)
    return max(gewartet, 0.0)


def stand() -> dict:
    """Aktueller Takt und was er bisher gekostet hat."""
    with _sperre:
        return {
            "rate_je_sekunde": _rate,
            "mindestabstand_ms": round(_mindestabstand * 1000, 1),
            "abrufe": _zaehler["abrufe"],
            "wartezeit_sec": round(_zaehler["wartezeit_sec"], 1),
        }


def zuruecksetzen(rate: float | None = None) -> None:
    """Nur fuer Tests: Zaehler leeren und optional die Rate setzen."""
    global _rate, _mindestabstand, _naechster_start
    with _sperre:
        if rate is not None:
            _rate = max(rate, 0.0)
            _mindestabstand = (1.0 / _rate) if _rate > 0 else 0.0
        _naechster_start = 0.0
        _zaehler["abrufe"] = 0
        _zaehler["wartezeit_sec"] = 0.0
