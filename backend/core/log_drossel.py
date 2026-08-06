"""
Log-Drossel — gleiche Meldung zaehlen statt wiederholen.

WARUM (06.08.): Ein Scan-Zyklus loest rund 300 yfinance-Abrufe GLEICHZEITIG
aus. Scheitern die, entstehen pro Ausfall mehrere Zeilen je Abruf:
tenacity meldet jeden Wiederholungsversuch, pybreaker jeden Fehlversuch,
und darueber schreibt jede Strategie ihre eigene. Am 06.08. waren es 960
Zeilen in EINER Sekunde. Railways Grenze liegt bei 500/s:

    18:22:36  "rate limit of 500 logs/sec reached ... Messages dropped: 159"

Verworfen wurden ausgerechnet die Zeilen mit dem AUSLOESENDEN Fehler. Die
Folge stand hundertfach im Log, die Ursache gar nicht. Wir haben uns die
eigene Beweislage zerstoert — deshalb dieser Baustein.

REGELN, die den Zweck erfuellen:
  1. Der ERSTE Eintrag eines Schwalls wird immer vollstaendig geschrieben.
  2. Wiederholungen desselben Textes werden nur gezaehlt.
  3. Ein GEAENDERTER Text kommt SOFORT durch — eine neue Ursache darf nie
     unterdrueckt werden. Genau daran scheitern naive Drosseln.
  4. Die Zahl der Unterdrueckten wird mitgeschrieben, nie verschwiegen.

Was hier NICHT hineingehoert: Zustandswechsel und einmalige Ereignisse. Die
sind selten und tragen die meiste Information — sie werden ungedrosselt
geloggt.
"""

import threading
import time

_FENSTER_SEC_STANDARD = 5.0
_zustand: dict[str, dict] = {}
_sperre = threading.Lock()


def gedrosselt(
    schreiber,
    schluessel: str,
    text: str,
    fenster_sec: float = _FENSTER_SEC_STANDARD,
) -> bool:
    """Schreibt `text` ueber `schreiber`, aber hoechstens einmal je
    `fenster_sec` je `schluessel` — solange der Text gleich bleibt.

    schreiber:   z.B. logger.warning oder logger.error
    schluessel:  trennt unabhaengige Quellen (etwa "breaker:yfinance")
    Rueckgabe:   True wenn geschrieben wurde, False wenn unterdrueckt.
    """
    jetzt = time.monotonic()
    with _sperre:
        z = _zustand.setdefault(
            schluessel, {"zuletzt": 0.0, "unterdrueckt": 0, "text": None}
        )
        if z["text"] == text and (jetzt - z["zuletzt"]) < fenster_sec:
            z["unterdrueckt"] += 1
            return False
        unterdrueckt = z["unterdrueckt"]
        z.update({"zuletzt": jetzt, "unterdrueckt": 0, "text": text})

    if unterdrueckt:
        schreiber(
            f"{text} (+{unterdrueckt} weitere gleiche in den letzten "
            f"{fenster_sec:.0f}s unterdrückt)"
        )
    else:
        schreiber(text)
    return True


def zuruecksetzen(schluessel: str | None = None) -> None:
    """Nur fuer Tests: Zustand vergessen."""
    with _sperre:
        if schluessel is None:
            _zustand.clear()
        else:
            _zustand.pop(schluessel, None)
