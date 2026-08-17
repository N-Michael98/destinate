"""
Bewertung des historischen Konsenses (Stufe 4, Schritt 3 — 10.08.).

WOZU. Schritt 2 laesst den ECHTEN 16-Strategien-Konsens durch die Vergangenheit
laufen und liefert die Reihe der Entscheidungen samt Kurs. Er bewertet sie
bewusst nicht. Das geschieht hier: hat der Konsens ueberhaupt Information
getragen — und ab welcher Confidence?

WAS HIER GEMESSEN WIRD, UND WAS NICHT. Gemessen wird die VORWAERTSRENDITE: wie
lief der Kurs nach einem Signal, in dessen Richtung. Es wird KEIN Handel
simuliert. Das ist Absicht und keine Sparmassnahme:

    Der Konsens allein enthaelt weder Stop noch Ziel — die kommen live von GPT.
    Wer hier Stop und Ziel erfindet, misst am Ende seine eigene Erfindung. Genau
    dieser Vorwurf trifft den Walk-Forward ("drei Strategien mit gesetzten
    SL/TP-Varianten"), und ihn hier zu wiederholen waere sinnlos.

Die Vorwaertsrendite beantwortet dafuer die Frage, die vorher niemand
beantworten konnte: traegt unsere Live-Kette Information, oder nicht.

DIE DREI FALLEN, DIE SO EINE AUSWERTUNG WERTLOS MACHEN:

 1. BLICK IN DIE ZUKUNFT AM RAND. Fuer die letzten Balken gibt es die Zukunft
    noch nicht. Sie werden AUSGELASSEN, nicht auf den letzten Kurs geklemmt —
    Klemmen wuerde lauter Nullrenditen erzeugen und das Ergebnis zur Mitte
    ziehen.

 2. KEIN VERGLEICH. "BUY brachte +0,4 %" ist wertlos, wenn der Markt im selben
    Zeitraum ueberall +0,4 % brachte. Jede Zahl steht deshalb neben ihrer
    Basis: derselbe Horizont ueber ALLE Balken, in derselben Richtung. Erst die
    Differenz ist die Leistung des Konsenses.

 3. UEBERLAPPUNG ALS "VIELE FAELLE". Der Konsens haelt ueber viele Balken an.
    500 Balken sind dann keine 500 unabhaengigen Faelle, sondern vielleicht 20
    Bloecke. Beide Zahlen stehen im Ergebnis; die Bloecke sind die ehrlichere.

DATENLAGE. Schritt 2 meldet je Balken, wie viele Strategien nicht mit echten
Daten rechnen konnten (yfinance liefert 15m nur 60 Tage — die Luecke von
scalping sitzt geschlossen am Anfang des Fensters). Jede Kennzahl wird deshalb
ZWEIMAL gerechnet: ueber alle Balken und nur ueber die mit vollstaendigen
Daten. Weichen beide ab, stand nicht der volle Konsens dahinter.
"""

import time
from datetime import datetime, timezone

import httpx
from loguru import logger

from core.config import settings
from services.backtest_engine import WATCHLIST
from services.storage import redis_set_json

REDIS_KEY_KONSENS = "analysis:konsens"
TTL = 8 * 24 * 60 * 60  # 8 Tage — laeuft woechentlich

# Fensterlaenge in Tagen. EINSTELLBAR (User-Vorgabe 10.08.: "wir muessen die
# zeit fenster anpassen so sind wir flexibel"): die Rechnung faellt in
# divine-warmth an, das alle 5 Minuten auch den Live-Scan bedient.
STANDARD_FENSTER_TAGE = 90
# Dieselbe Obergrenze, die der Endpunkt in divine-warmth durchsetzt. Hier
# GEKLEMMT statt ungeprueft geschickt: sonst antwortet das Backend auf jedes
# Symbol mit HTTP 400 und der ganze Lauf liefert stillschweigend nichts.
MAX_FENSTER_TAGE = 180


def _fensterlaenge() -> int:
    roh = int(getattr(settings, "KONSENS_FENSTER_TAGE", 0) or 0)
    if roh <= 0:
        return STANDARD_FENSTER_TAGE
    if roh > MAX_FENSTER_TAGE:
        logger.warning(
            f"[konsens] KONSENS_FENSTER_TAGE={roh} ueberschreitet die Grenze des "
            f"Backends ({MAX_FENSTER_TAGE}) — auf {MAX_FENSTER_TAGE} geklemmt"
        )
        return MAX_FENSTER_TAGE
    return roh


FENSTER_TAGE = _fensterlaenge()

# Sekunden Pause zwischen zwei Symbolen — derselbe Grund wie beim Walk-Forward.
PAUSE_SEK = 2

# Horizonte in Balken des 4h-Takts. NICHT frei gewaehlt, sondern aus den echten
# Zeit-Exits des Systems abgeleitet (risk-agent.ts, STYLE_MAX_HOURS):
#     SCALPING 4h -> 1 Balken, DAYTRADING 24h -> 6, SWING 168h -> 42
# Ein Horizont, den das System nie haelt, wuerde etwas messen, das nie
# eingetreten waere.
HORIZONTE: dict[str, int] = {"scalping_4h": 1, "daytrading_24h": 6, "swing_168h": 42}

# Dieselben Horizonte in STUNDEN — die eigentliche Groesse. Die Balkenzahlen
# oben gelten nur fuer einen 4h-Takt.
#
# FUND 17.08.: die Muster-Auswertung rechnet auf TAGESKERZEN. Dieselben
# Balkenzahlen bedeuten dort 1, 6 und 42 TAGE statt 4h, 24h und 168h — also den
# sechsfachen Zeitraum, ohne dass es irgendwo stuende. Aufgefallen an einem
# unplausiblen Ergebnis (USOIL Doppelboden "+24 % auf 7 Tage"), das in
# Wirklichkeit 42 Tage waren.
#
# Ein Horizont, der kuerzer ist als ein Balken, laesst sich nicht messen und
# wird weggelassen — statt auf 1 Balken aufgerundet zu werden und damit etwas
# anderes zu messen, als sein Name sagt.
HORIZONTE_STUNDEN: dict[str, int] = {
    "scalping_4h": 4, "daytrading_24h": 24, "swing_168h": 168,
}

# Wie viele Stunden ein Balken je Takt umfasst.
TAKT_STUNDEN: dict[str, float] = {"15m": 0.25, "1h": 1, "4h": 4, "1d": 24}


def horizonte_fuer(takt_intervall: str | None) -> dict[str, int]:
    """Horizonte in BALKEN, passend zum Takt der Reihe.

    Bei 4h kommen exakt die Werte oben heraus (1, 6, 42) — das bisherige
    Verhalten bleibt damit unveraendert. Bei einem unbekannten Takt ebenso,
    weil dann nichts Besseres bekannt ist.
    """
    stunden = TAKT_STUNDEN.get(str(takt_intervall or "").lower())
    if not stunden or stunden <= 0:
        return dict(HORIZONTE)
    aus: dict[str, int] = {}
    for name, h in HORIZONTE_STUNDEN.items():
        balken = int(round(h / stunden))
        if balken >= 1:
            aus[name] = balken
    return aus

# Grenzen der Confidence-Staffelung. Die Schnitte bei 75 und 81 sind KEINE
# runden Zahlen, sondern die Schwellen aus den Einstellungen: ab 75 wird
# automatisch freigegeben, ab 81 auch nach Erreichen des Tageslimits. Damit
# beantwortet die Staffelung direkt, ob diese Schwellen richtig liegen.
KONFIDENZ_STUFEN: list[tuple[int, int]] = [
    (0, 60), (60, 70), (70, 75), (75, 81), (81, 90), (90, 101),
]

# Die Etiketten, die analyze_all_strategies() TATSAECHLICH vergibt
# (trading_strategies.py: "LONG" / "SHORT" / "NEUTRAL").
#
# HIER STAND ZUERST ("BUY", "SELL"). Kein Unittest hat das gefunden — sie
# bekamen die erfundenen Etiketten mit, gegen die sie geschrieben waren. Erst
# der Lauf gegen echte EURUSD-Daten zeigte die Verteilung {SHORT: 52, LONG: 55}
# und damit, dass die Auswertung in Produktion fuer JEDES Symbol n=0 gemeldet
# haette: eine Auswertung, die still nichts auswertet.
# Deshalb unten zusaetzlich der Riegel auf unbekannte Etiketten.
RICHTUNGEN = ("LONG", "SHORT")
NEUTRAL = "NEUTRAL"


def hole_historie(symbol: str, tage: int = FENSTER_TAGE) -> dict | None:
    """Holt die Konsens-Reihe von divine-warmth. None bei Fehler."""
    if not settings.PYTHON_BACKEND_URL:
        logger.warning("[konsens] PYTHON_BACKEND_URL nicht gesetzt — uebersprungen")
        return None
    try:
        antwort = httpx.get(
            f"{settings.PYTHON_BACKEND_URL}/api/v1/strategies/historie/{symbol}",
            params={"tage": tage},
            headers={"X-Backend-Key": settings.BACKEND_API_KEY} if settings.BACKEND_API_KEY else {},
            # Grosszuegig: der Lauf rechnet je Balken den vollen 16-Strategien-
            # Konsens (gemessen rund 52 ms), 90 Tage auf 4h sind ueber 500
            # Balken. Ein zu knapper Timeout wuerde die Arbeit wegwerfen,
            # nachdem sie bereits geleistet wurde.
            timeout=600,
        )
        if antwort.status_code != 200:
            logger.warning(
                f"[konsens] {symbol}: HTTP {antwort.status_code} — {antwort.text[:120]}"
            )
            return None
        return antwort.json()
    except Exception as e:
        logger.warning(f"[konsens] {symbol}: {type(e).__name__}: {e}")
        return None


def _vorwaerts_rendite(kurse: list[float], i: int, k: int) -> float | None:
    """Rendite von Balken i nach k Balken. None, wenn die Zukunft fehlt.

    None statt 0.0: die letzten k Balken haben keine Zukunft. Wer sie als
    Nullrendite zaehlt, zieht jeden Mittelwert Richtung null und meldet umso
    mehr "Faelle", je naeher am Rand er rechnet.
    """
    ziel = i + k
    if ziel >= len(kurse):
        return None
    start = kurse[i]
    if start == 0:
        return None
    return (kurse[ziel] - start) / start


def bloecke(konsens: list[str]) -> list[tuple[int, int, str]]:
    """Zusammenhaengende Laeufe gleicher Richtung: (start, ende, richtung).

    Grundlage fuer die ehrliche Fallzahl — siehe Falle 3 im Modulkopf.
    """
    if not konsens:
        return []
    ergebnis: list[tuple[int, int, str]] = []
    start = 0
    for i in range(1, len(konsens) + 1):
        if i == len(konsens) or konsens[i] != konsens[start]:
            ergebnis.append((start, i - 1, konsens[start]))
            start = i
    return ergebnis


def _kennzahlen(renditen: list[float]) -> dict:
    """Mittel, Median und Trefferquote. Leere Liste -> Nullen mit n=0."""
    n = len(renditen)
    if n == 0:
        return {"n": 0, "mittelPct": 0.0, "medianPct": 0.0, "trefferPct": 0.0}
    sortiert = sorted(renditen)
    mitte = n // 2
    median = sortiert[mitte] if n % 2 else (sortiert[mitte - 1] + sortiert[mitte]) / 2
    return {
        "n": n,
        "mittelPct": round(sum(renditen) / n * 100, 4),
        "medianPct": round(median * 100, 4),
        "trefferPct": round(sum(1 for r in renditen if r > 0) / n * 100, 1),
    }


def _richtungsrendite(rendite: float, richtung: str) -> float:
    """Bei SHORT zaehlt der fallende Kurs als Gewinn.

    Das Etikett stammt aus RICHTUNGEN und nicht aus einer zweiten, hier
    hingeschriebenen Zeichenkette: beim ersten Entwurf stand oben "SELL" und
    hier ebenfalls — ein Umbenennen an einer Stelle haette die Umkehr still
    ausfallen lassen, und jedes Short-Signal waere als Verlust gebucht worden.
    """
    return -rendite if richtung == RICHTUNGEN[1] else rendite


def bewerte_historie(historie: dict) -> dict:
    """Rechnet die Konsens-Reihe in Kennzahlen um.

    Jede Kennzahl entsteht zweimal: ueber alle Balken ("alle") und nur ueber
    die mit vollstaendigen Strategiedaten ("vollstaendig"). Weichen sie ab,
    stand hinter dem einen Teil des Fensters nicht derselbe Konsens.
    """
    if historie.get("status") != "ok":
        return {
            "status": historie.get("status", "unbekannt"),
            "hinweise": historie.get("hinweise", []),
        }

    kurse = [float(k) for k in historie.get("kurs", [])]
    konsens = [str(k) for k in historie.get("konsens", [])]
    conf = [int(c) for c in historie.get("konsensConf", [])]
    tiers = [str(t) for t in historie.get("entryQualityTier", [])]
    ohne_daten = [int(x) for x in historie.get("strategienOhneDaten", [])]

    n = len(kurse)
    if n == 0 or len(konsens) != n:
        return {
            "status": "unbrauchbar",
            "hinweise": [f"Reihen ungleich lang: kurs={n}, konsens={len(konsens)}"],
        }
    # Fehlt die Luecken-Reihe (aelteres Backend), gilt alles als vollstaendig —
    # aber das wird vermerkt, statt es als Tatsache auszugeben.
    reihe_fehlt = len(ohne_daten) != n
    if reihe_fehlt:
        ohne_daten = [0] * n

    vollstaendig = [i for i in range(n) if ohne_daten[i] == 0]

    ergebnis: dict = {
        "symbol": historie.get("symbol"),
        "status": "ok",
        "balken": n,
        "balkenVollstaendig": len(vollstaendig),
        "von": historie.get("von"),
        "bis": historie.get("bis"),
        "fensterTage": historie.get("fensterTage"),
        "taktIntervall": historie.get("taktIntervall"),
        "strategienMitLuecken": historie.get("strategienMitLuecken", {}),
        "hinweise": list(historie.get("hinweise", [])),
    }
    if reihe_fehlt:
        ergebnis["hinweise"].append(
            "strategienOhneDaten fehlt — 'vollstaendig' ist hier identisch mit 'alle'"
        )

    # Verteilung der Entscheidungen. Sagt ein Konsens fast immer dasselbe, ist
    # jede Trefferquote nur die Marktrichtung.
    verteilung: dict[str, int] = {}
    for k in konsens:
        verteilung[k] = verteilung.get(k, 0) + 1
    ergebnis["verteilung"] = verteilung

    # RIEGEL GEGEN DAS STILLE NICHTS. Wird ein Etikett im Backend umbenannt,
    # zaehlt diese Auswertung ohne Warnung ueberall n=0 — sie sieht dann aus
    # wie ein Ergebnis ("keine Signale"), ist aber blind. Genau das war beim
    # ersten Entwurf der Fall (dort stand BUY/SELL statt LONG/SHORT), und kein
    # Test hat es gefunden. Ein unbekanntes Etikett muss deshalb DASTEHEN.
    unbekannt = sorted(set(verteilung) - set(RICHTUNGEN) - {NEUTRAL})
    if unbekannt:
        ergebnis["unbekannteEtiketten"] = unbekannt
        ergebnis["hinweise"].append(
            f"unbekannte Konsens-Etiketten {unbekannt} — diese Balken werden "
            f"NICHT ausgewertet; erwartet wird {list(RICHTUNGEN) + [NEUTRAL]}"
        )
    if not any(verteilung.get(r, 0) for r in RICHTUNGEN):
        ergebnis["hinweise"].append(
            f"kein einziges Signal in {list(RICHTUNGEN)} — vorhanden war "
            f"{sorted(verteilung)}"
        )

    alle_bloecke = bloecke(konsens)
    ergebnis["bloecke"] = {
        richtung: sum(1 for _, _, r in alle_bloecke if r == richtung)
        for richtung in RICHTUNGEN
    }
    ergebnis["bloeckeGesamt"] = len(alle_bloecke)

    # Horizonte passend zum TAKT der Reihe — auf Tageskerzen bedeuten dieselben
    # Balkenzahlen den sechsfachen Zeitraum (Fund 17.08.).
    horizonte = horizonte_fuer(historie.get("taktIntervall"))
    ergebnis["horizonteBalken"] = horizonte
    ergebnis["horizonte"] = {
        name: _je_horizont(kurse, konsens, k, vollstaendig, n)
        for name, k in horizonte.items()
    }
    leit = horizonte.get("daytrading_24h") or next(iter(horizonte.values()), 1)
    ergebnis["konfidenz"] = _je_konfidenz(kurse, konsens, conf, leit)
    ergebnis["entryQuality"] = _je_tier(kurse, konsens, tiers, leit)
    return ergebnis


def _je_horizont(kurse: list[float], konsens: list[str], k: int,
                 vollstaendig: list[int], n: int) -> dict:
    """Ein Horizont, je Richtung, mit Basis und Vorteil."""
    block: dict = {"balken": k}
    for etikett, indizes in (("alle", range(n)), ("vollstaendig", vollstaendig)):
        # Die Basis ist die Marktbewegung ueber DIESELBEN Balken, in die der
        # Vergleich faellt — ohne sie ist keine Zahl deutbar (Falle 2).
        markt = [r for i in indizes
                 if (r := _vorwaerts_rendite(kurse, i, k)) is not None]
        basis_mittel = sum(markt) / len(markt) if markt else 0.0

        teil: dict = {"basisMarktPct": round(basis_mittel * 100, 4),
                      "basisN": len(markt)}
        for richtung in RICHTUNGEN:
            renditen = [
                _richtungsrendite(r, richtung)
                for i in indizes
                if konsens[i] == richtung
                and (r := _vorwaerts_rendite(kurse, i, k)) is not None
            ]
            kz = _kennzahlen(renditen)
            basis = _richtungsrendite(basis_mittel, richtung) * 100
            kz["basisPct"] = round(basis, 4)
            kz["vorteilPct"] = round(kz["mittelPct"] - basis, 4)
            teil[richtung] = kz
        block[etikett] = teil
    return block


def _je_konfidenz(kurse: list[float], konsens: list[str], conf: list[int],
                  leit_horizont: int) -> dict:
    """Staffelung nach Confidence — beantwortet, ob 75 richtig liegt.

    Gerechnet auf dem Daytrading-Horizont: das ist der Standard-Handelsstil,
    und eine Staffelung ueber drei Horizonte gleichzeitig liest niemand.
    """
    k = leit_horizont
    stufen: dict = {}
    for unten, oben in KONFIDENZ_STUFEN:
        renditen: list[float] = []
        for i, richtung in enumerate(konsens):
            if richtung not in RICHTUNGEN:
                continue
            if i >= len(conf) or not (unten <= conf[i] < oben):
                continue
            r = _vorwaerts_rendite(kurse, i, k)
            if r is not None:
                renditen.append(_richtungsrendite(r, richtung))
        stufen[f"{unten}-{oben - 1}"] = _kennzahlen(renditen)
    return {"horizontBalken": k, "stufen": stufen}


def _je_tier(kurse: list[float], konsens: list[str], tiers: list[str],
             leit_horizont: int) -> dict:
    """Dasselbe nach Entry-Quality-Stufe."""
    k = leit_horizont
    gruppen: dict[str, list[float]] = {}
    for i, richtung in enumerate(konsens):
        if richtung not in RICHTUNGEN or i >= len(tiers):
            continue
        r = _vorwaerts_rendite(kurse, i, k)
        if r is not None:
            gruppen.setdefault(tiers[i], []).append(_richtungsrendite(r, richtung))
    return {
        "horizontBalken": k,
        "stufen": {name: _kennzahlen(werte) for name, werte in sorted(gruppen.items())},
    }


def run_konsens_auswertung() -> None:
    """Wrapper mit Fern-Diagnose (gleiches Muster wie run_walk_forward)."""
    try:
        _run_konsens_auswertung_inner()
    except Exception as e:
        import traceback
        logger.error(f"[konsens] ABGESTUERZT: {e}\n{traceback.format_exc()}")
        redis_set_json(REDIS_KEY_KONSENS, {
            "status": "error",
            "error": str(e),
            "trace": traceback.format_exc()[-1500:],
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }, TTL)


def _run_konsens_auswertung_inner() -> None:
    begonnen = time.time()
    logger.info(f"[konsens] Lauf gestartet — Fenster {FENSTER_TAGE} Tage")

    ergebnisse: dict[str, dict] = {}
    for idx, symbol in enumerate(WATCHLIST):
        redis_set_json(REDIS_KEY_KONSENS, {
            "status": "running",
            "progress": f"{idx}/{len(WATCHLIST)}",
            "currentSymbol": symbol,
            "elapsedSec": round(time.time() - begonnen),
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }, TTL)

        historie = hole_historie(symbol)
        if historie is None:
            continue
        bewertung = bewerte_historie(historie)
        if bewertung.get("status") != "ok":
            logger.warning(
                f"[konsens] {symbol}: {bewertung.get('status')} — "
                f"{'; '.join(bewertung.get('hinweise', [])[:2])}"
            )
            continue
        ergebnisse[symbol] = bewertung
        tag = bewertung["horizonte"]["daytrading_24h"]["alle"]
        # Ueber RICHTUNGEN gebildet, nicht mit hingeschriebenen Namen: hier
        # stand BUY/SELL und haette beim ersten echten Lauf mit KeyError
        # abgebrochen — an einer Stelle, die kein Test beruehrt.
        teile = " ".join(
            f"{r} n={tag[r]['n']} vorteil={tag[r]['vorteilPct']}%," for r in RICHTUNGEN
        )
        logger.info(f"[konsens] {symbol}: {bewertung['balken']} Balken, {teile}")
        if bewertung.get("unbekannteEtiketten"):
            logger.warning(
                f"[konsens] {symbol}: unbekannte Etiketten "
                f"{bewertung['unbekannteEtiketten']} — nicht ausgewertet"
            )
        time.sleep(PAUSE_SEK)

    zusammenfassung = {
        "status": "done",
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "durationSec": round(time.time() - begonnen),
        "fensterTage": FENSTER_TAGE,
        "horizonte": HORIZONTE,
        "symbole": len(ergebnisse),
        "results": ergebnisse,
    }
    ok = redis_set_json(REDIS_KEY_KONSENS, zusammenfassung, TTL)
    logger.info(
        f"[konsens] fertig — {len(ergebnisse)} Symbole in "
        f"{zusammenfassung['durationSec']}s, Redis={'ok' if ok else 'FEHLER'}"
    )
