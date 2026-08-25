"""Vier Indikatoren als Signalreihen — ZUM MESSEN, nicht zum Handeln (25.08.).

WOZU. Aus der Ideenliste standen vier Indikatoren offen: Keltner Channel,
Ichimoku, Fibonacci-Retracement und Volume Profile. Keiner davon existierte im
Programm (nachgeprüft: null Fundstellen).

Bevor irgendetwas davon den Handel berührt, wird gemessen, ob es überhaupt
Information trägt. Genau dieselbe Reihenfolge wie bei den Chartmustern — dort
kam heraus, dass KEINES der Muster verlässlich war, und der Einbau in den
Handel unterblieb zu Recht. Wer zuerst baut und danach misst, baut mit hoher
Wahrscheinlichkeit Ballast.

Dieses Modul erzeugt AUSSCHLIESSLICH Signalreihen. Es wird von keinem
Handelspfad importiert und soll es auch nicht.

DIE WICHTIGSTE EIGENSCHAFT: KEIN BLICK IN DIE ZUKUNFT. Das Signal an Balken i
darf nur Daten bis EINSCHLIESSLICH i benutzen. Ein einziger Ausrutscher hier
erzeugt eine Kennzahl, die grossartig aussieht und im Betrieb wertlos ist —
und man sieht es dem Ergebnis nicht an. Deshalb steht in jeder Funktion, bis
wohin geschaut wird, und ein Test prüft es mit vertauschter Zukunft nach.
"""

from typing import Optional

import pandas as pd

LONG = "LONG"
SHORT = "SHORT"
NEUTRAL = "NEUTRAL"

# ── Keltner Channel ──────────────────────────────────────────────────────────
KELTNER_EMA = 20
KELTNER_ATR = 10
KELTNER_FAKTOR = 2.0

# ── Ichimoku Kinko Hyo (Standardwerte 9 / 26 / 52) ───────────────────────────
ICHIMOKU_TENKAN = 9
ICHIMOKU_KIJUN = 26
ICHIMOKU_SENKOU_B = 52

# ── Fibonacci-Retracement ────────────────────────────────────────────────────
FIB_FENSTER = 50
FIB_UNTEN = 0.500
FIB_OBEN = 0.618

# ── Volume Profile ───────────────────────────────────────────────────────────
VP_FENSTER = 50
VP_FAECHER = 24
VP_WERTBEREICH = 0.70


def _ema(werte: pd.Series, spanne: int) -> pd.Series:
    return werte.ewm(span=spanne, adjust=False).mean()


def _atr(df: pd.DataFrame, periode: int) -> pd.Series:
    """True Range, gleitendes Mittel. Bewusst SMA und nicht Wilder — Keltner
    ist so definiert; Wilder steckt in chartmuster.atr_wilder und wird dort
    für die Stop-Berechnung gebraucht."""
    hoch, tief, schluss = df["high"], df["low"], df["close"]
    vorheriger = schluss.shift(1)
    tr = pd.concat([
        hoch - tief,
        (hoch - vorheriger).abs(),
        (tief - vorheriger).abs(),
    ], axis=1).max(axis=1)
    return tr.rolling(periode).mean()


def keltner_signale(df: pd.DataFrame) -> list[str]:
    """Ausbruch aus dem Keltner-Kanal.

    Mitte EMA(20), Breite 2 x ATR(10). Schluss über dem oberen Band ist LONG,
    unter dem unteren SHORT.

    GELESEN ALS AUSBRUCH, nicht als Rückkehr zum Mittel. Beide Lesarten sind
    verbreitet und sie widersprechen sich; welche gemeint ist, gehört
    hingeschrieben, sonst misst man das eine und behauptet das andere.

    Zukunft: `rolling` und `ewm` schauen ausschliesslich zurück. Der Wert an
    Balken i entsteht aus i und davor.
    """
    if df is None or len(df) < max(KELTNER_EMA, KELTNER_ATR) + 1:
        return [NEUTRAL] * (0 if df is None else len(df))
    mitte = _ema(df["close"], KELTNER_EMA)
    breite = _atr(df, KELTNER_ATR)
    oben = mitte + KELTNER_FAKTOR * breite
    unten = mitte - KELTNER_FAKTOR * breite
    aus = []
    for i in range(len(df)):
        c, o, u = df["close"].iloc[i], oben.iloc[i], unten.iloc[i]
        if pd.isna(o) or pd.isna(u):
            aus.append(NEUTRAL)
        elif c > o:
            aus.append(LONG)
        elif c < u:
            aus.append(SHORT)
        else:
            aus.append(NEUTRAL)
    return aus


def ichimoku_signale(df: pd.DataFrame) -> list[str]:
    """Ichimoku: Kurs über der Wolke UND Tenkan über Kijun.

    Beide Bedingungen zusammen — die Wolke allein ist eine Trendaussage, die
    Kreuzung allein ein Zeitpunkt. Verlangt man nur eine, misst man etwas
    anderes als das, was Ichimoku-Anwender meinen.

    ZUKUNFT, der heikle Punkt: Senkou A und B werden per Definition 26 Balken
    NACH VORNE verschoben. Genau deshalb ist die Wolke an Balken i aus Daten
    von Balken i-26 gebaut — sie blickt zurück, nicht vorwärts. Die Chikou-
    Linie (Schluss 26 Balken zurückversetzt) wird ABSICHTLICH NICHT benutzt:
    sie an Balken i zu prüfen hiesse, den Kurs von i mit i-26 zu vergleichen
    und das Ergebnis bei i-26 zu verbuchen — ein Blick in die Zukunft.
    """
    n = 0 if df is None else len(df)
    if df is None or n < ICHIMOKU_SENKOU_B + ICHIMOKU_KIJUN + 1:
        return [NEUTRAL] * n
    hoch, tief, schluss = df["high"], df["low"], df["close"]

    def mittelspanne(periode: int) -> pd.Series:
        return (hoch.rolling(periode).max() + tief.rolling(periode).min()) / 2

    tenkan = mittelspanne(ICHIMOKU_TENKAN)
    kijun = mittelspanne(ICHIMOKU_KIJUN)
    senkou_a = ((tenkan + kijun) / 2).shift(ICHIMOKU_KIJUN)
    senkou_b = mittelspanne(ICHIMOKU_SENKOU_B).shift(ICHIMOKU_KIJUN)

    aus = []
    for i in range(n):
        a, b, t, k, c = (senkou_a.iloc[i], senkou_b.iloc[i],
                         tenkan.iloc[i], kijun.iloc[i], schluss.iloc[i])
        if pd.isna(a) or pd.isna(b) or pd.isna(t) or pd.isna(k):
            aus.append(NEUTRAL)
            continue
        wolke_oben, wolke_unten = max(a, b), min(a, b)
        if c > wolke_oben and t > k:
            aus.append(LONG)
        elif c < wolke_unten and t < k:
            aus.append(SHORT)
        else:
            aus.append(NEUTRAL)
    return aus


def fibonacci_signale(df: pd.DataFrame) -> list[str]:
    """Rücksetzer in die 50–61,8-%-Zone einer Bewegung.

    Regel, bewusst eng und nachrechenbar:
      Fenster: die letzten 50 Balken EINSCHLIESSLICH des aktuellen.
      Hoch und Tief dieses Fensters bestimmen die Bewegung.
      Kam das Hoch NACH dem Tief, war die Bewegung aufwärts; dann ist ein
      Rücksetzer von 50 bis 61,8 % LONG. Umgekehrt SHORT.

    WARUM SO ENG. "Fibonacci" ist ohne feste Regel nicht messbar — welcher
    Schwung, welche Ebene, welche Bestätigung. Wer das offen lässt, kann jedes
    Ergebnis herbeireden. Diese Regel ist eine WAHL, keine Wahrheit; sie steht
    hier, damit die Messung wiederholbar ist.

    Zukunft: das Fenster endet bei i. Die Reihenfolge von Hoch und Tief wird
    innerhalb dieses Fensters bestimmt, nicht darüber hinaus.
    """
    n = 0 if df is None else len(df)
    if df is None or n < FIB_FENSTER:
        return [NEUTRAL] * n
    hoch, tief, schluss = df["high"].values, df["low"].values, df["close"].values
    aus = [NEUTRAL] * n
    for i in range(FIB_FENSTER - 1, n):
        a = i - FIB_FENSTER + 1
        fenster_hoch = hoch[a:i + 1]
        fenster_tief = tief[a:i + 1]
        ih = int(fenster_hoch.argmax())
        it = int(fenster_tief.argmin())
        h, t = float(fenster_hoch[ih]), float(fenster_tief[it])
        spanne = h - t
        if spanne <= 0:
            continue
        c = float(schluss[i])
        if ih > it:                       # Bewegung aufwärts
            rueck = (h - c) / spanne
            if FIB_UNTEN <= rueck <= FIB_OBEN:
                aus[i] = LONG
        elif it > ih:                     # Bewegung abwärts
            rueck = (c - t) / spanne
            if FIB_UNTEN <= rueck <= FIB_OBEN:
                aus[i] = SHORT
    return aus


def volume_profile_signale(df: pd.DataFrame) -> list[str]:
    """Kurs ausserhalb des Wertbereichs (Value Area) des Volumenprofils.

    Regel:
      Fenster: die letzten 50 Balken EINSCHLIESSLICH des aktuellen.
      Das Volumen wird auf 24 Preisfächer verteilt (je Balken auf den
      Mittelpreis (H+L)/2 gebucht — ohne Tickdaten ist eine feinere
      Verteilung nicht belegbar, und Erfundenes hat hier nichts zu suchen).
      Um den volumenstärksten Fächer (POC) wachsen die Grenzen, bis 70 % des
      Volumens eingeschlossen sind — der Wertbereich.
      Schluss über der oberen Grenze ist LONG, unter der unteren SHORT.

    Zukunft: das Fenster endet bei i.

    OHNE VOLUMEN GIBT ES KEIN SIGNAL. Viele Forex-Feeds liefern gar kein oder
    ein synthetisches Volumen; dann steht NEUTRAL, statt eine Zahl zu erfinden.
    """
    n = 0 if df is None else len(df)
    if df is None or n < VP_FENSTER or "volume" not in df.columns:
        return [NEUTRAL] * n
    hoch, tief = df["high"].values, df["low"].values
    schluss, volumen = df["close"].values, df["volume"].values
    aus = [NEUTRAL] * n
    for i in range(VP_FENSTER - 1, n):
        a = i - VP_FENSTER + 1
        preise = (hoch[a:i + 1] + tief[a:i + 1]) / 2.0
        vols = volumen[a:i + 1]
        gesamt = float(vols.sum())
        if gesamt <= 0:
            continue
        p_min, p_max = float(preise.min()), float(preise.max())
        if p_max <= p_min:
            continue
        breite = (p_max - p_min) / VP_FAECHER
        eimer = [0.0] * VP_FAECHER
        for p, v in zip(preise, vols):
            idx = min(VP_FAECHER - 1, int((float(p) - p_min) / breite))
            eimer[idx] += float(v)
        poc = max(range(VP_FAECHER), key=lambda k: eimer[k])
        unten_idx = oben_idx = poc
        summe = eimer[poc]
        # Symmetrisch wachsen, immer zur volumenstaerkeren Seite.
        while summe < VP_WERTBEREICH * gesamt and (unten_idx > 0 or oben_idx < VP_FAECHER - 1):
            links = eimer[unten_idx - 1] if unten_idx > 0 else -1.0
            rechts = eimer[oben_idx + 1] if oben_idx < VP_FAECHER - 1 else -1.0
            if rechts >= links:
                oben_idx += 1
                summe += eimer[oben_idx]
            else:
                unten_idx -= 1
                summe += eimer[unten_idx]
        val = p_min + unten_idx * breite
        vah = p_min + (oben_idx + 1) * breite
        c = float(schluss[i])
        if c > vah:
            aus[i] = LONG
        elif c < val:
            aus[i] = SHORT
    return aus


INDIKATOREN = {
    "keltner": keltner_signale,
    "ichimoku": ichimoku_signale,
    "fibonacci": fibonacci_signale,
    "volume_profile": volume_profile_signale,
}


def alle_signale(df: pd.DataFrame) -> dict[str, list[str]]:
    """Alle vier Reihen auf einmal. Ein Ausfall macht NEUTRAL, nicht leer —
    sonst wären die Reihen ungleich lang und die Auswertung verwürfe alles."""
    n = 0 if df is None else len(df)
    aus: dict[str, list[str]] = {}
    for name, fn in INDIKATOREN.items():
        try:
            reihe = fn(df)
        except Exception:
            reihe = [NEUTRAL] * n
        if len(reihe) != n:
            reihe = (reihe + [NEUTRAL] * n)[:n]
        aus[name] = reihe
    return aus
