"""
Haengt das Ergebnis eines Konsens-Signals von der Volatilitaet ab? (20.08.)

WOZU. Der Live-Pfad skaliert das Risiko nach ATR — getVolatilityAdjustedRisk()
in trade-filters.ts: ueber 3 % nur 40 % Risiko, ueber 2 % 60 %, ueber 1,5 %
80 %, unter 0,3 % 70 %. Diese fuenf Zahlen wurden einmal gesetzt und nie an
der Wirklichkeit geprueft.

Die Verteilungsmessung vom 20.08. zeigte bereits, dass sie nicht passen: alle
zehn Forex-Paare liegen fast dauerhaft unter 0,3 % (EURGBP zu 100 %, USDCAD zu
99,6 %) und werden damit staendig mit 30 % weniger Risiko gehandelt — nicht
weil der Markt ruhig waere, sondern weil 0,3 % ATR auf 4h fuer Forex normal
ist. Am anderen Ende laeuft Oel fast immer in der Hoch-Volatilitaets-Klemme.

Dieses Modul beantwortet die naechste, wichtigere Frage: LOHNT die Skalierung
ueberhaupt? Also — sind Signale in ruhigen Maerkten wirklich schlechter als in
bewegten? Wenn nein, gehoert die Skalierung nicht neu kalibriert, sondern
hinterfragt.

DIE AUSWERTUNG IST NICHT NEU. Es wird bewerte_historie() aus
konsens_auswertung.py verwendet — dieselbe Funktion, die den Konsens und die
Chartmuster misst. Sie bringt die drei Fallen mit, die hier genauso gelten:
RAND (die letzten k Balken haben keine Zukunft), BASIS (die Marktbewegung ueber
dieselben Balken wird abgezogen) und BLOECKE (zusammenhaengende Laeufe sind
keine unabhaengigen Faelle).

WARUM DAS FILTERN FAIR IST. Wie in muster_auswertung._reihe_fuer werden Balken
ausserhalb des Bandes auf NEUTRAL gesetzt. Die Basis bleibt unveraendert, weil
_je_horizont sie ueber ALLE Balken rechnet (konsens_auswertung.py:336) — nicht
nur ueber die Signalbalken. Nachgeprueft, nicht angenommen.

ZWEI BANDSCHNITTE, und der Vergleich zwischen ihnen ist der eigentliche Punkt:

  ABSOLUT   exakt die fuenf Schwellen, die heute im Live-Pfad stehen.
            Beantwortet: trennen die heutigen Schwellen gute von schlechten
            Signalen?

  RELATIV   Fuenftel der EIGENEN ATR-Verteilung des Symbols. Beantwortet:
            waere "ungewoehnlich ruhig FUER DIESES INSTRUMENT" der bessere
            Massstab? Zwischen EURGBP (Median 0,129 %) und USOIL (2,29 %)
            liegt Faktor 18 — eine absolute Schwelle kann fuer beide nicht
            stimmen.
"""

from services.konsens_auswertung import bewerte_historie, RICHTUNGEN

# Exakt die Schwellen aus getVolatilityAdjustedRisk (trade-filters.ts:316).
# Als (Name, untere Grenze exklusiv, obere Grenze inklusiv, Live-Risikofaktor).
# None heisst "keine Grenze".
ABSOLUTE_BAENDER = [
    ("ueber_3.0",   3.0,  None, 0.4),
    ("2.0_bis_3.0", 2.0,  3.0,  0.6),
    ("1.5_bis_2.0", 1.5,  2.0,  0.8),
    ("0.3_bis_1.5", 0.3,  1.5,  1.0),
    ("unter_0.3",   None, 0.3,  0.7),
]

# Anzahl der Faecher beim relativen Schnitt. Fuenf, damit das unterste und das
# oberste Fach je 20 % der Balken halten — genug Faelle fuer eine Aussage und
# fein genug, um Raender zu erkennen.
RELATIVE_FAECHER = 5


def _im_band(wert, unten, oben) -> bool:
    """Untere Grenze exklusiv, obere inklusiv — damit die Baender luecken- und
    ueberschneidungsfrei aneinanderstossen."""
    if wert is None:
        return False
    if unten is not None and wert <= unten:
        return False
    if oben is not None and wert > oben:
        return False
    return True


def _reihe_fuer_band(historie: dict, unten, oben) -> dict:
    """Alle Balken AUSSERHALB des Bandes auf NEUTRAL.

    Gleiches Vorgehen wie muster_auswertung._reihe_fuer, aus demselben Grund:
    bewerte_historie() misst dann nur dieses Band, waehrend die Basis ueber
    alle Balken unveraendert bleibt.
    """
    atr = historie.get("atrPct") or []
    konsens = historie.get("konsens") or []
    gefiltert = [
        konsens[i] if (i < len(atr) and _im_band(atr[i], unten, oben)) else "NEUTRAL"
        for i in range(len(konsens))
    ]
    return {**historie, "konsens": gefiltert}


def _relative_grenzen(atr_werte: list) -> list:
    """Grenzen der Fuenftel der eigenen Verteilung.

    Rueckgabe: RELATIVE_FAECHER-1 Schwellen. Leer, wenn zu wenig brauchbare
    Werte da sind — dann wird der relative Schnitt ausgelassen statt auf einer
    duennen Verteilung geraten.
    """
    sauber = sorted(w for w in atr_werte if w is not None)
    if len(sauber) < RELATIVE_FAECHER * 10:
        return []
    grenzen = []
    for i in range(1, RELATIVE_FAECHER):
        pos = int(len(sauber) * i / RELATIVE_FAECHER)
        grenzen.append(sauber[min(pos, len(sauber) - 1)])
    # Doppelte Grenzen (sehr flache Verteilung) machen leere Faecher — dann
    # lieber gar nicht schneiden als Faecher mit null Faellen ausweisen.
    if len(set(grenzen)) != len(grenzen):
        return []
    return grenzen


def _kennzahlen(teil: dict) -> dict:
    """Zieht aus einem bewerte_historie-Block die Zahlen je Richtung."""
    aus = {}
    for r in RICHTUNGEN:
        e = (teil.get(r) or {})
        aus[r] = {
            "n": int(e.get("n", 0)),
            "mittelPct": e.get("mittelPct"),
            "basisPct": e.get("basisPct"),
            "vorteilPct": e.get("vorteilPct"),
            "trefferPct": e.get("trefferPct"),
        }
    return aus


def bewerte_nach_volatilitaet(historie: dict, horizont: str = "daytrading_24h") -> dict:
    """Bewertet den Konsens je Volatilitaetsband — absolut UND relativ."""
    if historie.get("status") != "ok":
        return {"status": historie.get("status", "unbekannt"),
                "hinweise": historie.get("hinweise", [])}

    atr = historie.get("atrPct") or []
    if not any(w is not None for w in atr):
        return {"status": "kein_atr",
                "hinweise": ["die Reihe traegt kein atrPct — aeltere Historie?"]}

    gesamt = bewerte_historie(historie)
    if gesamt.get("status") != "ok":
        return gesamt

    def _fuer(unten, oben):
        teil = bewerte_historie(_reihe_fuer_band(historie, unten, oben))
        if teil.get("status") != "ok":
            return None
        block = (teil.get("horizonte") or {}).get(horizont, {}).get("alle", {})
        return {
            "kennzahlen": _kennzahlen(block),
            "bloecke": teil.get("bloecke", {}),
        }

    absolut = {}
    for name, unten, oben, faktor in ABSOLUTE_BAENDER:
        e = _fuer(unten, oben)
        if e is not None:
            e["liveRisikoFaktor"] = faktor
            e["balken"] = sum(1 for w in atr if _im_band(w, unten, oben))
            absolut[name] = e

    relativ = {}
    grenzen = _relative_grenzen(atr)
    if grenzen:
        raender = [None] + grenzen + [None]
        for i in range(RELATIVE_FAECHER):
            unten, oben = raender[i], raender[i + 1]
            e = _fuer(unten, oben)
            if e is not None:
                e["balken"] = sum(1 for w in atr if _im_band(w, unten, oben))
                e["grenzen"] = {"unten": unten, "oben": oben}
                relativ[f"fuenftel_{i + 1}"] = e

    sauber = [w for w in atr if w is not None]
    return {
        "symbol": historie.get("symbol"),
        "status": "ok",
        "horizont": horizont,
        "balken": historie.get("balken"),
        "atrVerteilung": {
            "n": len(sauber),
            "min": round(min(sauber), 4) if sauber else None,
            "median": round(sorted(sauber)[len(sauber) // 2], 4) if sauber else None,
            "max": round(max(sauber), 4) if sauber else None,
        },
        "gesamt": (gesamt.get("horizonte") or {}).get(horizont, {}).get("alle", {}),
        "absolut": absolut,
        "relativ": relativ,
        "relativeGrenzen": grenzen,
        "hinweise": list(historie.get("hinweise", [])),
    }
