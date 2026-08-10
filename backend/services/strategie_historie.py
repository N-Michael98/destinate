"""
Historischer Lauf des 16-Strategien-Konsenses (Stufe 4, Schritt 2 — 07.08.).

WOZU. Der naechtliche Backtest und der Walk-Forward pruefen drei einfache
Strategien auf Schlusskursen: EMA_CROSS, RSI_REVERSION, BREAKOUT. Gehandelt
werden aber 16 Strategien plus TA-Lib, GPT, Claude, Entry-Quality und
Multi-Timeframe. Zwischen Pruefung und Handel klafft damit eine Luecke: wenn
der Walk-Forward "UK100 robust" meldet, heisst das "EMA_CROSS mit fast=12,
slow=26 war auf UK100 robust" — ueber unsere Live-Kette sagt es nichts.

Dieses Modul schliesst die Luecke: es laesst den ECHTEN Konsens Balken fuer
Balken durch die Vergangenheit laufen.

WIE. Der entscheidende Punkt ist, dass hier NICHTS nachgebaut wird.
analyze_all_strategies() ist dieselbe Funktion, die im Livebetrieb laeuft — sie
bekommt ueber den Kerzen-Haken (trading_strategies.kerzenquelle) fuer jeden
Zeitpunkt die Daten, die es DAMALS gab. Konsens, Confidence, Entry-Quality und
Levels entstehen dadurch exakt so wie live. Ein Nachbau wuerde frueher oder
spaeter auseinanderdriften und genau die Luecke neu aufreissen, die er
schliessen soll.

EHRLICHKEIT BEI DEN DATEN. Die Strategien brauchen vier Intervalle, und die
reichen unterschiedlich weit zurueck. Gemessen am 07.08. bei yfinance:

    4h (aus 1h)   3 Monate abrufbar, 6 Monate mit period=6mo
    1d            1 Jahr und mehr
    1h            3 Monate
    15m           HOECHSTENS 60 TAGE — laenger liefert Yahoo gar nichts

Fuer scalping (15m) ist der auswertbare Zeitraum deshalb kuerzer als fuer die
uebrigen. Das wird NICHT verschwiegen und NICHT durch andere Kerzen ersetzt:
jeder Balken, an dem eine Strategie nicht mit ihren echten Daten rechnen
konnte, wird gezaehlt und im Ergebnis benannt. Eine Strategie, die anders
laeuft als sie heisst, waere schlimmer als gar keine Auswertung.

WAS DIESES MODUL NICHT TUT. Es bewertet nicht. Es liefert die Reihe der
Konsens-Entscheidungen samt Kurs; ob daraus Gewinn geworden waere, rechnet die
Analysis-Engine (Schritt 3). Diese Trennung ist Absicht — hier soll nichts
entstehen, das eine Meinung hat.
"""

import inspect
import re
import time
from datetime import timedelta
from typing import Optional

import pandas as pd

from services import trading_strategies as TS
from services.market_data import get_ohlcv

# Wie lange ein Zeitraum-Name dauert. Gebraucht, um je Balken genau den
# Ausschnitt zu schneiden, den die Strategie anfordert.
#
# ZUR GENAUIGKEIT, offen benannt: yfinance setzt den Fensteranfang anders als
# "jetzt minus 30 Tage" (gemessen 07.08.: bis zu 66 Balken Abweichung). Fuer
# einen VERGANGENEN Zeitpunkt gibt es aber ohnehin keine yfinance-Antwort, mit
# der man vergleichen koennte — das Fenster muss konstruiert werden. Gewaehlt
# ist die schlichte Zeitspanne, weil sie nachrechenbar ist.
ZEITRAUM_DAUER: dict[str, timedelta] = {
    "1d": timedelta(days=1),
    "5d": timedelta(days=5),
    "1mo": timedelta(days=30),
    "2mo": timedelta(days=60),
    "3mo": timedelta(days=90),
    "6mo": timedelta(days=182),
    "1y": timedelta(days=365),
    "2y": timedelta(days=730),
}

# Was yfinance je Intervall ueberhaupt hergibt (gemessen 07.08.).
# Laengere Anfragen kommen leer zurueck — deshalb hier gedeckelt, statt
# hinterher mit leeren Rahmen dazustehen.
MAX_HISTORIE: dict[str, timedelta] = {
    "15m": timedelta(days=59),    # Yahoo: "must be within the last 60 days"
    "1h": timedelta(days=180),
    "4h": timedelta(days=180),    # wird aus 1h erzeugt
    "1d": timedelta(days=730),
}

# Womit die Rohdaten geholt werden, um MAX_HISTORIE auszuschoepfen.
ABRUF_ZEITRAUM: dict[str, str] = {
    "15m": "1mo",   # 5d waere zu kurz fuer einen historischen Lauf
    "1h": "6mo",
    "4h": "6mo",
    "1d": "2y",
}


def benoetigte_intervalle() -> dict[str, set[str]]:
    """Welche (Intervall, Zeitraum) die registrierten Strategien anfordern.

    AUS DEM QUELLTEXT GELESEN, nicht gepflegt: eine Liste von Hand wuerde beim
    naechsten Umbau still veralten, und dann bekaeme eine Strategie im
    historischen Lauf andere Daten als live — ohne dass es auffiele.
    """
    bedarf: dict[str, set[str]] = {}
    for fn in TS.STRATEGIES.values():
        try:
            quelle = inspect.getsource(fn)
        except (OSError, TypeError):
            continue
        for intervall, zeitraum in re.findall(
            r'_load\(symbol,\s*"([^"]+)",\s*"([^"]+)"\)', quelle
        ):
            bedarf.setdefault(intervall, set()).add(zeitraum)
    return bedarf


def strategien_je_intervall() -> dict[tuple[str, str], list[str]]:
    """Umgekehrte Sicht: welche Strategie haengt an welchem Abruf.

    Gebraucht, um benennen zu koennen, WELCHE Strategie an einem Balken nicht
    mit ihren echten Daten rechnen konnte.
    """
    zuordnung: dict[tuple[str, str], list[str]] = {}
    for name, fn in TS.STRATEGIES.items():
        try:
            quelle = inspect.getsource(fn)
        except (OSError, TypeError):
            continue
        for intervall, zeitraum in re.findall(
            r'_load\(symbol,\s*"([^"]+)",\s*"([^"]+)"\)', quelle
        ):
            zuordnung.setdefault((intervall, zeitraum), []).append(name)
    return zuordnung


class Kerzenschnitt:
    """Liefert je Anfrage den Ausschnitt, den es zum Zeitpunkt `jetzt` gab.

    Merkt sich dabei, welche Anfragen NICHT vollstaendig bedient werden
    konnten — das ist die Grundlage dafuer, spaeter sagen zu koennen, dass
    scalping ueber weite Teile des Zeitraums gar nicht auswertbar war.
    """

    def __init__(self, reihen: dict[str, pd.DataFrame]):
        self.reihen = reihen
        self.jetzt: Optional[pd.Timestamp] = None
        self.unvollstaendig: set[tuple[str, str]] = set()

    def __call__(self, symbol: str, intervall: str, zeitraum: str) -> pd.DataFrame:
        df = self.reihen.get(intervall)
        if df is None or df.empty or self.jetzt is None:
            self.unvollstaendig.add((intervall, zeitraum))
            return pd.DataFrame()

        bis_jetzt = df[df.index <= self.jetzt]
        if bis_jetzt.empty:
            self.unvollstaendig.add((intervall, zeitraum))
            return pd.DataFrame()

        dauer = ZEITRAUM_DAUER.get(zeitraum)
        if dauer is None:
            # Unbekannter Zeitraum: lieber alles bis jetzt als nichts, aber
            # als unvollstaendig vermerken — dann faellt es auf.
            self.unvollstaendig.add((intervall, zeitraum))
            return bis_jetzt

        beginn = self.jetzt - dauer
        if bis_jetzt.index[0] > beginn:
            # Die Reihe faengt spaeter an als angefordert — die Strategie
            # sieht weniger Geschichte als im Livebetrieb.
            self.unvollstaendig.add((intervall, zeitraum))
        return bis_jetzt[bis_jetzt.index >= beginn]


def _als_frame(kerzen: list[dict]) -> pd.DataFrame:
    """Dieselbe Umwandlung wie in trading_strategies._load()."""
    if not kerzen:
        return pd.DataFrame()
    df = pd.DataFrame(kerzen)
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    df = df.set_index("timestamp")
    for spalte in ["open", "high", "low", "close", "volume"]:
        if spalte in df.columns:
            df[spalte] = pd.to_numeric(df[spalte], errors="coerce")
    return df.dropna(subset=["close"])


def lade_reihen(symbol: str) -> tuple[dict[str, pd.DataFrame], list[str]]:
    """Holt je benoetigtem Intervall EINMAL die laengste sinnvolle Reihe.

    Rueckgabe: (Reihen, Hinweise). Die Hinweise nennen Intervalle, die gar
    nicht oder zu kurz geliefert wurden — damit steht im Ergebnis, warum eine
    Strategie spaeter fehlt, statt dass sie stillschweigend NEUTRAL sagt.
    """
    reihen: dict[str, pd.DataFrame] = {}
    hinweise: list[str] = []
    for intervall in sorted(benoetigte_intervalle()):
        zeitraum = ABRUF_ZEITRAUM.get(intervall)
        if zeitraum is None:
            hinweise.append(f"{intervall}: kein Abruf-Zeitraum hinterlegt")
            continue
        try:
            df = _als_frame(get_ohlcv(symbol, intervall, zeitraum))
        except Exception as e:
            hinweise.append(f"{intervall}: Abruf fehlgeschlagen ({type(e).__name__})")
            continue
        if df.empty:
            hinweise.append(f"{intervall}: keine Daten fuer {zeitraum}")
            continue
        reihen[intervall] = df
        spanne = df.index[-1] - df.index[0]
        grenze = MAX_HISTORIE.get(intervall)
        if grenze is not None and spanne < grenze * 0.5:
            hinweise.append(
                f"{intervall}: nur {spanne.days} Tage erhalten "
                f"(erwartet bis {grenze.days})"
            )
    return reihen, hinweise


def konsens_historie(symbol: str, tage: int = 90, takt_intervall: str = "4h") -> dict:
    """Laesst den echten 16-Strategien-Konsens durch die Vergangenheit laufen.

    tage           Laenge des Auswertungsfensters. EINSTELLBAR, weil die
                   Rechenzeit im selben Dienst anfaellt, der alle 5 Minuten den
                   Live-Scan bedient — gemessen rund 52 ms je Balken.
    takt_intervall Welche Kerzenreihe den Takt vorgibt. 4h, weil 11 der 16
                   Strategien darauf laufen.
    """
    begonnen = time.time()
    reihen, hinweise = lade_reihen(symbol)
    takt = reihen.get(takt_intervall)
    if takt is None or takt.empty:
        return {
            "symbol": symbol,
            "status": "keine_daten",
            "hinweise": hinweise or [f"{takt_intervall}: keine Kerzen"],
        }

    fensterbeginn = takt.index[-1] - timedelta(days=tage)
    balken = takt[takt.index >= fensterbeginn]

    schnitt = Kerzenschnitt(reihen)
    zuordnung = strategien_je_intervall()

    zeitstempel: list[str] = []
    kurse: list[float] = []
    konsens: list[str] = []
    konsens_conf: list[int] = []
    eq_tier: list[str] = []
    eq_score: list[int] = []
    # Je Strategie zaehlen, an wie vielen Balken sie NICHT mit ihren echten
    # Daten rechnen konnte.
    ohne_daten: dict[str, int] = {name: 0 for name in TS.STRATEGIES}
    # Dasselbe je BALKEN. Die Summe allein genuegt nicht: die 15m-Grenze von
    # yfinance liegt bei 60 Tagen, die Luecke von scalping sitzt deshalb
    # geschlossen am ANFANG des Fensters. Der Konsens der fruehen Balken ist
    # also aus weniger Strategien gebildet als der der spaeten — wer das
    # auswertet, muss beides trennen koennen.
    ohne_daten_je_balken: list[int] = []

    for zeitpunkt, zeile in balken.iterrows():
        schnitt.jetzt = zeitpunkt
        schnitt.unvollstaendig.clear()
        with TS.kerzenquelle(schnitt):
            ergebnis = TS.analyze_all_strategies(symbol)

        # Erst sammeln, dann zaehlen — JE BALKEN HOECHSTENS EINMAL je Strategie.
        # Heute macht keine Strategie zwei _load-Aufrufe (nachgeprueft), aber
        # sobald eine Multi-Timeframe-Strategie einen zweiten bekommt, wuerde
        # direktes Hochzaehlen sie an einem Balken doppelt zaehlen und "anteil"
        # ueber 1 treiben — die Ehrlichkeitszahl waere dann falsch.
        betroffen: set[str] = set()
        for schluessel in schnitt.unvollstaendig:
            betroffen.update(zuordnung.get(schluessel, []))
        for name in betroffen:
            # .get statt [name]: die Zuordnung stammt zwar aus STRATEGIES, aber
            # ein Name, der dort nicht steht, darf den ganzen Lauf nicht mit
            # KeyError abbrechen. Er taucht dann im Bericht auf — das ist die
            # nuetzlichere Antwort als ein Absturz.
            ohne_daten[name] = ohne_daten.get(name, 0) + 1
        ohne_daten_je_balken.append(len(betroffen))

        zeitstempel.append(zeitpunkt.isoformat())
        kurse.append(round(float(zeile["close"]), 6))
        konsens.append(str(ergebnis.get("consensus", "NEUTRAL")))
        konsens_conf.append(int(ergebnis.get("consensus_conf", 0)))
        eq = ergebnis.get("entry_quality") or {}
        eq_tier.append(str(eq.get("tier", "NO_SIGNAL")))
        eq_score.append(int(eq.get("score", 0)))

    gesamt = len(zeitstempel)
    # Nur melden, was tatsaechlich Luecken hatte — und mit Anteil, damit
    # sofort erkennbar ist, ob eine Strategie am Rand oder ueberall fehlte.
    luecken = {
        name: {"balkenOhneDaten": n, "anteil": round(n / gesamt, 3) if gesamt else 0.0}
        for name, n in ohne_daten.items() if n > 0
    }

    return {
        "symbol": symbol,
        "status": "ok",
        "taktIntervall": takt_intervall,
        "fensterTage": tage,
        "balken": gesamt,
        "von": zeitstempel[0] if zeitstempel else None,
        "bis": zeitstempel[-1] if zeitstempel else None,
        "dauerSek": round(time.time() - begonnen, 1),
        "zeitstempel": zeitstempel,
        "kurs": kurse,
        "konsens": konsens,
        "konsensConf": konsens_conf,
        "entryQualityTier": eq_tier,
        "entryQualityScore": eq_score,
        # Ehrlichkeit ueber die Datenlage — siehe Modulkopf.
        "strategienMitLuecken": luecken,
        # Je Balken: wie viele Strategien konnten nicht mit echten Daten
        # rechnen. Gleich lang wie "konsens". Ohne diese Reihe koennte die
        # Auswertung nicht trennen, ob ein Ergebnis aus dem vollstaendigen oder
        # aus dem ausgeduennten Teil des Fensters stammt.
        "strategienOhneDaten": ohne_daten_je_balken,
        "hinweise": hinweise,
    }
