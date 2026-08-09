"""
Tests fuer die Analysis-Engine.

WARUM ES DIESE DATEI GIBT (07.08.): analysis-engine hatte bis heute KEINEN
einzigen Test. Der Pruefer python-services hat die Dateien nur uebersetzt
(py_compile) — Uebersetzen findet Syntaxfehler, aber keinen falschen Zaehler.
Genau hier entsteht aber die Lerngrundlage des Systems: wer den Ausstiegsgrund
falsch gruppiert, verfaelscht jede spaetere Auswertung, ohne dass irgendwo
etwas rot wird.

Die Dienste importieren loguru und services.storage (Redis/Postgres). Beides
wird hier ersetzt, damit die reine Rechenlogik ohne Netz und ohne Datenbank
pruefbar ist. Getestet wird die ECHTE Funktion aus der echten Datei.
"""

import json
import sys
import types
from pathlib import Path

# Wurzel der Engine in den Suchpfad — die Dienste importieren "services.x"
_WURZEL = Path(__file__).resolve().parent.parent
if str(_WURZEL) not in sys.path:
    sys.path.insert(0, str(_WURZEL))

# loguru ersetzen (gehoert zur Engine, nicht zum Backend-venv)
if "loguru" not in sys.modules:
    _lg = types.ModuleType("loguru")

    class _StillerLogger:
        def info(self, *a, **k): pass
        def warning(self, *a, **k): pass
        def error(self, *a, **k): pass

    _lg.logger = _StillerLogger()
    sys.modules["loguru"] = _lg

# services.storage ersetzen — die Testdaten werden je Test gesetzt
_ZEILEN: list = []
_REDIS: dict = {}
if "services.storage" not in sys.modules:
    _st = types.ModuleType("services.storage")
    _st.pg_query = lambda *a, **k: _ZEILEN
    _st.pg_execute = lambda *a, **k: None      # backtest_engine importiert das
    _st.redis_get_json = lambda k: _REDIS.get(k)
    _st.redis_set_json = lambda *a, **k: True
    sys.modules["services.storage"] = _st

# vectorbt ist lokal NICHT installiert und soll es auch nicht werden: es
# verlangt numpy<2, der lokale Stand ist numpy 2.4.6 / pandas 3.0.3. Ein
# Downgrade wuerde die laufende Testumgebung beschaedigen, um einen Test zu
# gewinnen — ein schlechter Tausch. Stattdessen wird das Paket ersetzt und
# abgefangen, WELCHE Signale ankommen. Geprueft wird damit unsere Logik.
_mitgegeben: dict = {}
if "vectorbt" not in sys.modules:
    class _FakePortfolio:
        @staticmethod
        def from_signals(close, entries, exits, short_entries=None, short_exits=None, **kw):
            import numpy as _n
            _mitgegeben["entries"] = entries
            _mitgegeben["short_entries"] = short_entries
            p = types.SimpleNamespace()
            p.trades = types.SimpleNamespace(
                pnl=types.SimpleNamespace(values=_n.array([1.0, -0.5, 2.0]))
            )
            p.total_return = lambda: 0.1
            p.max_drawdown = lambda: -0.05
            p.sharpe_ratio = lambda: 1.0
            return p

    _vbt = types.ModuleType("vectorbt")
    _vbt.Portfolio = _FakePortfolio
    sys.modules["vectorbt"] = _vbt

if "core.config" not in sys.modules:
    _cfg = types.ModuleType("core.config")
    _cfg.settings = types.SimpleNamespace()
    sys.modules["core.config"] = _cfg

from services.data_collector import _aggregate, _exit_grund, _spread_je_symbol   # noqa: E402
from services.periodic_report import _exit_reason_breakdown          # noqa: E402
from services.recommendations import _build_recommendations          # noqa: E402


def _notiz(grund=None, **rest):
    d = dict(rest)
    if grund:
        d["exitReason"] = grund
    return json.dumps(d)


# ── Ausstiegsgrund aus den Notizen lesen ─────────────────────────────────────

def test_exit_grund_liest_den_wert():
    assert _exit_grund(_notiz("ZIEL")) == "ZIEL"
    assert _exit_grund(_notiz("STOP")) == "STOP"
    assert _exit_grund(_notiz("DAZWISCHEN")) == "DAZWISCHEN"


def test_exit_grund_ist_robust_gegen_kaputte_notizen():
    """Alte Trades, leere Felder und ungueltiges JSON duerfen nicht werfen.

    500 Trades liegen bereits in der Datenbank, alle OHNE dieses Feld. Wirft
    die Funktion dort, faellt der ganze Data-Collector aus — und mit ihm die
    Grundlage fuer Forward-Test und Learning-Report.
    """
    for wert in [None, "", "kein json", "{}", '{"exitReason": null}', "[]", "null"]:
        assert _exit_grund(wert) == "OHNE_ANGABE", f"fehlgeschlagen bei {wert!r}"


# ── Gruppierung im Data-Collector ────────────────────────────────────────────

def _zeile(result, pnl, notes, markt="GBPUSD"):
    # (market, direction, strategy, result, profitLoss, date, notes)
    return (markt, "BUY", "gpt", result, pnl, None, notes)


def test_aggregat_gruppiert_nach_ausstiegsgrund():
    zeilen = [
        _zeile("WIN", 2.5, _notiz("ZIEL")),
        _zeile("LOSS", -5.0, _notiz("STOP")),
        _zeile("LOSS", -4.0, _notiz("STOP")),
        _zeile("WIN", 0.3, _notiz("DAZWISCHEN")),
    ]
    r = _aggregate(zeilen)
    nach = r["byExitReason"]
    assert nach["ZIEL"]["trades"] == 1
    assert nach["STOP"]["trades"] == 2
    assert nach["STOP"]["pnl"] == -9.0
    assert nach["DAZWISCHEN"]["winRate"] == 100.0


def test_aggregat_zaehlt_jeden_trade_genau_einmal():
    """Die Summe der Gruppen muss der Gesamtzahl entsprechen.

    Sonst wird still ein Teil der Trades unterschlagen und jede Auswertung
    darauf ist falsch, ohne dass es auffaellt.
    """
    zeilen = [
        _zeile("WIN", 1.0, _notiz("ZIEL")),
        _zeile("LOSS", -1.0, _notiz("STOP")),
        _zeile("WIN", 0.5, _notiz("DAZWISCHEN")),
        _zeile("WIN", 1.0, _notiz(None, dealId="alt")),   # alter Trade
        _zeile("LOSS", -1.0, None),                       # gar keine Notizen
    ]
    r = _aggregate(zeilen)
    summe = sum(e["trades"] for e in r["byExitReason"].values())
    assert summe == len(zeilen)
    assert round(sum(e["pnl"] for e in r["byExitReason"].values()), 2) == r["total"]["pnl"]


def test_aggregat_laesst_die_bestehenden_gruppen_unberuehrt():
    """byMarket und byStrategy gab es vorher — sie duerfen nicht verschwinden."""
    r = _aggregate([_zeile("WIN", 1.0, _notiz("ZIEL"), markt="NAS100")])
    assert "byMarket" in r and "byStrategy" in r and "byExitReason" in r
    assert r["byMarket"]["NAS100"]["trades"] == 1


# ── Auswertung im Wochen-Report ──────────────────────────────────────────────

def test_report_gruppiert_nach_ausstiegsgrund():
    _ZEILEN[:] = [
        ("WIN", 2.48, _notiz("ZIEL")),
        ("LOSS", -5.0, _notiz("STOP")),
        ("LOSS", -4.2, _notiz("STOP")),
        ("WIN", 0.21, _notiz("DAZWISCHEN")),
    ]
    r = _exit_reason_breakdown(7)
    assert r["STOP"]["trades"] == 2
    assert r["STOP"]["pnl"] == -9.2
    assert r["ZIEL"]["winRate"] == 100.0


def test_report_trennt_alte_trades_ab():
    """Trades ohne das Feld duerfen die benannten Gruppen nicht verfaelschen."""
    _ZEILEN[:] = [
        ("WIN", 1.0, _notiz("ZIEL")),
        ("WIN", 99.0, None),          # alt, ohne Angabe
        ("LOSS", -99.0, "{}"),        # alt, leere Notizen
    ]
    r = _exit_reason_breakdown(7)
    assert r["ZIEL"]["pnl"] == 1.0, "alte Trades sind in die Gruppe ZIEL geraten"
    assert r["OHNE_ANGABE"]["trades"] == 2


def test_report_ohne_daten_faellt_nicht_um():
    _ZEILEN[:] = []
    assert _exit_reason_breakdown(7) == {}


# ── Vorschlaege duerfen dem Walk-Forward nicht widersprechen (07.08.) ────────
# ANLASS, belegt aus dem Telegram-Bericht vom 09.08.: alle DREI Vorschlaege des
# Tages (DJ30, USDCAD, UK100) standen im selben Wochen-Report unter
# "Overfitting-Verdacht". recommendations.py las den Walk-Forward gar nicht.

from datetime import datetime, timedelta, timezone   # noqa: E402


def _lage(ueberangepasst=("DJ30", "USDCAD", "UK100"), status="done",
          alter_tage=3.1, mit_walkforward=True):
    _REDIS.clear()
    _REDIS["analysis:trade_stats"] = {"last30d": {"byMarket": {
        "DJ30":   {"trades": 3,  "winRate": 0.0,  "pnl": -30.04},
        "USDCAD": {"trades": 13, "winRate": 14.3, "pnl": -27.14},
        "UK100":  {"trades": 8,  "winRate": 0.0,  "pnl": -16.8},
        "EURUSD": {"trades": 5,  "winRate": 20.0, "pnl": -9.0},
    }}}
    _REDIS["analysis:backtests"] = {"bestPerSymbol": {
        "DJ30":   {"strategy": "RSI_REVERSION", "params": {}, "winRate": 66.7,
                   "profitFactor": 1.58, "trades": 12, "sl": 0.02, "tp": 0.04},
        "USDCAD": {"strategy": "EMA_CROSS", "params": {}, "winRate": 32.0,
                   "profitFactor": 1.52, "trades": 25, "sl": 0.01, "tp": 0.02},
        "UK100":  {"strategy": "RSI_REVERSION", "params": {}, "winRate": 81.2,
                   "profitFactor": 4.11, "trades": 16, "sl": 0.02, "tp": 0.04},
        "EURUSD": {"strategy": "EMA_CROSS", "params": {}, "winRate": 55.0,
                   "profitFactor": 1.60, "trades": 20, "sl": 0.01, "tp": 0.02},
    }}
    if mit_walkforward:
        _REDIS["analysis:walkforward"] = {
            "status": status,
            "updatedAt": (datetime.now(timezone.utc)
                          - timedelta(days=alter_tage)).isoformat(),
            "overfitWarningSymbols": list(ueberangepasst),
            "robustSymbols": ["EURUSD"],
        }


def test_vorschlaege_halten_ueberangepasste_maerkte_zurueck():
    """Der Fall vom 09.08.: 3 von 3 Vorschlaegen waren ueberangepasst."""
    _lage()
    recs, zurueck = _build_recommendations()
    assert sorted(zurueck) == ["DJ30", "UK100", "USDCAD"]
    assert [r["symbol"] for r in recs] == ["EURUSD"]


def test_vorschlaege_ohne_walkforward_wie_bisher():
    """Ein fehlender Walk-Forward darf die Vorschlaege NICHT stilllegen.

    Sonst faellt bei einem Redis-Aussetzer oder einem abgestuerzten Lauf die
    ganze Empfehlungs-Engine still aus — schlimmer als der Widerspruch.
    """
    _lage(mit_walkforward=False)
    recs, zurueck = _build_recommendations()
    assert zurueck == []
    assert len(recs) == 4


def test_vorschlaege_ignorieren_zu_alten_walkforward():
    """Sieben Tage — dieselbe Grenze wie insights-reader.ts im Frontend."""
    _lage(alter_tage=8.0)
    recs, zurueck = _build_recommendations()
    assert zurueck == [], "ein 8 Tage alter Lauf darf nicht mehr filtern"
    assert len(recs) == 4

    _lage(alter_tage=6.9)
    recs, zurueck = _build_recommendations()
    assert len(zurueck) == 3, "ein 6.9 Tage alter Lauf muss noch filtern"


def test_vorschlaege_ignorieren_unfertigen_walkforward():
    for status in ["running", "error", ""]:
        _lage(status=status)
        recs, zurueck = _build_recommendations()
        assert zurueck == [], f"status={status} darf nicht filtern"


def test_vorschlaege_ohne_warnung_bleiben_vollstaendig():
    _lage(ueberangepasst=())
    recs, zurueck = _build_recommendations()
    assert zurueck == []
    assert len(recs) == 4


def test_vorschlaege_halten_nur_die_gemeldeten_zurueck():
    _lage(ueberangepasst=("UK100",))
    recs, zurueck = _build_recommendations()
    assert zurueck == ["UK100"]
    assert "UK100" not in [r["symbol"] for r in recs]
    assert len(recs) == 3


# ── Walk-Forward gehaertet (07.08.) ──────────────────────────────────────────

import numpy as _np                                                   # noqa: E402
import pandas as _pd                                                  # noqa: E402
from services.backtest_engine import (                                # noqa: E402
    _vorlauf, _run_single, _signals, VORLAUF_FAKTOR,
)
import services.walk_forward as _WF                                   # noqa: E402


def test_vorlauf_liest_den_richtigen_parameter():
    assert _vorlauf("EMA_CROSS", {"fast": 12, "slow": 26}) == 26
    assert _vorlauf("EMA_CROSS", {"fast": 20, "slow": 50}) == 50
    assert _vorlauf("RSI_REVERSION", {"period": 14}) == 14
    assert _vorlauf("BREAKOUT", {"entry_window": 55, "exit_window": 20}) == 55
    assert _vorlauf("BREAKOUT", {"entry_window": 10, "exit_window": 55}) == 55
    assert _vorlauf("UNBEKANNT", {}) == 0


def test_vorlauf_faktor_bleibt_bei_drei():
    """Gemessen, nicht gewaehlt.

    Groesster tatsaechlicher Bedarf: 105 Balken fuer EMA slow=50, also das
    2.1-fache des Parameters. Faktor 3 deckt das mit Reserve — gegengeprueft
    ueber 15 Kursverlaeufe (5 Startwerte x 3 Volatilitaeten, je 10
    Parametersaetze): 150 Vergleiche, 0 Abweichungen gegenueber dem Ergebnis
    mit vollem Vorlauf. Wer die Zahl senkt, muss diese Messung wiederholen.
    """
    assert VORLAUF_FAKTOR == 3


def _kursreihe(n=600, seed=3):
    _np.random.seed(seed)
    return _pd.Series(100 * _np.exp(_np.cumsum(_np.random.normal(0, 0.004, n))))


def test_kein_einstieg_vor_dem_testfenster():
    """Der Vorlauf darf den Indikator waermen, aber nicht handeln."""
    kurs = _kursreihe()
    for ab in [50, 200, 400]:
        _mitgegeben.clear()
        _run_single(kurs, "BREAKOUT", {"entry_window": 10, "exit_window": 5},
                    0.02, 0.04, ab_index=ab)
        e = _mitgegeben["entries"]
        se = _mitgegeben["short_entries"]
        assert int(e.iloc[:ab].sum()) == 0, f"Einstieg vor ab_index={ab}"
        assert int(se.iloc[:ab].sum()) == 0, f"Short-Einstieg vor ab_index={ab}"
        assert int(e.iloc[ab:].sum() + se.iloc[ab:].sum()) > 0, "gar keine Einstiege mehr"


def test_ohne_ab_index_bleibt_alles_wie_bisher():
    """Der naechtliche Backtest ruft _run_single OHNE ab_index auf.

    Er darf sich durch diese Aenderung um kein Bit unterscheiden — sonst waere
    eine funktionierende Auswertung nebenbei veraendert worden.
    """
    kurs = _kursreihe()
    params = {"entry_window": 10, "exit_window": 5}
    e_roh, _, se_roh, _ = _signals(kurs, "BREAKOUT", params)
    _mitgegeben.clear()
    _run_single(kurs, "BREAKOUT", params, 0.02, 0.04)
    assert bool((_mitgegeben["entries"].values == e_roh.values).all())
    assert bool((_mitgegeben["short_entries"].values == se_roh.values).all())


def test_auswahl_verlangt_mindestzahl_trades():
    """Ein hoher ProfitFactor auf zwei Trades darf nicht gewinnen.

    Genau so entsteht Ueberanpassung. Die 10 ist keine neue Zahl —
    recommendations.py verlangt seit dem 30.07. dieselbe Huerde, bevor ein
    Backtest-Ergebnis einen Vorschlag begruenden darf.
    """
    assert _WF.MIN_TRADES_FUER_AUSWAHL == 10
    # ZWEI Kombinationen, damit _best_on_slice auch zweimal fragt — die erste
    # Fassung dieses Tests gab zwei Ergebnisse vor, liess aber nur EINEN Aufruf
    # zu und schlug dadurch faelschlich fehl.
    param = {"EMA_CROSS": [{"fast": 12, "slow": 26}, {"fast": 9, "slow": 21}]}
    sltp = [{"sl": 0.01, "tp": 0.02}]
    ergebnisse = iter([
        {"profitFactor": 9.9, "trades": 2, "winRate": 100.0},
        {"profitFactor": 1.6, "trades": 40, "winRate": 55.0},
    ])
    alt = _WF._run_single
    _WF._run_single = lambda *a, **k: next(ergebnisse, None)
    try:
        best = _WF._best_on_slice(_pd.Series([1.0] * 50), param, sltp)
    finally:
        _WF._run_single = alt
    assert best is not None
    assert best["trades"] == 40, "der Satz mit 2 Trades hat gewonnen"


def test_auswahl_gibt_lieber_nichts_zurueck():
    """Faellt alles unter die Huerde: kein Urteil statt eines schlechten."""
    param = {"EMA_CROSS": [{"fast": 12, "slow": 26}, {"fast": 9, "slow": 21}]}
    sltp = [{"sl": 0.01, "tp": 0.02}]
    ergebnisse = iter([{"profitFactor": 9.9, "trades": 2}, {"profitFactor": 5.0, "trades": 4}])
    alt = _WF._run_single
    _WF._run_single = lambda *a, **k: next(ergebnisse, None)
    try:
        best = _WF._best_on_slice(_pd.Series([1.0] * 50), param, sltp)
    finally:
        _WF._run_single = alt
    assert best is None


# ── Spread-Messung (07.08.) ──────────────────────────────────────────────────

def _spread_zeile(markt, spread, bid):
    notizen = json.dumps({"entryContext": {"spread": spread, "bid": bid}})
    return (markt, "BUY", "gpt", "WIN", 1.0, None, notizen)


def test_spread_wird_je_symbol_gemessen():
    rows = [
        _spread_zeile("EURUSD", 0.0001, 1.0800),
        _spread_zeile("EURUSD", 0.0002, 1.0800),
        _spread_zeile("EURUSD", 0.0003, 1.0800),
        _spread_zeile("NAS100", 2.0, 29000.0),
    ]
    r = _spread_je_symbol(rows)
    assert r["EURUSD"]["beobachtungen"] == 3
    assert r["EURUSD"]["medianSpread"] == 0.0002
    assert r["NAS100"]["beobachtungen"] == 1
    assert abs(r["EURUSD"]["medianSpreadPct"] - 0.0185) < 0.001


def test_spread_ignoriert_unbrauchbare_werte():
    """Unbrauchbare Zeilen duerfen den Median nicht verfaelschen.

    Eine falsche Zahl waere hier schlimmer als keine: auf ihr wuerde spaeter
    das Kostenmodell des Backtests aufbauen.
    """
    def zeile(notizen):
        return ("EURUSD", "BUY", "gpt", "WIN", 1.0, None, notizen)

    rows = [
        zeile(None),
        zeile("kein json"),
        zeile(json.dumps({})),
        zeile(json.dumps({"entryContext": {}})),
        zeile(json.dumps({"entryContext": {"spread": 0, "bid": 1.08}})),
        zeile(json.dumps({"entryContext": {"spread": 0.0002, "bid": 0}})),
        zeile(json.dumps({"entryContext": {"spread": 0.0002, "bid": 1.08}})),
    ]
    r = _spread_je_symbol(rows)
    assert r["EURUSD"]["beobachtungen"] == 1, "unbrauchbare Zeilen wurden mitgezaehlt"


def test_walkforward_gibt_vorlauf_weiter():
    """Der Walk-Forward MUSS den Vorlauf an _run_single durchreichen.

    LUECKE AUS DEM SABOTAGE-LAUF (07.08.): die Tests prueften zwar, dass
    _run_single mit ab_index richtig maskiert — aber nicht, dass der
    Walk-Forward ihn ueberhaupt setzt. "warm_start = train_end" (also gar kein
    Vorlauf) blieb dadurch gruen. Genau diese Zeile prueft dieser Test.
    """
    aufrufe = []

    def _falsches_run_single(close, strategy, params, sl, tp, ab_index=0):
        aufrufe.append({"laenge": len(close), "ab_index": ab_index,
                        "strategy": strategy, "params": params})
        return {"profitFactor": 2.0, "winRate": 60.0, "trades": 25,
                "totalReturn": 5.0, "maxDrawdown": 3.0, "sharpe": 1.0,
                "params": params, "sl": sl, "tp": tp}

    df = _pd.DataFrame({"close": _kursreihe(n=1200, seed=11).values})
    alt = _WF._run_single
    _WF._run_single = _falsches_run_single
    try:
        ergebnis = _WF._evaluate_walk_forward("EURUSD", df, is_diagnose=False)
    finally:
        _WF._run_single = alt

    assert ergebnis is not None, "kein Ergebnis — Aufbau des Tests stimmt nicht"

    # Die Auswertung ruft je Fold: erst _best_on_slice (ab_index bleibt 0),
    # dann den Testabschnitt MIT Vorlauf.
    mit_vorlauf = [a for a in aufrufe if a["ab_index"] > 0]
    assert mit_vorlauf, (
        "kein einziger Aufruf mit ab_index > 0 — der Testabschnitt startet "
        "wieder kalt"
    )

    # Der Vorlauf muss zum Parameter passen: EMA slow=26 x Faktor 3 = 78.
    erwartet = _vorlauf("EMA_CROSS", {"fast": 12, "slow": 26}) * VORLAUF_FAKTOR
    assert any(a["ab_index"] == erwartet for a in mit_vorlauf), (
        f"erwartet ab_index={erwartet}, bekam {[a['ab_index'] for a in mit_vorlauf]}"
    )

    # Und die uebergebene Reihe muss um genau diesen Vorlauf laenger sein.
    for a in mit_vorlauf:
        assert a["laenge"] > a["ab_index"], "Testfenster ist leer"

    # Der Vorlauf steht auch im Ergebnis, damit er nachvollziehbar bleibt.
    assert all("vorlaufBalken" in f for f in ergebnis["folds"])
    assert any(f["vorlaufBalken"] > 0 for f in ergebnis["folds"])
