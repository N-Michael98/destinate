"""
Chartmuster-Erkennung (10.08.).

WAS ERKANNT WIRD. Doppeltop und Doppelboden, Schulter-Kopf-Schulter und seine
Umkehrung, sowie die drei Dreiecke (symmetrisch, steigend, fallend).

WORAUF ES AUFBAUT. Alle Muster bestehen aus WENDEPUNKTEN, und die Regel dafuer
gibt es im System schon: trading_strategies._swing_points() bestaetigt einen
Wendepunkt erst, wenn `links` Kerzen davor UND `rechts` Kerzen danach hoeher
bzw. tiefer liegen. Diese Funktion liefert allerdings nur den LETZTEN Hoch- und
Tiefpunkt — ein Muster braucht eine Folge. alle_swings() hier verwendet exakt
dieselbe Regel und liefert die ganze Reihe.

DIE DOPPELUNG IST ABGESICHERT, NICHT HINGENOMMEN: ein Test vergleicht den
letzten Wendepunkt aus alle_swings() gegen _swing_points() auf denselben Daten.
Driften die beiden Regeln auseinander, wird das rot. Eine zweite, leicht andere
Wendepunkt-Definition waere genau die Sorte Abweichung, die spaeter niemand
mehr erklaeren kann.

TOLERANZEN IN ATR, NICHT IN PROZENT. "Zwei Hochs auf gleicher Hoehe" braucht
ein Mass fuer "gleich". In Kursprozent gemessen bedeutet dasselbe Prozent je
nach Markt voellig Verschiedenes — am 10.08. ueber alle 30 Symbole gemessen
liegt der Faktor bei 17,6 zwischen dem ruhigsten und dem bewegtesten Markt.
Deshalb wird in ATR gerechnet: eine Toleranz von 0,5 ATR heisst in jedem Markt
dasselbe.

WAS DIESES MODUL NICHT TUT: es handelt nicht. Es stimmt in keinem Konsens mit
ab und loest kein Signal aus. Es meldet, was im Kursverlauf steht. Ob ein
erkanntes Muster etwas taugt, muss erst gemessen werden — dafuer gibt es seit
Stufe 4 die Konsens-Rueckrechnung. Ein Muster handeln zu lassen, bevor es
gemessen wurde, waere derselbe Fehler wie eine Kennzahl ohne Vergleichswert.
"""

from typing import Optional

import pandas as pd

# Dieselbe Bestaetigungsregel wie _swing_points im Handelspfad.
SWING_LINKS = 3
SWING_RECHTS = 3

# Wie nah zwei Punkte liegen muessen, um als "auf gleicher Hoehe" zu gelten.
# In ATR, siehe Modulkopf.
TOLERANZ_ATR = 0.5

# Wie weit der Kopf ueber den Schultern liegen muss, damit es ein Kopf ist.
KOPF_MINDEST_ATR = 0.5

# Wie stark sich ein Dreieck verengen muss, damit es eines ist: die spaetere
# Spanne darf hoechstens diesen Anteil der frueheren betragen.
DREIECK_VERENGUNG = 0.7


def atr_wilder(df: pd.DataFrame, periode: int = 14) -> Optional[float]:
    """ATR nach Wilder — dieselbe Definition, die TA-Lib verwendet.

    Gebraucht als Massstab fuer die Toleranzen. Bewusst hier gerechnet und
    nicht vom TA-Lib-Dienst geholt: dieses Modul soll ohne Netzaufruf
    auskommen, sonst haengt die Mustererkennung an einem zweiten Dienst.
    """
    if df is None or len(df) < periode + 1:
        return None
    hoch, tief, schluss = df["high"], df["low"], df["close"]
    vorher = schluss.shift(1)
    tr = pd.concat([hoch - tief, (hoch - vorher).abs(), (tief - vorher).abs()], axis=1).max(axis=1)
    tr = tr.dropna()
    if len(tr) < periode:
        return None
    wert = float(tr.iloc[:periode].mean())
    for x in tr.iloc[periode:]:
        wert = (wert * (periode - 1) + float(x)) / periode
    return wert if wert > 0 else None


def alle_swings(df: pd.DataFrame, links: int = SWING_LINKS,
                rechts: int = SWING_RECHTS) -> list[dict]:
    """Alle BESTAETIGTEN Wendepunkte, in zeitlicher Reihenfolge.

    Ein Hochpunkt ist eine Kerze, deren High hoeher liegt als das aller `links`
    Kerzen davor UND aller `rechts` danach — identisch zu _swing_points. Die
    letzten `rechts` Kerzen koennen deshalb naturgemaess noch keinen Wendepunkt
    tragen. Das ist gewollt: ein unbestaetigter Wendepunkt taugt nicht als
    Grundlage fuer ein Muster.

    Rueckgabe je Punkt: {"art": "hoch"|"tief", "index": int, "kurs": float}
    """
    if df is None or df.empty or len(df) < links + rechts + 1:
        return []
    hoch = df["high"].to_numpy()
    tief = df["low"].to_numpy()
    punkte: list[dict] = []
    for i in range(links, len(df) - rechts):
        fenster_h = hoch[i - links:i + rechts + 1]
        fenster_t = tief[i - links:i + rechts + 1]
        if hoch[i] == fenster_h.max() and (fenster_h == hoch[i]).sum() == 1:
            punkte.append({"art": "hoch", "index": i, "kurs": float(hoch[i])})
        elif tief[i] == fenster_t.min() and (fenster_t == tief[i]).sum() == 1:
            punkte.append({"art": "tief", "index": i, "kurs": float(tief[i])})
    return punkte


def _gleich_auf(a: float, b: float, atr: float, toleranz: float = TOLERANZ_ATR) -> bool:
    """Liegen zwei Kurse 'auf gleicher Hoehe'? Massstab ist ATR."""
    if not (atr and atr > 0):
        return False
    return abs(a - b) <= atr * toleranz


def _letzte(punkte: list[dict], art: str, anzahl: int) -> list[dict]:
    passend = [p for p in punkte if p["art"] == art]
    return passend[-anzahl:] if len(passend) >= anzahl else []


def doppeltop(punkte: list[dict], df: pd.DataFrame, atr: float) -> Optional[dict]:
    """Zwei Hochs auf gleicher Hoehe, dazwischen ein Tief (die Nackenlinie).

    Bestaetigt ist das Muster erst, wenn der Kurs UNTER die Nackenlinie
    geschlossen hat. Vorher ist es eine Vermutung, kein Muster — genau diese
    Unterscheidung fehlt in den meisten Darstellungen und macht den
    Unterschied zwischen "sieht aus wie" und "ist".
    """
    hochs = _letzte(punkte, "hoch", 2)
    if len(hochs) < 2:
        return None
    links, rechts = hochs[0], hochs[1]
    if not _gleich_auf(links["kurs"], rechts["kurs"], atr):
        return None
    # Das Tief MUSS zwischen den beiden Hochs liegen.
    tiefs = [p for p in punkte
             if p["art"] == "tief" and links["index"] < p["index"] < rechts["index"]]
    if not tiefs:
        return None
    nacken = min(tiefs, key=lambda p: p["kurs"])
    # Die Einbuchtung muss tief genug sein, sonst ist es blosses Rauschen.
    if (min(links["kurs"], rechts["kurs"]) - nacken["kurs"]) < atr * KOPF_MINDEST_ATR:
        return None
    schluss = float(df["close"].iloc[-1])
    return {
        "muster": "DOPPELTOP",
        "richtung": "SHORT",
        "punkte": [links, rechts],
        "nackenlinie": nacken["kurs"],
        "bestaetigt": schluss < nacken["kurs"],
        "hinweis": "bestaetigt sobald ein Schluss unter der Nackenlinie liegt",
    }


def doppelboden(punkte: list[dict], df: pd.DataFrame, atr: float) -> Optional[dict]:
    """Spiegelbild des Doppeltops."""
    tiefs = _letzte(punkte, "tief", 2)
    if len(tiefs) < 2:
        return None
    links, rechts = tiefs[0], tiefs[1]
    if not _gleich_auf(links["kurs"], rechts["kurs"], atr):
        return None
    hochs = [p for p in punkte
             if p["art"] == "hoch" and links["index"] < p["index"] < rechts["index"]]
    if not hochs:
        return None
    nacken = max(hochs, key=lambda p: p["kurs"])
    if (nacken["kurs"] - max(links["kurs"], rechts["kurs"])) < atr * KOPF_MINDEST_ATR:
        return None
    schluss = float(df["close"].iloc[-1])
    return {
        "muster": "DOPPELBODEN",
        "richtung": "LONG",
        "punkte": [links, rechts],
        "nackenlinie": nacken["kurs"],
        "bestaetigt": schluss > nacken["kurs"],
        "hinweis": "bestaetigt sobald ein Schluss ueber der Nackenlinie liegt",
    }


def schulter_kopf_schulter(punkte: list[dict], df: pd.DataFrame,
                           atr: float, umgekehrt: bool = False) -> Optional[dict]:
    """Drei Hochs, das mittlere hoeher als die beiden aeusseren.

    Die beiden Schultern muessen auf gleicher Hoehe liegen (in ATR gemessen),
    der Kopf mindestens KOPF_MINDEST_ATR darueber. Die Nackenlinie verlaeuft
    durch die beiden Tiefs zwischen den Hochs; hier wird der tiefere von beiden
    genommen — das ist die konservative Wahl, weil der Bruch dann spaeter
    gemeldet wird und nicht frueher.
    """
    art = "tief" if umgekehrt else "hoch"
    gegen = "hoch" if umgekehrt else "tief"
    drei = _letzte(punkte, art, 3)
    if len(drei) < 3:
        return None
    ls, kopf, rs = drei
    if not _gleich_auf(ls["kurs"], rs["kurs"], atr):
        return None
    if umgekehrt:
        if kopf["kurs"] > min(ls["kurs"], rs["kurs"]) - atr * KOPF_MINDEST_ATR:
            return None
    else:
        if kopf["kurs"] < max(ls["kurs"], rs["kurs"]) + atr * KOPF_MINDEST_ATR:
            return None
    zwischen = [p for p in punkte
                if p["art"] == gegen and ls["index"] < p["index"] < rs["index"]]
    if len(zwischen) < 2:
        return None
    nacken = (max(zwischen, key=lambda p: p["kurs"])["kurs"] if umgekehrt
              else min(zwischen, key=lambda p: p["kurs"])["kurs"])
    schluss = float(df["close"].iloc[-1])
    return {
        "muster": "INVERSE_SKS" if umgekehrt else "SKS",
        "richtung": "LONG" if umgekehrt else "SHORT",
        "punkte": [ls, kopf, rs],
        "nackenlinie": nacken,
        "bestaetigt": schluss > nacken if umgekehrt else schluss < nacken,
        "hinweis": "bestaetigt sobald ein Schluss die Nackenlinie durchbricht",
    }


def dreieck(punkte: list[dict], df: pd.DataFrame, atr: float) -> Optional[dict]:
    """Verengende Spanne aus je zwei Hochs und zwei Tiefs.

    Drei Formen, unterschieden nach dem, was sich bewegt:
      SYMMETRISCH  Hochs fallen UND Tiefs steigen
      STEIGEND     Hochs bleiben gleich, Tiefs steigen
      FALLEND      Hochs fallen, Tiefs bleiben gleich

    Voraussetzung fuer alle drei: die Spanne muss sich wirklich verengen —
    sonst ist es keine Formation, sondern nur eine Reihe von Wendepunkten.
    """
    hochs = _letzte(punkte, "hoch", 2)
    tiefs = _letzte(punkte, "tief", 2)
    if len(hochs) < 2 or len(tiefs) < 2 or not (atr and atr > 0):
        return None
    h1, h2 = hochs
    t1, t2 = tiefs
    spanne_frueh = max(h1["kurs"], h2["kurs"]) - min(t1["kurs"], t2["kurs"])
    spanne_spaet = abs(h2["kurs"] - t2["kurs"])
    if not (spanne_frueh > 0) or spanne_spaet > spanne_frueh * DREIECK_VERENGUNG:
        return None

    hochs_gleich = _gleich_auf(h1["kurs"], h2["kurs"], atr)
    tiefs_gleich = _gleich_auf(t1["kurs"], t2["kurs"], atr)
    hochs_fallen = h2["kurs"] < h1["kurs"] - atr * TOLERANZ_ATR
    tiefs_steigen = t2["kurs"] > t1["kurs"] + atr * TOLERANZ_ATR

    if hochs_fallen and tiefs_steigen:
        form, richtung = "SYMMETRISCH", "NEUTRAL"
    elif hochs_gleich and tiefs_steigen:
        form, richtung = "STEIGEND", "LONG"
    elif hochs_fallen and tiefs_gleich:
        form, richtung = "FALLEND", "SHORT"
    else:
        return None

    ober = max(h1["kurs"], h2["kurs"])
    unter = min(t1["kurs"], t2["kurs"])

    # DER AUSBRUCH (ergaenzt 10.08.). Bis dahin stand hier fest "bestaetigt:
    # False" — mit der Folge, dass Dreiecke zwar erkannt, aber NIE gemessen
    # werden konnten: die Rueckrechnung zaehlt nur bestaetigte Muster als
    # Richtung. Nachgewiesen ueber alle 30 Symbole: 3485 Erkennungen, null
    # Messungen. Etwas zu bauen, das sich nicht ueberpruefen laesst, ist halbe
    # Arbeit.
    #
    # Die Form (symmetrisch/steigend/fallend) sagt nur, WIE sich die Spanne
    # verengt. Die Richtung kommt vom Ausbruch selbst — ein steigendes Dreieck
    # kann nach unten aufloesen. Deshalb wird "richtung" hier ueberschrieben:
    # was vorher dastand, war die ERWARTUNG, nicht die Beobachtung.
    schluss = float(df["close"].iloc[-1])
    if schluss > ober:
        bestaetigt, richtung = True, "LONG"
    elif schluss < unter:
        bestaetigt, richtung = True, "SHORT"
    else:
        bestaetigt, richtung = False, "NEUTRAL"

    return {
        "muster": f"DREIECK_{form}",
        "richtung": richtung,
        "form": form,
        "punkte": [h1, h2, t1, t2],
        "obergrenze": ober,
        "untergrenze": unter,
        "bestaetigt": bestaetigt,
        "hinweis": "bestaetigt sobald ein Schluss ausserhalb der Spanne liegt; "
                   "die Richtung kommt vom Ausbruch, nicht von der Form",
    }


def erkenne_muster(df: pd.DataFrame) -> dict:
    """Alle Muster auf einem Kerzensatz.

    Rueckgabe enthaelt IMMER den Grund, wenn nichts gefunden wurde — ein
    leeres Ergebnis ohne Begruendung ist im Betrieb nicht von einem Ausfall
    zu unterscheiden.
    """
    if df is None or df.empty:
        return {"muster": [], "grund": "keine Kerzen", "swings": 0, "atr": None}
    atr = atr_wilder(df)
    if not atr:
        return {"muster": [], "grund": f"ATR nicht berechenbar ({len(df)} Kerzen)",
                "swings": 0, "atr": None}
    punkte = alle_swings(df)
    if len(punkte) < 2:
        return {"muster": [], "grund": f"nur {len(punkte)} bestaetigte Wendepunkte",
                "swings": len(punkte), "atr": round(atr, 6)}

    gefunden = [m for m in (
        doppeltop(punkte, df, atr),
        doppelboden(punkte, df, atr),
        schulter_kopf_schulter(punkte, df, atr, umgekehrt=False),
        schulter_kopf_schulter(punkte, df, atr, umgekehrt=True),
        dreieck(punkte, df, atr),
    ) if m is not None]

    return {
        "muster": gefunden,
        "grund": "" if gefunden else "kein Muster in den letzten Wendepunkten",
        "swings": len(punkte),
        "atr": round(atr, 6),
        "toleranzAtr": TOLERANZ_ATR,
    }
