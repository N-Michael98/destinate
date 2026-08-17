"""
Historischer Lauf der Chartmuster-Erkennung (17.08.).

WOZU. chartmuster.py erkennt Doppeltop, Doppelboden, Schulter-Kopf-Schulter und
die drei Dreiecke — aber es handelt bewusst nicht mit. Der Grund steht dort im
Modulkopf: ob ein erkanntes Muster etwas taugt, muss erst gemessen werden. Ein
Muster handeln zu lassen, bevor es gemessen wurde, waere derselbe Fehler wie
eine Kennzahl ohne Vergleichswert.

Dieses Modul liefert die Messgrundlage: es laesst die ECHTE Erkennung Balken
fuer Balken durch die Vergangenheit laufen und gibt zurueck, WANN welches
Muster stand und wie der Kurs war.

WIE. Nichts wird nachgebaut:
  - erkenne_muster() ist dieselbe Funktion wie im Endpunkt
  - Kerzenschnitt aus strategie_historie liefert je Zeitpunkt genau die Kerzen,
    die es DAMALS gab — dieselbe Schnittlogik wie bei der Konsens-Rueckrechnung
  - Die Ausgabe hat DIESELBE FORM wie konsens_historie. Damit kann die
    Analysis-Engine sie mit derselben, bereits bewaehrten Auswertung bewerten
    (bewerte_historie) statt mit einer zweiten, leicht anderen.

WAS DIESES MODUL NICHT TUT. Es bewertet nicht. Es sagt nicht, ob ein Muster
gut ist. Es liefert die Reihe; ob daraus Gewinn geworden waere, rechnet die
Analysis-Engine. Dieselbe Trennung wie bei Stufe 4, aus demselben Grund: hier
soll nichts entstehen, das eine Meinung hat.

ZUM TAKT. Standard ist 1d. Muster brauchen bestaetigte Wendepunkte, und die
entstehen auf Tageskerzen sauberer als auf 4h — dort erzeugt jede
Intraday-Schwankung Kandidaten. yfinance liefert 1d ueber zwei Jahre, das gibt
genug Balken fuer eine Aussage. Der Takt ist einstellbar.
"""

import time
from datetime import timedelta
from typing import Optional

import pandas as pd

from services.chartmuster import erkenne_muster
from services.strategie_historie import ABRUF_ZEITRAUM, Kerzenschnitt, _als_frame
from services.market_data import get_ohlcv

# Wie viele Kerzen die Erkennung mindestens sehen muss, bevor ein Ergebnis
# ueberhaupt aussagekraeftig ist: ATR(14) braucht 15, und ohne mehrere
# bestaetigte Wendepunkte gibt es kein Muster. 60 ist der Vorlauf, unter dem
# gar nicht erst gerechnet wird — sonst entstuenden lauter leere Balken, die
# spaeter wie "kein Muster" aussehen, obwohl schlicht die Daten fehlten.
MINDEST_VORLAUF = 60

# Der Zeitraum, den ein Balken sehen darf. Muss zu einem Eintrag in
# ZEITRAUM_DAUER passen (Kerzenschnitt prueft das).
SICHT_ZEITRAUM = "6mo"


def muster_historie(symbol: str, tage: int = 365, intervall: str = "1d") -> dict:
    """Laesst die echte Muster-Erkennung durch die Vergangenheit laufen.

    Rueckgabe in DERSELBEN FORM wie konsens_historie, damit die Analysis-Engine
    dieselbe Auswertung verwenden kann:

      zeitstempel, kurs      wie dort
      konsens                die Richtung des BESTAETIGTEN Musters
                             (LONG / SHORT / NEUTRAL)
      konsensConf            0 — Muster haben keine Confidence. Das Feld steht
                             nur da, weil die Auswertung es erwartet; die
                             Confidence-Staffelung ist fuer Muster ohne Bedeutung
                             und wird von der Engine auch nicht ausgewiesen.
      entryQualityTier       der Musternamen — damit gruppiert die vorhandene
                             Tier-Auswertung nach MUSTERART, ohne neue Logik
      strategienOhneDaten    0 je Balken; es gibt hier keine Strategien mit
                             Luecken. Das Feld bleibt, damit die Auswertung
                             nicht in ihren Rueckfall laeuft und faelschlich
                             "Reihe fehlt" meldet.

    Zusaetzlich, fuer die genauere Auswertung:
      musterAlle             je Balken ALLE erkannten Muster (auch unbestaetigte)
      bestaetigt             je Balken, ob ein bestaetigtes dabei war
    """
    begonnen = time.time()
    hinweise: list[str] = []

    abruf = ABRUF_ZEITRAUM.get(intervall)
    if abruf is None:
        return {"symbol": symbol, "status": "unbekanntes_intervall",
                "hinweise": [f"{intervall}: kein Abruf-Zeitraum hinterlegt"]}
    try:
        df = _als_frame(get_ohlcv(symbol, intervall, abruf))
    except Exception as e:
        return {"symbol": symbol, "status": "keine_daten",
                "hinweise": [f"{intervall}: Abruf fehlgeschlagen ({type(e).__name__})"]}
    if df.empty:
        return {"symbol": symbol, "status": "keine_daten",
                "hinweise": [f"{intervall}: keine Kerzen fuer {abruf}"]}

    fensterbeginn = df.index[-1] - timedelta(days=tage)
    balken = df[df.index >= fensterbeginn]
    if len(balken) < 2:
        return {"symbol": symbol, "status": "keine_daten",
                "hinweise": [f"nur {len(balken)} Balken im Fenster von {tage} Tagen"]}

    schnitt = Kerzenschnitt({intervall: df})

    zeitstempel: list[str] = []
    kurse: list[float] = []
    richtung: list[str] = []
    tier: list[str] = []
    alle: list[list[str]] = []
    bestaetigt: list[bool] = []
    zu_wenig_vorlauf = 0

    for zeitpunkt, zeile in balken.iterrows():
        schnitt.jetzt = zeitpunkt
        teil = schnitt(symbol, intervall, SICHT_ZEITRAUM)

        if len(teil) < MINDEST_VORLAUF:
            # NICHT als "kein Muster" zaehlen — sonst sieht fehlender Vorlauf
            # spaeter aus wie ein gemessenes Ergebnis.
            zu_wenig_vorlauf += 1
            ergebnis = {"muster": []}
        else:
            ergebnis = erkenne_muster(teil)

        gefunden = ergebnis.get("muster") or []
        # Nur BESTAETIGTE Muster geben eine Richtung. Ein unbestaetigtes ist
        # eine Vermutung — es haette nie einen Einstieg ausgeloest.
        bestaetigte = [m for m in gefunden
                       if m.get("bestaetigt") and m.get("richtung") in ("LONG", "SHORT")]

        zeitstempel.append(zeitpunkt.isoformat())
        kurse.append(round(float(zeile["close"]), 6))
        alle.append([str(m.get("muster")) for m in gefunden])
        bestaetigt.append(bool(bestaetigte))
        if bestaetigte:
            # Bei mehreren gilt das erste — die Reihenfolge in erkenne_muster
            # ist fest (Doppeltop, Doppelboden, SKS, inverse SKS, Dreieck).
            richtung.append(str(bestaetigte[0]["richtung"]))
            tier.append(str(bestaetigte[0]["muster"]))
        else:
            richtung.append("NEUTRAL")
            tier.append("KEIN_MUSTER")

    if zu_wenig_vorlauf:
        hinweise.append(
            f"{zu_wenig_vorlauf} von {len(zeitstempel)} Balken hatten weniger als "
            f"{MINDEST_VORLAUF} Kerzen Vorlauf — dort wurde NICHT gerechnet"
        )

    return {
        "symbol": symbol,
        "status": "ok",
        "taktIntervall": intervall,
        "fensterTage": tage,
        "balken": len(zeitstempel),
        "von": zeitstempel[0] if zeitstempel else None,
        "bis": zeitstempel[-1] if zeitstempel else None,
        "dauerSek": round(time.time() - begonnen, 1),
        # Dieselben Feldnamen wie konsens_historie — siehe Modulkopf.
        "zeitstempel": zeitstempel,
        "kurs": kurse,
        "konsens": richtung,
        "konsensConf": [0] * len(zeitstempel),
        "entryQualityTier": tier,
        "strategienOhneDaten": [0] * len(zeitstempel),
        "strategienMitLuecken": {},
        # Nur fuer die Muster-Auswertung:
        "musterAlle": alle,
        "bestaetigt": bestaetigt,
        "balkenOhneVorlauf": zu_wenig_vorlauf,
        "hinweise": hinweise,
    }
