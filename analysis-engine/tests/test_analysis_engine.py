"""
Tests fuer die Analysis-Engine.

WARUM ES DIESE DATEI GIBT (09.08.): analysis-engine hatte bis heute KEINEN
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
import re
import sys
import types

import pytest
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
from services.periodic_report import (_exit_reason_breakdown,        # noqa: E402
                                      _konsens_abschnitt, _build_report)
from services.recommendations import _build_recommendations          # noqa: E402
import services.konsens_auswertung as _KA                        # noqa: E402
import services.muster_auswertung as _MA                         # noqa: E402


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


# ── Vorschlaege duerfen dem Walk-Forward nicht widersprechen (09.08.) ────────
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


# ── Walk-Forward gehaertet (09.08.) ──────────────────────────────────────────

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


# ── Spread-Messung (09.08.) ──────────────────────────────────────────────────

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

    LUECKE AUS DEM SABOTAGE-LAUF (09.08.): die Tests prueften zwar, dass
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


# -- Konsens-Auswertung (10.08., Stufe 4 Schritt 3) ---------------------------
# Gemessen wird die Vorwaertsrendite nach einem Signal. Die drei Fehler, die so
# eine Auswertung wertlos machen, stehen im Modulkopf — hier wird jeder einzeln
# geprueft: Rand in die Zukunft, fehlende Basis, Ueberlappung als Fallzahl.


def _historie(kurse, konsens, conf=None, tiers=None, ohne_daten=None, status="ok"):
    n = len(kurse)
    return {
        "symbol": "TEST", "status": status, "kurs": kurse, "konsens": konsens,
        "konsensConf": conf if conf is not None else [80] * n,
        "entryQualityTier": tiers if tiers is not None else ["A"] * n,
        "strategienOhneDaten": ohne_daten if ohne_daten is not None else [0] * n,
        "fensterTage": 90, "taktIntervall": "4h", "von": None, "bis": None,
        "strategienMitLuecken": {}, "hinweise": [],
    }


def test_konsens_rendite_am_rand_ist_none_nicht_null():
    """Die letzten Balken haben keine Zukunft.

    Wer sie als Nullrendite zaehlt, zieht jeden Mittelwert Richtung null UND
    meldet mehr Faelle, als es gibt. Das ist der Fehler, der eine
    Rueckrechnung am unauffaelligsten verfaelscht.
    """
    kurse = [100.0, 110.0, 121.0]
    assert _KA._vorwaerts_rendite(kurse, 0, 1) == pytest.approx(0.10)
    assert _KA._vorwaerts_rendite(kurse, 2, 1) is None, "Rand nicht erkannt"
    assert _KA._vorwaerts_rendite(kurse, 1, 5) is None
    assert _KA._vorwaerts_rendite([0.0, 5.0], 0, 1) is None, "Division durch null"


def test_konsens_zaehlt_bloecke_statt_nur_balken():
    """500 Balken sind keine 500 unabhaengigen Faelle."""
    assert _KA.bloecke([]) == []
    assert _KA.bloecke(["LONG"]) == [(0, 0, "LONG")]
    folge = ["LONG", "LONG", "LONG", "NEUTRAL", "SHORT", "SHORT", "LONG"]
    assert _KA.bloecke(folge) == [
        (0, 2, "LONG"), (3, 3, "NEUTRAL"), (4, 5, "SHORT"), (6, 6, "LONG"),
    ]


def test_konsens_sell_gewinnt_bei_fallendem_kurs():
    """Ohne Vorzeichenwechsel waere jedes Short-Signal als Verlust gebucht."""
    fallend = [100.0 * (0.99 ** i) for i in range(60)]
    r = _KA.bewerte_historie(_historie(fallend, ["SHORT"] * 60))
    tag = r["horizonte"]["daytrading_24h"]["alle"]["SHORT"]
    assert tag["mittelPct"] > 0, f"SELL im Abwaertstrend als Verlust gebucht: {tag}"
    assert tag["trefferPct"] == 100.0


def test_konsens_ohne_vorteil_bleibt_bei_null():
    """DER Test.

    Ein Konsens, der in einem steigenden Markt IMMER BUY sagt, sieht mit
    blossen Renditen glaenzend aus — er hat aber nichts geleistet. Erst der
    Vergleich mit derselben Bewegung ueber alle Balken zeigt das. Ohne diese
    Basis waere die ganze Auswertung eine Trendmessung mit anderem Namen.
    """
    steigend = [100.0 * (1.01 ** i) for i in range(80)]
    r = _KA.bewerte_historie(_historie(steigend, ["LONG"] * 80))
    tag = r["horizonte"]["daytrading_24h"]["alle"]["LONG"]
    assert tag["mittelPct"] > 5, "die rohe Rendite muss hoch aussehen"
    assert tag["basisPct"] == pytest.approx(tag["mittelPct"], abs=0.01)
    assert abs(tag["vorteilPct"]) < 0.01, (
        f"Dauer-BUY im Aufwaertstrend meldet Vorteil {tag['vorteilPct']}% "
        f"— die Basis wird nicht abgezogen"
    )


def test_konsens_erkennt_echten_vorteil():
    """Gegenprobe: wenn das Signal wirklich trifft, MUSS Vorteil entstehen.

    Ohne diese Gegenprobe wuerde eine Auswertung, die immer 0 liefert, den
    Test oben ebenfalls bestehen.
    """
    # Kurs pendelt; BUY steht nur vor den Anstiegen.
    kurse, konsens = [], []
    for i in range(60):
        kurse.append(100.0 + (10.0 if i % 2 else 0.0))
        konsens.append("LONG" if i % 2 == 0 else "NEUTRAL")
    r = _KA.bewerte_historie(_historie(kurse, konsens))
    eins = r["horizonte"]["scalping_4h"]["alle"]["LONG"]
    assert eins["vorteilPct"] > 5, f"echter Vorteil nicht erkannt: {eins}"


def test_konsens_trennt_vollstaendige_von_luechenhaften_balken():
    """yfinance liefert 15m nur 60 Tage — die Luecke sitzt am Anfang.

    Wenn beide Teile nicht getrennt werden, mischt die Auswertung einen
    Konsens aus 16 Strategien mit einem aus 15.
    """
    kurse = [100.0 + i for i in range(60)]
    ohne = [3] * 30 + [0] * 30          # erste Haelfte ausgeduennt
    r = _KA.bewerte_historie(_historie(kurse, ["LONG"] * 60, ohne_daten=ohne))
    assert r["balken"] == 60
    assert r["balkenVollstaendig"] == 30
    alle = r["horizonte"]["daytrading_24h"]["alle"]["LONG"]
    voll = r["horizonte"]["daytrading_24h"]["vollstaendig"]["LONG"]
    assert voll["n"] < alle["n"], "es wird nicht getrennt"
    assert voll["n"] > 0


def test_konsens_meldet_fehlende_luechenreihe_statt_sie_zu_erfinden():
    """Ein aelteres Backend liefert die Reihe nicht. Dann gilt alles als
    vollstaendig — aber das muss DASTEHEN, sonst liest es sich wie ein Befund."""
    h = _historie([100.0 + i for i in range(40)], ["LONG"] * 40)
    del h["strategienOhneDaten"]
    r = _KA.bewerte_historie(h)
    assert r["balkenVollstaendig"] == 40
    assert any("strategienOhneDaten" in x for x in r["hinweise"]), (
        "die fehlende Reihe wurde stillschweigend als 'alles vollstaendig' verbucht"
    )


def test_konsens_lehnt_ungleiche_reihen_ab():
    """Ungleich lange Reihen wuerden Kurs und Entscheidung gegeneinander
    verschieben — jede folgende Zahl waere falsch, ohne aufzufallen."""
    h = _historie([100.0] * 40, ["LONG"] * 30)
    r = _KA.bewerte_historie(h)
    assert r["status"] == "unbrauchbar"


def test_konsens_reicht_fehlerstatus_durch():
    r = _KA.bewerte_historie({"status": "keine_daten", "hinweise": ["4h: keine Kerzen"]})
    assert r["status"] == "keine_daten"
    assert r["hinweise"]


def test_konsens_staffelt_an_den_schwellen_der_einstellungen():
    """75 und 81 sind keine runden Zahlen, sondern die Freigabe-Schwellen.

    Liegen die Schnitte woanders, beantwortet die Staffelung nicht die Frage,
    fuer die sie gebaut wurde.
    """
    grenzen = [u for u, _ in _KA.KONFIDENZ_STUFEN]
    assert 75 in grenzen and 81 in grenzen, f"Schwellen fehlen: {grenzen}"
    # luecken- und ueberschneidungsfrei
    for (_, oben), (unten_next, _) in zip(_KA.KONFIDENZ_STUFEN, _KA.KONFIDENZ_STUFEN[1:]):
        assert oben == unten_next, f"Luecke/Ueberschneidung bei {oben}/{unten_next}"

    kurse = [100.0 + i for i in range(60)]
    conf = [70] * 30 + [85] * 30
    r = _KA.bewerte_historie(_historie(kurse, ["LONG"] * 60, conf=conf))
    stufen = r["konfidenz"]["stufen"]
    assert stufen["70-74"]["n"] > 0 and stufen["81-89"]["n"] > 0
    assert stufen["0-59"]["n"] == 0


def test_konsens_horizonte_stammen_aus_den_echten_zeit_exits():
    """risk-agent.ts: SCALPING 4h, DAYTRADING 24h, SWING 168h.

    Auf 4h-Takt sind das 1, 6 und 42 Balken. Ein frei gewaehlter Horizont
    wuerde etwas messen, das das System nie gehalten haette.
    """
    assert _KA.HORIZONTE == {"scalping_4h": 1, "daytrading_24h": 6, "swing_168h": 42}


def test_konsens_klemmt_das_fenster_auf_die_grenze_des_backends():
    """Ohne Klemme antwortet divine-warmth auf JEDES Symbol mit HTTP 400 —
    der Lauf liefert dann stillschweigend gar nichts."""
    echt = _KA.settings
    _KA.settings = types.SimpleNamespace(KONSENS_FENSTER_TAGE=5000)
    try:
        assert _KA._fensterlaenge() == _KA.MAX_FENSTER_TAGE
        _KA.settings = types.SimpleNamespace(KONSENS_FENSTER_TAGE=0)
        assert _KA._fensterlaenge() == _KA.STANDARD_FENSTER_TAGE
        _KA.settings = types.SimpleNamespace(KONSENS_FENSTER_TAGE=30)
        assert _KA._fensterlaenge() == 30
    finally:
        _KA.settings = echt


def test_konsens_kennzahlen_bei_leerer_liste():
    """n=0 darf nicht durch null teilen und muss als n=0 erkennbar bleiben."""
    assert _KA._kennzahlen([]) == {"n": 0, "mittelPct": 0.0, "medianPct": 0.0,
                                   "trefferPct": 0.0}
    assert _KA._kennzahlen([0.01, 0.03])["medianPct"] == pytest.approx(2.0)
    assert _KA._kennzahlen([0.01, 0.02, 0.09])["medianPct"] == pytest.approx(2.0)


def test_konsens_etiketten_stimmen_mit_dem_backend_ueberein():
    """Cross-Service-Riegel — der Fund vom 10.08.

    Der erste Entwurf dieses Moduls suchte nach "BUY"/"SELL". Der Konsens
    vergibt aber "LONG"/"SHORT". Kein Unittest hat das gefunden: sie bekamen
    die erfundenen Etiketten mit, gegen die sie geschrieben waren. In
    Produktion haette die Auswertung fuer JEDES Symbol n=0 gemeldet — das
    sieht aus wie ein Ergebnis ("keine Signale") und ist doch Blindheit.

    Geprueft wird deshalb gegen den QUELLTEXT des Backends. Wird dort
    umbenannt, wird das hier rot — nicht erst nach dem naechsten Wochenlauf.
    """
    quelle = (_WURZEL.parent / "backend" / "services" / "trading_strategies.py")
    assert quelle.exists(), f"Backend-Quelle nicht gefunden: {quelle}"
    text = quelle.read_text(encoding="utf-8")

    # Die Zuweisungen in analyze_all_strategies()
    vergeben = set(re.findall(r'^\s*consensus = "([A-Z_]+)"', text, re.M))
    assert vergeben, "keine consensus-Zuweisung im Backend gefunden"

    erwartet = set(_KA.RICHTUNGEN) | {_KA.NEUTRAL}
    assert vergeben == erwartet, (
        f"Backend vergibt {sorted(vergeben)}, die Auswertung sucht "
        f"{sorted(erwartet)} — jedes nicht gesuchte Etikett wird stillschweigend "
        f"uebergangen"
    )


def test_konsens_meldet_unbekannte_etiketten_statt_still_null_zu_zaehlen():
    """Der Riegel gegen das stille Nichts.

    Zaehlt die Auswertung ueberall n=0, sieht das aus wie "keine Signale".
    Ein unbekanntes Etikett muss deshalb im Ergebnis DASTEHEN.
    """
    kurse = [100.0 + i for i in range(40)]
    r = _KA.bewerte_historie(_historie(kurse, ["BUY"] * 40))
    assert r["status"] == "ok"
    assert r.get("unbekannteEtiketten") == ["BUY"], (
        f"unbekanntes Etikett nicht gemeldet: {r.get('unbekannteEtiketten')}"
    )
    assert any("kein einziges Signal" in h for h in r["hinweise"]), (
        "n=0 ueberall wurde nicht als solches benannt"
    )


def test_konsens_lauf_geht_durch_und_landet_in_redis():
    """Der ganze Lauf, einmal durchgespielt.

    Warum ausgerechnet dieser Test: der KeyError in der Log-Zeile
    (tag["BUY"] statt tag["LONG"]) sass in _run_konsens_auswertung_inner —
    einer Funktion, die KEIN Test beruehrt hat. Alle 15 Rechen-Tests waren
    gruen, und der erste echte Wochenlauf waere trotzdem abgestuerzt.
    Rechenlogik zu pruefen genuegt nicht, wenn die Verdrahtung ungeprueft ist.
    """
    kurse = [100.0 + i * 0.5 for i in range(80)]
    konsens = (["LONG"] * 40) + (["SHORT"] * 40)

    aufgerufen = []

    def falsches_hole(symbol, tage=None):
        aufgerufen.append(symbol)
        return _historie(kurse, konsens)

    geschrieben = {}

    echt_hole, echt_redis = _KA.hole_historie, _KA.redis_set_json
    echt_watchlist, echt_pause = _KA.WATCHLIST, _KA.PAUSE_SEK
    _KA.hole_historie = falsches_hole
    _KA.redis_set_json = lambda k, v, ttl: geschrieben.update({k: v}) or True
    _KA.WATCHLIST = ["EURUSD", "BTCUSD"]
    _KA.PAUSE_SEK = 0
    try:
        _KA.run_konsens_auswertung()      # Wrapper — faengt Abstuerze ab
    finally:
        _KA.hole_historie, _KA.redis_set_json = echt_hole, echt_redis
        _KA.WATCHLIST, _KA.PAUSE_SEK = echt_watchlist, echt_pause

    end = geschrieben[_KA.REDIS_KEY_KONSENS]
    assert end["status"] == "done", (
        f"Lauf abgestuerzt statt durchgelaufen: {end.get('error')}"
    )
    assert aufgerufen == ["EURUSD", "BTCUSD"]
    assert end["symbole"] == 2
    assert set(end["results"]) == {"EURUSD", "BTCUSD"}
    assert end["results"]["EURUSD"]["horizonte"]["daytrading_24h"]["alle"]["LONG"]["n"] > 0

    # Muss sich nach Redis schreiben lassen — ein nicht serialisierbarer Wert
    # faellt sonst erst im Betrieb auf.
    json.dumps(end)


def test_konsens_lauf_ueberlebt_ein_kaputtes_symbol():
    """Ein Symbol ohne Daten darf die uebrigen 29 nicht mitnehmen."""
    kurse = [100.0 + i for i in range(60)]

    def falsches_hole(symbol, tage=None):
        if symbol == "KAPUTT":
            return None
        if symbol == "LEER":
            return {"status": "keine_daten", "hinweise": ["4h: keine Kerzen"]}
        return _historie(kurse, ["LONG"] * 60)

    geschrieben = {}
    echt_hole, echt_redis = _KA.hole_historie, _KA.redis_set_json
    echt_watchlist, echt_pause = _KA.WATCHLIST, _KA.PAUSE_SEK
    _KA.hole_historie = falsches_hole
    _KA.redis_set_json = lambda k, v, ttl: geschrieben.update({k: v}) or True
    _KA.WATCHLIST = ["KAPUTT", "EURUSD", "LEER", "BTCUSD"]
    _KA.PAUSE_SEK = 0
    try:
        _KA.run_konsens_auswertung()
    finally:
        _KA.hole_historie, _KA.redis_set_json = echt_hole, echt_redis
        _KA.WATCHLIST, _KA.PAUSE_SEK = echt_watchlist, echt_pause

    end = geschrieben[_KA.REDIS_KEY_KONSENS]
    assert end["status"] == "done"
    assert set(end["results"]) == {"EURUSD", "BTCUSD"}, (
        f"kaputte Symbole haben den Lauf verfaelscht: {sorted(end['results'])}"
    )


def test_konsens_holt_vom_richtigen_endpunkt():
    """Die Strecke zwischen den Diensten — ungeprueft bis 10.08.

    Genau hier sass der Fund des Tages (BUY/SELL statt LONG/SHORT): an der
    Naht zwischen zwei Diensten, die jeder fuer sich getestet waren. Ein
    falscher Pfad oder ein fehlender Auth-Header faellt beim Rechnen nie auf —
    nur im Wochenlauf, und dort als "keine Daten".
    """
    gesehen = {}

    class _Antwort:
        status_code = 200
        text = ""

        @staticmethod
        def json():
            return {"status": "ok", "symbol": "EURUSD"}

    def falsches_get(url, params=None, headers=None, timeout=None):
        gesehen.update(url=url, params=params, headers=headers, timeout=timeout)
        return _Antwort()

    echt_httpx, echt_settings = _KA.httpx, _KA.settings
    _KA.httpx = types.SimpleNamespace(get=falsches_get)
    _KA.settings = types.SimpleNamespace(
        PYTHON_BACKEND_URL="http://backend:8000", BACKEND_API_KEY="geheim"
    )
    try:
        r = _KA.hole_historie("EURUSD", tage=42)
    finally:
        _KA.httpx, _KA.settings = echt_httpx, echt_settings

    assert r == {"status": "ok", "symbol": "EURUSD"}
    assert gesehen["url"] == "http://backend:8000/api/v1/strategies/historie/EURUSD", (
        f"falscher Pfad: {gesehen['url']}"
    )
    assert gesehen["params"] == {"tage": 42}
    assert gesehen["headers"] == {"X-Backend-Key": "geheim"}, (
        "ohne diesen Header antwortet divine-warmth mit 401 (Audit-Fund #1, 27.07.)"
    )
    # Der Lauf rechnet je Balken den vollen Konsens — ein knapper Timeout wirft
    # Arbeit weg, nachdem sie geleistet wurde.
    assert gesehen["timeout"] >= 300, f"Timeout zu knapp: {gesehen['timeout']}"


def test_konsens_hole_gibt_bei_fehler_none_statt_muell():
    """None heisst 'ueberspringen'. Ein halbes Ergebnis waere schlimmer."""
    echt_httpx, echt_settings = _KA.httpx, _KA.settings
    _KA.settings = types.SimpleNamespace(PYTHON_BACKEND_URL="http://b", BACKEND_API_KEY="")

    class _Fehler:
        status_code = 500
        text = "boom"

        @staticmethod
        def json():
            return {}

    try:
        _KA.httpx = types.SimpleNamespace(get=lambda *a, **k: _Fehler())
        assert _KA.hole_historie("EURUSD") is None, "HTTP 500 nicht erkannt"

        def _wirft(*a, **k):
            raise ConnectionError("kein Netz")

        _KA.httpx = types.SimpleNamespace(get=_wirft)
        assert _KA.hole_historie("EURUSD") is None, "Ausnahme nicht abgefangen"

        # Ohne konfiguriertes Backend gar nicht erst anfragen
        _KA.settings = types.SimpleNamespace(PYTHON_BACKEND_URL="", BACKEND_API_KEY="")
        _KA.httpx = types.SimpleNamespace(get=_wirft)
        assert _KA.hole_historie("EURUSD") is None
    finally:
        _KA.httpx, _KA.settings = echt_httpx, echt_settings


def _konsens_redis(eintraege):
    """Baut die Redis-Struktur, wie run_konsens_auswertung sie ablegt."""
    results = {}
    for symbol, (vorteil_long, n_long, vorteil_short, n_short, luecken) in eintraege.items():
        results[symbol] = {
            "balken": 300, "bloeckeGesamt": 60,
            "strategienMitLuecken": luecken,
            "horizonte": {"daytrading_24h": {"alle": {
                "LONG": {"n": n_long, "vorteilPct": vorteil_long},
                "SHORT": {"n": n_short, "vorteilPct": vorteil_short},
            }}},
        }
    return {"status": "done", "fensterTage": 90, "results": results}


def test_report_zeigt_die_konsens_auswertung():
    """Ohne diesen Abschnitt laege das Ergebnis nur in Redis.

    Eine Messung, die niemand sieht, ist nicht fertig — der Wochenreport ist
    das, was tatsaechlich gelesen wird.
    """
    _REDIS["analysis:konsens"] = _konsens_redis({
        "BTCUSD": (0.30, 100, 0.20, 100, {}),
        "EURUSD": (-0.05, 80, -0.03, 80, {"scalping": {"balkenOhneDaten": 82,
                                                       "anteil": 0.42}}),
    })
    try:
        zeilen = _konsens_abschnitt()
    finally:
        _REDIS.pop("analysis:konsens", None)

    text = "\n".join(zeilen)
    assert "Konsens-Auswertung" in text
    assert "BTCUSD" in text and "EURUSD" in text
    # Bestes zuerst
    assert text.index("BTCUSD") < text.index("EURUSD"), "nicht nach Vorteil sortiert"
    assert "Ohne Vorteil" in text and "EURUSD" in text.split("Ohne Vorteil")[1]
    # Die Datenlage gehoert daneben, nicht in eine Fussnote
    assert "scalping" in text, "die Luecke wurde im Report verschwiegen"
    assert "60 Tage" in text
    # Bloecke statt Balken als Fallzahl
    assert "Bl" in text and "cke" in text


def test_report_gewichtet_den_vorteil_nach_faellen():
    """Sonst zieht eine Richtung mit 3 Faellen das ganze Bild.

    Symbol A: LONG +2.0 bei 5 Faellen, SHORT -0.5 bei 195 Faellen.
    Ungewichtet waere der Schnitt +0.75 — tatsaechlich ist er negativ.
    """
    _REDIS["analysis:konsens"] = _konsens_redis({
        "A": (2.0, 5, -0.5, 195, {}),
        "B": (0.10, 100, 0.10, 100, {}),
    })
    try:
        zeilen = _konsens_abschnitt()
    finally:
        _REDIS.pop("analysis:konsens", None)
    text = "\n".join(zeilen)
    assert text.index("B:") < text.index("A:"), (
        f"ungewichtet sortiert — 5 Faelle schlagen 195:\n{text}"
    )
    assert "A" in text.split("Ohne Vorteil")[1], "A muesste unter 'Ohne Vorteil' stehen"


def test_report_schweigt_ohne_konsens_daten():
    """Kein Lauf, kein Abschnitt — statt einer leeren Ueberschrift."""
    _REDIS.pop("analysis:konsens", None)
    assert _konsens_abschnitt() == []
    _REDIS["analysis:konsens"] = {"status": "running", "progress": "3/30"}
    try:
        assert _konsens_abschnitt() == [], "laufender Lauf als Ergebnis gemeldet"
        _REDIS["analysis:konsens"] = {"status": "done", "results": {}}
        assert _konsens_abschnitt() == []

        # Ein LAUFENDER Eintrag MIT Teilergebnissen. Heute schreibt
        # _run_konsens_auswertung_inner waehrend des Laufs keine results mit —
        # deshalb griff bisher schon die results-Pruefung und der Statusriegel
        # blieb ungeprueft (Sabotage-Lauf 10.08.: durchgerutscht). Sobald
        # jemand Zwischenstaende mitschreibt, entscheidet allein der Status
        # darueber, ob ein halbfertiger Lauf als fertig im Report landet.
        laeuft = _konsens_redis({"BTCUSD": (0.30, 100, 0.20, 100, {})})
        laeuft["status"] = "running"
        _REDIS["analysis:konsens"] = laeuft
        assert _konsens_abschnitt() == [], (
            "ein laufender Lauf mit Teilergebnissen wurde als fertig gemeldet"
        )

        # Abgestuerzter Lauf ebenso
        kaputt = _konsens_redis({"BTCUSD": (0.30, 100, 0.20, 100, {})})
        kaputt["status"] = "error"
        _REDIS["analysis:konsens"] = kaputt
        assert _konsens_abschnitt() == [], "abgestuerzter Lauf als Ergebnis gemeldet"
    finally:
        _REDIS.pop("analysis:konsens", None)


def test_report_haengt_den_konsens_abschnitt_wirklich_ein():
    """Der Abschnitt muss im FERTIGEN Report stehen, nicht nur existieren.

    Im Sabotage-Lauf am 10.08. liess sich der Aufruf aus _build_report
    ersatzlos streichen, ohne dass ein Test rot wurde: die drei Tests darueber
    riefen _konsens_abschnitt() direkt auf. Eine Funktion, die niemand
    aufruft, besteht ihre eigenen Tests tadellos — und liefert nichts.
    Dieselbe Luecke wie beim run_in_executor des Backend-Endpunkts.
    """
    _ZEILEN.clear()          # keine Trades -> kurzer Report, stoert nicht
    _REDIS["analysis:konsens"] = _konsens_redis({"BTCUSD": (0.30, 100, 0.20, 100, {})})
    try:
        text = _build_report(7, "Test", compare_previous=False, show_walk_forward=True)
    finally:
        _REDIS.pop("analysis:konsens", None)

    assert "Konsens-Auswertung" in text, (
        "der Abschnitt wird nicht in den Report eingehaengt — er existiert nur"
    )
    assert "BTCUSD" in text


def test_report_ohne_walkforward_flagge_keinen_konsens():
    """Der Monatsreport setzt show_walk_forward=False. Dann darf auch der
    Konsens-Abschnitt nicht auftauchen — sonst steht er doppelt im System."""
    _ZEILEN.clear()
    _REDIS["analysis:konsens"] = _konsens_redis({"BTCUSD": (0.30, 100, 0.20, 100, {})})
    try:
        text = _build_report(30, "Test", compare_previous=False, show_walk_forward=False)
    finally:
        _REDIS.pop("analysis:konsens", None)
    assert "Konsens-Auswertung" not in text


def test_konsens_pfad_stimmt_mit_dem_backend_ueberein():
    """Der zweite Cross-Service-Riegel: der PFAD.

    Die Engine baut ihn als Zeichenkette zusammen, das Backend setzt ihn aus
    zwei Praefixen zusammen (include_router prefix + APIRouter prefix). Der
    Endpunkt-Test im Backend ruft die Funktion DIREKT auf und beruehrt den Pfad
    gar nicht. Wird ein Praefix geaendert, antwortet divine-warmth mit 404, die
    Auswertung ueberspringt jedes Symbol — und keine Suite wird rot.

    Dieselbe Naht wie beim LONG/SHORT-Fund: zwei Dienste, jeder fuer sich
    getestet, dazwischen niemand.
    """
    backend = _WURZEL.parent / "backend"
    haupt = (backend / "main.py").read_text(encoding="utf-8")
    routen = (backend / "api" / "routes" / "strategies.py").read_text(encoding="utf-8")

    m = re.search(
        r"include_router\(\s*strategies\.router\s*,\s*prefix=[\"']([^\"']+)[\"']",
        haupt,
    )
    assert m, "include_router(strategies.router, prefix=...) nicht gefunden"
    aussen = m.group(1)

    m = re.search(r'APIRouter\(prefix="([^"]+)"', routen)
    assert m, "APIRouter(prefix=...) in strategies.py nicht gefunden"
    innen = m.group(1)

    m = re.search(r'@router\.get\("(/historie/\{symbol\})"\)', routen)
    assert m, "Route /historie/{symbol} nicht gefunden"
    eigen = m.group(1)

    echt = f"{aussen}{innen}{eigen}".replace("{symbol}", "EURUSD")

    # Was die Engine tatsaechlich anfragt
    gesehen = {}

    class _A:
        status_code = 200
        text = ""

        @staticmethod
        def json():
            return {"status": "ok"}

    echt_httpx, echt_settings = _KA.httpx, _KA.settings
    _KA.httpx = types.SimpleNamespace(
        get=lambda url, **k: (gesehen.update(url=url), _A())[1]
    )
    _KA.settings = types.SimpleNamespace(PYTHON_BACKEND_URL="", BACKEND_API_KEY="")
    _KA.settings.PYTHON_BACKEND_URL = "http://b"
    try:
        _KA.hole_historie("EURUSD")
    finally:
        _KA.httpx, _KA.settings = echt_httpx, echt_settings

    gebaut = gesehen["url"].replace("http://b", "")
    assert gebaut == echt, (
        f"Pfade laufen auseinander — Engine fragt {gebaut}, Backend bedient {echt}"
    )



# ── Chartmuster-Bewertung (17.08.) ───────────────────────────────────────────


def test_horizonte_haengen_am_takt():
    """DER FUND vom 17.08.

    HORIZONTE sind Balkenzahlen fuer einen 4h-Takt (1, 6, 42 = 4h, 24h, 168h).
    Die Muster-Rueckrechnung laeuft auf TAGESKERZEN — dieselben Zahlen bedeuten
    dort 1, 6 und 42 TAGE, also den sechsfachen Zeitraum, ohne dass es irgendwo
    stuende. Aufgefallen an einem unplausiblen Ergebnis (+24 % "auf 7 Tage").
    """
    assert _KA.horizonte_fuer("4h") == _KA.HORIZONTE, "4h muss unveraendert bleiben"
    tag = _KA.horizonte_fuer("1d")
    assert tag["daytrading_24h"] == 1 and tag["swing_168h"] == 7, tag
    # Ein Horizont kuerzer als ein Balken laesst sich nicht messen und wird
    # weggelassen — statt auf 1 aufgerundet zu werden und etwas anderes zu
    # messen, als sein Name sagt.
    assert "scalping_4h" not in tag, "4h auf Tageskerzen ist nicht messbar"
    assert _KA.horizonte_fuer("1h")["scalping_4h"] == 4
    # Unbekannter oder fehlender Takt -> die bisherigen Werte, nichts Erfundenes.
    for schlecht in [None, "", "99x"]:
        assert _KA.horizonte_fuer(schlecht) == _KA.HORIZONTE


def test_horizonte_wirken_in_der_bewertung():
    """Nicht nur die Funktion, auch ihre Anwendung."""
    kurse = [100.0 + i for i in range(60)]
    h4 = _historie(kurse, ["LONG"] * 60)
    h1d = {**_historie(kurse, ["LONG"] * 60), "taktIntervall": "1d"}
    r4 = _KA.bewerte_historie(h4)
    r1 = _KA.bewerte_historie(h1d)
    assert r4["horizonteBalken"]["swing_168h"] == 42
    assert r1["horizonteBalken"]["swing_168h"] == 7
    assert "scalping_4h" in r4["horizonte"] and "scalping_4h" not in r1["horizonte"]


def _musterhistorie(kurse, arten, richtungen):
    n = len(kurse)
    return {
        "symbol": "TEST", "status": "ok", "taktIntervall": "1d",
        "kurs": kurse, "konsens": richtungen, "konsensConf": [0] * n,
        "entryQualityTier": arten, "strategienOhneDaten": [0] * n,
        "musterAlle": [[a] if a != "KEIN_MUSTER" else [] for a in arten],
        "fensterTage": 365, "strategienMitLuecken": {}, "hinweise": [],
    }


def test_muster_wird_je_art_getrennt_bewertet():
    """Der Kern: jede Musterart bekommt ihre eigene Zahl.

    Zusammengefasst waere die Aussage wertlos — ein gutes Muster koennte ein
    schlechtes tragen.
    """
    # DOPPELBODEN steht vor Anstiegen, DOPPELTOP vor weiteren Anstiegen
    # (also falsch). Beide muessen SICHTBAR verschieden herauskommen.
    kurse, arten, richtungen = [], [], []
    for i in range(80):
        kurse.append(100.0 + i * 1.0)
        if i % 10 == 0:
            arten.append("DOPPELBODEN"); richtungen.append("LONG")
        elif i % 10 == 5:
            arten.append("DOPPELTOP"); richtungen.append("SHORT")
        else:
            arten.append("KEIN_MUSTER"); richtungen.append("NEUTRAL")
    r = _MA.bewerte_muster(_musterhistorie(kurse, arten, richtungen))
    assert r["status"] == "ok"
    assert set(r["jeMusterart"]) == {"DOPPELBODEN", "DOPPELTOP"}
    db = r["jeMusterart"]["DOPPELBODEN"]["horizonte"]["daytrading_24h"]["alle"]
    dt = r["jeMusterart"]["DOPPELTOP"]["horizonte"]["daytrading_24h"]["alle"]
    assert db["LONG"]["n"] > 0 and dt["SHORT"]["n"] > 0
    # Im stetigen Anstieg muss SHORT schlechter abschneiden als LONG.
    assert dt["SHORT"]["mittelPct"] < db["LONG"]["mittelPct"]


def test_muster_reihe_fuer_setzt_alles_andere_auf_neutral():
    """Sonst wuerde jede Art die Faelle der anderen mitzaehlen."""
    arten = ["DOPPELTOP", "DOPPELBODEN", "KEIN_MUSTER", "DOPPELTOP"]
    richtungen = ["SHORT", "LONG", "NEUTRAL", "SHORT"]
    h = _musterhistorie([100.0, 101.0, 102.0, 103.0], arten, richtungen)
    nur_dt = _MA._reihe_fuer(h, "DOPPELTOP")["konsens"]
    assert nur_dt == ["SHORT", "NEUTRAL", "NEUTRAL", "SHORT"], nur_dt
    # Der Kurs darf dabei NICHT angefasst werden — die Basis muss ueber alle
    # Balken gleich bleiben, sonst waere der Vergleich zwischen den Arten unfair.
    assert _MA._reihe_fuer(h, "DOPPELTOP")["kurs"] == h["kurs"]


def test_muster_zaehlt_auch_die_unbestaetigten():
    """Ohne diese Zahl waere 'nur bestaetigte zaehlen' eine Regel ohne Beleg."""
    arten = ["DOPPELTOP", "KEIN_MUSTER", "DOPPELTOP"]
    h = _musterhistorie([100.0, 101.0, 102.0], arten, ["SHORT", "NEUTRAL", "SHORT"])
    h["musterAlle"] = [["DOPPELTOP", "DREIECK_STEIGEND"], ["DREIECK_STEIGEND"], ["DOPPELTOP"]]
    r = _MA.bewerte_muster(h)
    assert r["erkanntGesamt"] == {"DOPPELTOP": 2, "DREIECK_STEIGEND": 2}


def test_muster_reicht_fehlerstatus_durch():
    r = _MA.bewerte_muster({"status": "keine_daten", "hinweise": ["keine Kerzen"]})
    assert r["status"] == "keine_daten" and r["hinweise"]


def test_muster_klemmt_das_fenster():
    echt = _MA.settings
    _MA.settings = types.SimpleNamespace(MUSTER_FENSTER_TAGE=99999)
    try:
        assert _MA._fensterlaenge() == _MA.MAX_FENSTER_TAGE
        _MA.settings = types.SimpleNamespace(MUSTER_FENSTER_TAGE=0)
        assert _MA._fensterlaenge() == _MA.STANDARD_FENSTER_TAGE
    finally:
        _MA.settings = echt


def test_muster_holt_vom_richtigen_endpunkt():
    """Die Naht zwischen den Diensten — dort sassen heute schon zwei Fehler."""
    gesehen = {}

    class _A:
        status_code = 200
        text = ""
        @staticmethod
        def json():
            return {"status": "ok"}

    echt_httpx, echt_settings = _MA.httpx, _MA.settings
    _MA.httpx = types.SimpleNamespace(
        get=lambda url, **k: (gesehen.update(url=url, **k), _A())[1])
    _MA.settings = types.SimpleNamespace(
        PYTHON_BACKEND_URL="http://b", BACKEND_API_KEY="geheim")
    try:
        _MA.hole_musterhistorie("EURUSD", tage=100)
    finally:
        _MA.httpx, _MA.settings = echt_httpx, echt_settings
    assert gesehen["url"] == "http://b/api/v1/strategies/muster-historie/EURUSD"
    assert gesehen["params"] == {"tage": 100, "interval": "1d"}
    assert gesehen["headers"] == {"X-Backend-Key": "geheim"}


def test_muster_lauf_geht_durch_und_landet_in_redis():
    """Die Verdrahtung — genau die Zone, in der heute schon ein KeyError sass."""
    kurse = [100.0 + i for i in range(60)]
    arten = ["DOPPELBODEN" if i % 10 == 0 else "KEIN_MUSTER" for i in range(60)]
    richt = ["LONG" if i % 10 == 0 else "NEUTRAL" for i in range(60)]
    geschrieben = {}
    echt_hole, echt_redis = _MA.hole_musterhistorie, _MA.redis_set_json
    echt_wl, echt_pause = _MA.WATCHLIST, _MA.PAUSE_SEK
    _MA.hole_musterhistorie = lambda s, tage=None: _musterhistorie(kurse, arten, richt)
    _MA.redis_set_json = lambda k, v, ttl: geschrieben.update({k: v}) or True
    _MA.WATCHLIST = ["EURUSD", "BTCUSD"]
    _MA.PAUSE_SEK = 0
    try:
        _MA.run_muster_auswertung()
    finally:
        _MA.hole_musterhistorie, _MA.redis_set_json = echt_hole, echt_redis
        _MA.WATCHLIST, _MA.PAUSE_SEK = echt_wl, echt_pause
    end = geschrieben[_MA.REDIS_KEY_MUSTER]
    assert end["status"] == "done", end.get("error")
    assert end["symbole"] == 2
    json.dumps(end)


# ── Volatilitaets-Auswertung (20.08.) ────────────────────────────────────────
#
# Die Bandlogik ist der gefaehrlichste Teil: Baender, die sich ueberschneiden
# oder eine Luecke lassen, machen die ganze Messung wertlos — Balken wuerden
# doppelt oder gar nicht gezaehlt, ohne dass es auffiele.

import services.volatilitaet_auswertung as _VA                    # noqa: E402


def test_vola_baender_sind_lueckenlos_und_ueberschneidungsfrei():
    """JEDER ATR-Wert faellt in GENAU EIN absolutes Band."""
    proben = [0.0001, 0.05, 0.2999, 0.3, 0.30001, 1.0, 1.5, 1.50001,
              1.9, 2.0, 2.00001, 2.9, 3.0, 3.00001, 8.5, 99.0]
    for wert in proben:
        treffer = [name for name, u, o, _ in _VA.ABSOLUTE_BAENDER
                   if _VA._im_band(wert, u, o)]
        assert len(treffer) == 1, f"ATR {wert} faellt in {treffer}"


def test_vola_band_grenzen_folgen_der_live_regel():
    """Die Grenzen muessen zu getVolatilityAdjustedRisk passen: dort entscheidet
    `atrPct > 3.0` bzw. `atrPct < 0.3`. Genau 0.3 gehoert NICHT ins
    Niedrig-Band, genau 3.0 nicht ins Hoch-Band."""
    assert _VA._im_band(0.3, None, 0.3) is True      # <= 0.3 -> Niedrig-Band
    assert _VA._im_band(0.3, 0.3, 1.5) is False      # nicht doppelt
    assert _VA._im_band(3.0, 3.0, None) is False     # 3.0 ist nicht > 3.0
    assert _VA._im_band(3.0, 2.0, 3.0) is True
    assert _VA._im_band(None, None, 0.3) is False    # Aufwaermphase zaehlt nie


def test_vola_reihe_setzt_fremde_balken_auf_neutral():
    """Nur Balken IM Band behalten ihr Signal — alle anderen werden NEUTRAL."""
    hist = {
        "konsens": ["LONG", "SHORT", "LONG", "SHORT"],
        "atrPct":  [0.1,    2.5,     None,   1.0],
    }
    gefiltert = _VA._reihe_fuer_band(hist, None, 0.3)["konsens"]
    assert gefiltert == ["LONG", "NEUTRAL", "NEUTRAL", "NEUTRAL"], gefiltert
    hoch = _VA._reihe_fuer_band(hist, 2.0, 3.0)["konsens"]
    assert hoch == ["NEUTRAL", "SHORT", "NEUTRAL", "NEUTRAL"], hoch


def test_vola_reihe_laesst_alles_andere_unveraendert():
    """Nur `konsens` wird ersetzt — Kurse und uebrige Felder bleiben, sonst
    aendert sich die Basis und der Vergleich waere schief."""
    hist = {"konsens": ["LONG"], "atrPct": [1.0], "kurs": [1.23], "symbol": "X"}
    aus = _VA._reihe_fuer_band(hist, 0.3, 1.5)
    assert aus["kurs"] == [1.23] and aus["symbol"] == "X"


def test_vola_relative_grenzen_bei_zu_wenig_daten():
    """Unter 50 Werten wird NICHT geschnitten — lieber kein relativer Schnitt
    als Faecher auf einer duennen Verteilung."""
    assert _VA._relative_grenzen([1.0] * 20) == []
    assert _VA._relative_grenzen([None] * 100) == []


def test_vola_relative_grenzen_teilen_in_fuenftel():
    werte = [float(i) for i in range(100)]
    grenzen = _VA._relative_grenzen(werte)
    assert len(grenzen) == _VA.RELATIVE_FAECHER - 1, grenzen
    assert grenzen == sorted(grenzen), grenzen


def test_vola_flache_verteilung_wird_nicht_geschnitten():
    """Bei lauter gleichen Werten waeren die Grenzen identisch und die Faecher
    leer — dann lieber gar nicht schneiden."""
    assert _VA._relative_grenzen([0.5] * 200) == []


def test_vola_ohne_atr_meldet_das_ehrlich():
    aus = _VA.bewerte_nach_volatilitaet(
        {"status": "ok", "konsens": ["LONG"], "atrPct": [None], "kurs": [1.0]})
    assert aus["status"] == "kein_atr", aus


def test_vola_bandbasis_nimmt_nur_die_balken_des_bandes():
    """DER wichtigste Test dieses Moduls (20.08.).

    Die erste Fassung mass den Vorteil gegen die Basis ueber ALLE Balken. Bei
    ATR-Baendern ist das verzerrt: hohe Baender bewegen sich per Definition
    mehr. bandbasis() muss deshalb AUSSCHLIESSLICH die Balken des Bandes
    heranziehen.
    """
    # Kurse: in den ruhigen Balken (ATR 0.1) passiert nichts, in den bewegten
    # (ATR 2.5) geht es je 10 % hoch.
    kurse = [100.0, 100.0, 100.0, 100.0, 110.0, 121.0, 133.1, 146.41]
    atr = [0.1, 0.1, 0.1, 2.5, 2.5, 2.5, 2.5, 2.5]

    ruhig = _VA.bandbasis(kurse, atr, None, 0.3, k=1)
    bewegt = _VA.bandbasis(kurse, atr, 2.0, 3.0, k=1)

    assert ruhig["n"] == 3, ruhig            # Balken 0,1,2 haben eine Zukunft
    # Balken 2 blickt auf Balken 3 — der steht noch bei 100. Alle drei ruhigen
    # Balken haben also Rendite null; der Anstieg beginnt erst danach.
    assert abs(ruhig["mittel"]) < 1e-12, ruhig
    assert bewegt["n"] == 4, bewegt          # Balken 3,4,5,6 (7 hat keine Zukunft)
    assert bewegt["mittel"] > 0.09, bewegt   # rund 10 % je Balken
    # Der Kern: die beiden Basen sind VERSCHIEDEN. Genau dieser Unterschied
    # ging in der ersten Fassung verloren.
    assert bewegt["mittel"] > ruhig["mittel"] * 2


def test_vola_bandbasis_ohne_balken():
    """Ein Band ohne Balken liefert None — keine erfundene Null."""
    leer = _VA.bandbasis([100.0, 101.0], [0.1, 0.1], 5.0, None, k=1)
    assert leer["n"] == 0 and leer["mittel"] is None


def test_vola_bandbasis_zaehlt_den_rand_nicht_mit():
    """Balken ohne Zukunft duerfen nicht als Nullrendite eingehen."""
    kurse = [100.0, 101.0, 102.0]
    atr = [1.0, 1.0, 1.0]
    aus = _VA.bandbasis(kurse, atr, 0.3, 1.5, k=2)
    assert aus["n"] == 1, aus   # nur Balken 0 hat einen Balken 2 vor sich


# ---------------------------------------------------------------------------
# Bandhistorie: die Verdichtung ueber viele Symbole und das Ansammeln ueber
# Wochen (23.08.). Grund: eine einmalige Messung ist bei rund 90 Tagen
# gedeckelt — 180 Tage auf 4h lassen am Fensteranfang 12,5 von 16 Strategien
# ohne Daten, 90 Tage nur 1,0. Mehr Belege gibt es nur durch Ansammeln.
# ---------------------------------------------------------------------------

def _band(n_long=0, v_long=0.0, vb_long=None, n_short=0, v_short=0.0,
          vb_short=None, balken=0, bloecke_long=0, bloecke_short=0):
    """Baut EINEN Bandeintrag in der Form, die bewerte_nach_volatilitaet liefert."""
    kz = {
        "LONG": {"n": n_long, "vorteilPct": v_long, "trefferPct": 50.0,
                 "vorteilGegenBandPct": vb_long},
        "SHORT": {"n": n_short, "vorteilPct": v_short, "trefferPct": 50.0,
                  "vorteilGegenBandPct": vb_short},
    }
    return {"balken": balken, "kennzahlen": kz,
            "bloecke": {"LONG": bloecke_long, "SHORT": bloecke_short}}


def _bewertung(**baender):
    return {"status": "ok", "absolut": dict(baender), "relativ": {}}


def test_bandhistorie_gewichtet_mit_der_fallzahl():
    """Ein Symbol mit 200 Faellen muss schwerer wiegen als eines mit 10.

    Ohne Gewichtung waere das Mittel (1.0 + -1.0)/2 = 0.0. Richtig gewichtet
    ist es (200*1.0 + 10*-1.0)/210 = +0.9048.

    BEIDE Spalten werden geprueft, mit VERSCHIEDENEN Werten. Die erste Fassung
    dieses Tests hing nur an vorteilGegenBandPct und setzte beide Werte gleich
    — im Sabotage-Lauf vom 23.08. liess sich die Gewichtung von vorteilPct
    dadurch entfernen, ohne dass ein Test rot wurde.
    """
    a = _bewertung(**{"unter_0.3": _band(n_long=200, v_long=1.0, vb_long=2.0)})
    b = _bewertung(**{"unter_0.3": _band(n_long=10, v_long=-1.0, vb_long=-2.0)})
    aus = _VA.verdichte_baender([a, b])["absolut"]["unter_0.3"]
    assert aus["faelle"] == 210, aus
    assert abs(aus["vorteilPct"] - 0.9048) < 0.001, aus
    assert abs(aus["vorteilGegenBandPct"] - 1.8095) < 0.001, aus
    # Die Trefferquote laeuft ueber dieselbe Gewichtung und ist sonst nirgends
    # geprueft — beide Symbole liefern 50 %, also muss 50 % herauskommen.
    assert abs(aus["trefferPct"] - 50.0) < 0.001, aus


def test_bandhistorie_zaehlt_symbole_im_plus():
    """In wie vielen Maerkten der Vorteil positiv war — die Zeile, die vor
    einer Aussage aus einem einzigen Ausreisser schuetzt."""
    plus = _bewertung(**{"unter_0.3": _band(n_long=5, v_long=2.0, vb_long=2.0)})
    minus = _bewertung(**{"unter_0.3": _band(n_long=5, v_long=-2.0, vb_long=-2.0)})
    null = _bewertung(**{"unter_0.3": _band(n_long=0)})   # keine Faelle
    aus = _VA.verdichte_baender([plus, minus, minus, null])["absolut"]["unter_0.3"]
    assert aus["symbole"] == 3, aus        # das leere zaehlt nicht mit
    assert aus["symbolePlus"] == 1, aus


def test_bandhistorie_summiert_balken_und_bloecke():
    """BLOECKE sind die ehrliche Fallzahl — zusammenhaengende Laeufe, nicht
    einzelne Balken. Fielen sie aus der Verdichtung, saehe jede Auswertung
    mehr Belege, als es gibt. Im Sabotage-Lauf vom 23.08. liessen sich beide
    Summen auf null setzen, ohne dass ein Test rot wurde.
    """
    a = _bewertung(**{"unter_0.3": _band(n_long=5, v_long=1.0, vb_long=1.0,
                                         balken=40, bloecke_long=3, bloecke_short=2)})
    b = _bewertung(**{"unter_0.3": _band(n_short=7, v_short=1.0, vb_short=1.0,
                                         balken=60, bloecke_long=1, bloecke_short=4)})
    aus = _VA.verdichte_baender([a, b])["absolut"]["unter_0.3"]
    assert aus["balken"] == 100, aus
    assert aus["bloecke"] == 10, aus       # 3+2+1+4, ueber beide Richtungen
    assert aus["faelle"] == 12, aus        # 5 LONG + 7 SHORT


def test_bandhistorie_verwirft_nicht_ok_und_meldet_warum():
    aus = _VA.verdichte_baender([
        _bewertung(**{"unter_0.3": _band(n_long=5, v_long=1.0, vb_long=1.0)}),
        {"status": "kein_atr"},
        {"status": "kein_atr"},
        {"status": "zu_kurz"},
        None,
    ])
    assert aus["symbole"] == 1, aus
    assert aus["verworfen"] == {"kein_atr": 2, "zu_kurz": 1, "unbekannt": 1}, aus


def test_bandhistorie_ohne_faelle_meldet_none_statt_null():
    """Eine 0 liesse sich als "gemessen, kein Vorteil" lesen — es war aber gar
    nichts da."""
    aus = _VA.verdichte_baender([])["absolut"]["unter_0.3"]
    assert aus["faelle"] == 0 and aus["vorteilPct"] is None, aus
    assert aus["trefferPct"] is None, aus


def test_bandhistorie_faellt_auf_gesamtvorteil_zurueck():
    """Fehlt die bandeigene Basis, muss der Gesamtvorteil einspringen — sonst
    zaehlt der Fall bei n mit, aber nicht in der Summe, und das Mittel bezoege
    sich auf eine andere Grundmenge als die Fallzahl."""
    a = _bewertung(**{"unter_0.3": _band(n_long=10, v_long=0.5, vb_long=None)})
    aus = _VA.verdichte_baender([a])["absolut"]["unter_0.3"]
    assert aus["faelle"] == 10, aus
    assert abs(aus["vorteilGegenBandPct"] - 0.5) < 1e-9, aus


def test_bandhistorie_traegt_den_live_faktor_mit():
    """Ohne den Faktor daneben ist die Zahl nicht deutbar — man saehe den
    Vorteil, aber nicht, wie das System heute darauf reagiert."""
    aus = _VA.verdichte_baender([])["absolut"]
    assert aus["ueber_3.0"]["liveRisikoFaktor"] == 0.4, aus["ueber_3.0"]
    assert aus["unter_0.3"]["liveRisikoFaktor"] == 0.7, aus["unter_0.3"]


def test_bandhistorie_haengt_an_und_schneidet_vorne_ab():
    alt = [{"i": i} for i in range(5)]
    aus = _VA.haenge_an_historie(alt, {"i": 99}, max_eintraege=3)
    assert aus == [{"i": 3}, {"i": 4}, {"i": 99}], aus


def test_bandhistorie_uebersteht_kaputten_vorzustand():
    """Ein verunglueckter Altwert darf den Wochenlauf nicht kippen."""
    for kaputt in (None, "keine liste", 42, {"a": 1}):
        aus = _VA.haenge_an_historie(kaputt, {"neu": True})
        assert aus == [{"neu": True}], (kaputt, aus)
    gemischt = _VA.haenge_an_historie([{"ok": 1}, "muell", 7], {"neu": True})
    assert gemischt == [{"ok": 1}, {"neu": True}], gemischt


def test_bandhistorie_wird_in_den_wochenlauf_geschrieben():
    """Die Verdrahtung selbst — nicht nur die Funktion. Genau hier ist im
    Repository wiederholt etwas gebaut und nie aufgerufen worden."""
    geschrieben = {}

    def _set(key, value, ttl):
        geschrieben["key"], geschrieben["value"], geschrieben["ttl"] = key, value, ttl
        return True

    alt_set, alt_get = _KA.redis_set_json, _KA.redis_get_json
    try:
        _KA.redis_set_json = _set
        _KA.redis_get_json = lambda key: [{"alt": True}]
        _KA._schreibe_bandhistorie(
            [_bewertung(**{"unter_0.3": _band(n_long=7, v_long=0.2, vb_long=0.2)})])
    finally:
        _KA.redis_set_json, _KA.redis_get_json = alt_set, alt_get

    assert geschrieben["key"] == _KA.REDIS_KEY_VOLA_BAENDER, geschrieben
    # Muss deutlich laenger halten als der Konsens-Schluessel, sonst ist die
    # Historie nach einem ausgefallenen Wochenlauf weg.
    assert geschrieben["ttl"] > _KA.TTL * 10, geschrieben["ttl"]
    assert geschrieben["value"][0] == {"alt": True}, geschrieben["value"]
    zeile = geschrieben["value"][-1]
    assert zeile["symbole"] == 1 and zeile["fensterTage"] == _KA.FENSTER_TAGE, zeile
    assert zeile["absolut"]["unter_0.3"]["faelle"] == 7, zeile["absolut"]
    assert zeile["gemessenAm"], zeile


def test_bandhistorie_schreibt_nichts_ohne_bewertungen():
    """Kein leerer Eintrag — der wuerde die Historie mit Nullzeilen verwaessern."""
    gerufen = []
    alt_set = _KA.redis_set_json
    try:
        _KA.redis_set_json = lambda *a, **k: gerufen.append(a) or True
        _KA._schreibe_bandhistorie([])
    finally:
        _KA.redis_set_json = alt_set
    assert gerufen == [], gerufen


def test_bandmessung_reisst_den_wochenlauf_nicht_mit():
    """Beiwerk darf die Konsens-Auswertung nicht kippen — weder bei einem
    Absturz in der Bewertung noch bei einem Redis-Fehler."""
    sammler = []
    _KA._sammle_volatilitaet({"status": "ok", "kurs": None}, sammler, "X")
    assert sammler == [], sammler   # abgefangen, nichts gesammelt

    alt_set = _KA.redis_set_json
    try:
        def _kaputt(*a, **k):
            raise RuntimeError("Redis weg")
        _KA.redis_set_json = _kaputt
        _KA._schreibe_bandhistorie(
            [_bewertung(**{"unter_0.3": _band(n_long=1, v_long=0.1, vb_long=0.1)})])
    finally:
        _KA.redis_set_json = alt_set


def test_bandmessung_sammelt_eine_echte_reihe():
    """Ende zu Ende: echte Konsens-Reihe -> _sammle_volatilitaet -> Verdichtung."""
    n = 120
    hist = {
        "status": "ok", "symbol": "TEST", "taktIntervall": "4h", "balken": n,
        "kurs": [100.0 + i * 0.5 for i in range(n)],
        "konsens": ["LONG" if i % 3 == 0 else "NEUTRAL" for i in range(n)],
        "atrPct": [0.2 if i % 2 == 0 else 2.5 for i in range(n)],
    }
    sammler = []
    _KA._sammle_volatilitaet(hist, sammler, "TEST")
    assert len(sammler) == 1, sammler
    aus = _VA.verdichte_baender(sammler)
    assert aus["symbole"] == 1 and aus["verworfen"] == {}, aus
    # Beide bestueckten Baender muessen Faelle zeigen; das ruhige Band haelt die
    # geraden Balken, das bewegte die ungeraden.
    assert aus["absolut"]["unter_0.3"]["faelle"] > 0, aus["absolut"]
    assert aus["absolut"]["2.0_bis_3.0"]["faelle"] > 0, aus["absolut"]


def test_wochenlauf_schreibt_die_bandhistorie_wirklich():
    """ECHTER DURCHLAUF von _run_konsens_auswertung_inner.

    WARUM NICHT NUR DIE FUNKTION. Der Test darueber ruft
    _schreibe_bandhistorie direkt auf — wer den AUFRUF aus dem Wochenlauf
    entfernt, bliebe damit gruen. Genau diese Fehlerklasse ("gebaut, nie
    verdrahtet") hat in diesem Repository wiederholt zugeschlagen. Hier laeuft
    deshalb die echte Schleife; nur das Datenholen und Redis sind ersetzt.
    """
    n = 90
    def _reihe(symbol, tage=None):
        return {
            "status": "ok", "symbol": symbol, "taktIntervall": "4h", "balken": n,
            "kurs": [100.0 + i * 0.3 for i in range(n)],
            "konsens": ["LONG" if i % 4 == 0 else "NEUTRAL" for i in range(n)],
            "atrPct": [0.2 if i % 2 == 0 else 2.5 for i in range(n)],
        }

    geschrieben: dict = {}
    def _set(key, value, ttl):
        geschrieben[key] = value
        return True

    alt = (_KA.hole_historie, _KA.WATCHLIST, _KA.PAUSE_SEK,
           _KA.redis_set_json, _KA.redis_get_json)
    try:
        _KA.hole_historie = _reihe
        _KA.WATCHLIST = ["AAA", "BBB"]
        _KA.PAUSE_SEK = 0
        _KA.redis_set_json = _set
        _KA.redis_get_json = lambda key: geschrieben.get(key)
        _KA._run_konsens_auswertung_inner()
    finally:
        (_KA.hole_historie, _KA.WATCHLIST, _KA.PAUSE_SEK,
         _KA.redis_set_json, _KA.redis_get_json) = alt

    # Der Konsens-Schluessel muss weiterhin geschrieben werden ...
    assert _KA.REDIS_KEY_KONSENS in geschrieben, list(geschrieben)
    assert geschrieben[_KA.REDIS_KEY_KONSENS]["symbole"] == 2

    # ... UND die Bandhistorie, ohne dass jemand sie von Hand anstoesst.
    assert _KA.REDIS_KEY_VOLA_BAENDER in geschrieben, list(geschrieben)
    historie = geschrieben[_KA.REDIS_KEY_VOLA_BAENDER]
    assert len(historie) == 1, historie
    zeile = historie[0]
    assert zeile["symbole"] == 2, zeile
    assert zeile["absolut"]["unter_0.3"]["faelle"] > 0, zeile["absolut"]
    # Jedes Live-Band muss in der Zeile stehen, sonst faellt spaeter eines
    # stillschweigend aus der Auswertung.
    for name, _u, _o, _f in _VA.ABSOLUTE_BAENDER:
        assert name in zeile["absolut"], (name, list(zeile["absolut"]))


def test_wochenlauf_haengt_bei_jedem_lauf_eine_zeile_an():
    """Zwei Laeufe hintereinander muessen zwei Zeilen ergeben — sonst waechst
    die Belegbasis nie, und genau dafuer ist die Historie da."""
    n = 90
    def _reihe(symbol, tage=None):
        return {
            "status": "ok", "symbol": symbol, "taktIntervall": "4h", "balken": n,
            "kurs": [100.0 + i * 0.3 for i in range(n)],
            "konsens": ["LONG" if i % 4 == 0 else "NEUTRAL" for i in range(n)],
            "atrPct": [1.0] * n,
        }

    geschrieben: dict = {}
    alt = (_KA.hole_historie, _KA.WATCHLIST, _KA.PAUSE_SEK,
           _KA.redis_set_json, _KA.redis_get_json)
    try:
        _KA.hole_historie = _reihe
        _KA.WATCHLIST = ["AAA"]
        _KA.PAUSE_SEK = 0
        _KA.redis_set_json = lambda key, value, ttl: geschrieben.__setitem__(key, value) or True
        _KA.redis_get_json = lambda key: geschrieben.get(key)
        _KA._run_konsens_auswertung_inner()
        _KA._run_konsens_auswertung_inner()
    finally:
        (_KA.hole_historie, _KA.WATCHLIST, _KA.PAUSE_SEK,
         _KA.redis_set_json, _KA.redis_get_json) = alt

    assert len(geschrieben[_KA.REDIS_KEY_VOLA_BAENDER]) == 2, \
        geschrieben[_KA.REDIS_KEY_VOLA_BAENDER]


# ---------------------------------------------------------------------------
# Leseendpunkt der Bandhistorie (23.08.).
#
# GEFUNDEN BEI DER GENERALKONTROLLE: die Historie wurde geschrieben, aber von
# NIRGENDWO gelesen. analysis:konsens hat seit jeher einen Endpunkt, die neue
# Bandhistorie hatte keinen — sie waere ein Jahr lang in Redis gewachsen, ohne
# dass jemand sie je haette ansehen koennen. Angesammeltes, das niemand lesen
# kann, ist keine Messung.
# ---------------------------------------------------------------------------

import api.routes.data as _RD                                    # noqa: E402


def test_vola_endpunkt_ist_registriert():
    """Der Pfad muss am Router haengen — nicht nur die Funktion existieren.

    Das ist der eigentliche Riegel: wer den Dekorator entfernt, laesst die
    Funktion stehen und jeder Funktionstest bliebe gruen.
    """
    pfade = {r.path for r in _RD.router.routes}
    assert "/vola-baender" in pfade, sorted(pfade)
    treffer = [r for r in _RD.router.routes if r.path == "/vola-baender"]
    assert "GET" in treffer[0].methods, treffer[0].methods


def test_vola_endpunkt_ohne_daten():
    alt = _RD.redis_get_json
    try:
        _RD.redis_get_json = lambda k: None
        aus = _RD.get_vola_baender()
    finally:
        _RD.redis_get_json = alt
    assert aus["available"] is False and aus["laeufe"] == 0, aus
    assert aus["neuester"] is None and aus["data"] == [], aus


def test_vola_endpunkt_liest_den_richtigen_schluessel():
    """Sonst laege eine Antwort vor, die aus einer anderen Messung stammt."""
    gefragt = []
    alt = _RD.redis_get_json
    try:
        _RD.redis_get_json = lambda k: gefragt.append(k) or []
        _RD.get_vola_baender()
    finally:
        _RD.redis_get_json = alt
    assert gefragt == [_KA.REDIS_KEY_VOLA_BAENDER], gefragt


def test_vola_endpunkt_zaehlt_laeufe_und_zeigt_den_neuesten():
    alt = _RD.redis_get_json
    try:
        _RD.redis_get_json = lambda k: [{"nr": 1}, {"nr": 2}, {"nr": 3}]
        aus = _RD.get_vola_baender()
    finally:
        _RD.redis_get_json = alt
    assert aus["available"] is True and aus["laeufe"] == 3, aus
    # Der NEUESTE ist der letzte — haenge_an_historie haengt hinten an.
    assert aus["neuester"] == {"nr": 3}, aus


def test_vola_endpunkt_uebersteht_kaputten_speicher():
    """Ein verunglueckter Redis-Wert darf keine 500 werfen."""
    for kaputt in ("kaputt", 42, {"kein": "list"}):
        alt = _RD.redis_get_json
        try:
            _RD.redis_get_json = lambda k, _w=kaputt: _w
            aus = _RD.get_vola_baender()
        finally:
            _RD.redis_get_json = alt
        assert aus["available"] is False and aus["data"] == [], (kaputt, aus)


def test_bandhistorie_deckel_greift_auch_ohne_argument():
    """Der STANDARDWERT muss decken, nicht nur ein mitgegebener.

    GEFUNDEN BEI DER GENERALKONTROLLE 23.08.: der Deckel-Test gab
    max_eintraege=3 mit. Damit war BAND_HISTORIE_MAX selbst ungeprueft — auf 0
    gesetzt schaltet die Bedingung `max_eintraege > 0` den Deckel still ab und
    die Historie waechst unbegrenzt weiter. Dieselbe Fehlerklasse wie beim
    Snapshot: die Struktur stimmt, der WERT nicht.
    """
    assert _VA.BAND_HISTORIE_MAX > 0, "ein Deckel von 0 schaltet das Abschneiden ab"
    assert _VA.BAND_HISTORIE_MAX <= 500, "so viele Wochenlaeufe passen nicht in einen Redis-Wert"

    alt = [{"i": i} for i in range(_VA.BAND_HISTORIE_MAX + 5)]
    aus = _VA.haenge_an_historie(alt, {"i": "neu"})      # OHNE max_eintraege
    assert len(aus) == _VA.BAND_HISTORIE_MAX, len(aus)
    assert aus[-1] == {"i": "neu"}, aus[-1]
    # Vorne wurde abgeschnitten, nicht hinten.
    assert aus[0] == {"i": 6}, aus[0]


def test_bandhistorie_deckel_reicht_fuer_ein_jahr():
    """60 Wochenlaeufe sind gut ein Jahr. Faellt der Wert unter ein halbes
    Jahr, waere die Historie kuerzer als der Zeitraum, ueber den sie Aussagen
    tragen soll — dann kann man sie auch weglassen."""
    assert _VA.BAND_HISTORIE_MAX >= 26, _VA.BAND_HISTORIE_MAX


def test_vola_kennzahlen_wird_nicht_vom_konsens_modul_ueberdeckt():
    """Beide Module haben ein _kennzahlen — mit VERSCHIEDENEN Signaturen.

    konsens_auswertung._kennzahlen(renditen: list) gegen
    volatilitaet_auswertung._kennzahlen(teil: dict). Wer den Namen versehentlich
    in die Importliste aufnimmt, bekaeme keinen Fehler, sondern falsche Zahlen.
    Der Test haelt fest, dass das lokale gemeint ist.
    """
    import inspect
    parameter = list(inspect.signature(_VA._kennzahlen).parameters)
    assert parameter == ["teil"], parameter
    # Und es ist wirklich ein anderes als das im Konsens-Modul.
    assert _VA._kennzahlen is not _KA._kennzahlen
    assert list(inspect.signature(_KA._kennzahlen).parameters) == ["renditen"]


# ---------------------------------------------------------------------------
# Redis-Schluessel muessen ueber alle Fundstellen deckungsgleich sein (23.08.).
#
# GEFUNDEN BEI DER GENERALKONTROLLE. Neun Schluesselnamen, fuenf davon in
# mehreren Dateien definiert, und vier werden in periodic_report.py mit einem
# LITERAL statt der Konstante gelesen. Heute stimmt alles ueberein — aber
# nichts wuerde es merken, wenn es aufhoert. Wer analysis:konsens in
# konsens_auswertung.py umbenennt, laesst periodic_report ins Leere greifen:
# kein Fehler, keine Ausnahme, nur ein Bericht ohne Konsens-Abschnitt.
#
# Das ist dieselbe Fehlerklasse, fuer die es im Frontend epic-tables und
# watchlist-sync gibt: ein Wert, der an mehreren Stellen gleich sein MUSS.
# ---------------------------------------------------------------------------

def _redis_schluessel_definitionen():
    """Alle `REDIS_KEY_X = "..."` im Dienst, nach Namen gruppiert."""
    import re as _re
    from pathlib import Path as _Path

    wurzel = _Path(__file__).resolve().parent.parent
    aus: dict[str, list[tuple[str, str]]] = {}
    for pfad in wurzel.rglob("*.py"):
        if "__pycache__" in str(pfad):
            continue
        for m in _re.finditer(
            r'^(REDIS_KEY_\w+)\s*=\s*"([^"]+)"',
            pfad.read_text(encoding="utf-8", errors="ignore"), _re.M
        ):
            aus.setdefault(m.group(1), []).append((pfad.name, m.group(2)))
    return aus


def test_gleichnamige_redis_schluessel_haben_denselben_wert():
    """Fuenf Namen stehen in mehreren Dateien. Weichen sie ab, schreibt der
    eine Dienst dorthin, wo der andere nicht liest."""
    defs = _redis_schluessel_definitionen()
    assert len(defs) >= 8, f"nur {len(defs)} Schluessel gefunden — Muster kaputt?"

    mehrfach = {n: o for n, o in defs.items() if len(o) > 1}
    assert mehrfach, "keine mehrfach definierten Schluessel gefunden — Muster kaputt?"

    for name, orte in mehrfach.items():
        werte = {wert for _, wert in orte}
        assert len(werte) == 1, (
            f"{name} hat verschiedene Werte: "
            + ", ".join(f"{d}={w}" for d, w in orte)
        )


def _frontend_analysis_schluessel() -> dict:
    """Alle `analysis:`-Schluessel, die das TypeScript-Frontend benutzt.

    NOETIG, weil zwei Schluessel die SPRACHGRENZE ueberqueren: das Frontend
    schreibt analysis:applied_overrides und analysis:recommendations, der
    Wochenbericht in Python liest sie. Ein Pruefer, der nur den Python-Baum
    kennt, haelt sie faelschlich fuer herrenlos — genau das ist mir am 23.08.
    passiert, bevor ich nachgesehen habe.

    Der Build-Ausgabeordner .next wird ausgelassen: dort liegen Kopien, die
    beim naechsten Build ueberschrieben werden. Wer die mitzaehlt, prueft
    einen Abzug statt der Quelle.
    """
    import re as _re
    from pathlib import Path as _Path

    lib = _Path(__file__).resolve().parent.parent.parent / "frontend" / "lib"
    aus: dict[str, str] = {}
    if not lib.is_dir():
        return aus
    for pfad in lib.rglob("*.ts"):
        if ".next" in pfad.parts:
            continue
        for m in _re.finditer(r'"(analysis:[^"]+)"',
                              pfad.read_text(encoding="utf-8", errors="ignore")):
            aus[m.group(1)] = pfad.name
    return aus


def test_sprachuebergreifende_schluessel_stimmen_ueberein():
    """Zwei Schluessel werden in TypeScript geschrieben und in Python gelesen.

    Die Zeichenkette steht dabei ZWEIMAL im Quelltext, in zwei Sprachen, und
    nichts glich sie bisher ab. Wer eine Seite umbenennt, bekommt keinen
    Fehler: das Frontend schreibt weiter, der Bericht liest weiter — nur eben
    aneinander vorbei, und der Abschnitt bleibt fuer immer leer.

    Namentlich festgehalten statt automatisch abgeleitet: eine Ableitung waere
    gruen, sobald BEIDE Seiten verschwinden.
    """
    import re as _re
    from pathlib import Path as _Path

    UEBERGREIFEND = ["analysis:applied_overrides", "analysis:recommendations"]

    im_frontend = _frontend_analysis_schluessel()
    wurzel = _Path(__file__).resolve().parent.parent
    im_python = set()
    for pfad in wurzel.rglob("*.py"):
        if "__pycache__" in str(pfad) or pfad.name.startswith("test_"):
            continue
        im_python.update(_re.findall(r'"(analysis:[^"]+)"',
                                     pfad.read_text(encoding="utf-8", errors="ignore")))

    for schluessel in UEBERGREIFEND:
        assert schluessel in im_frontend, (
            f'{schluessel} steht nicht mehr im Frontend — umbenannt? '
            f"Gefunden: {sorted(im_frontend)}"
        )
        assert schluessel in im_python, (
            f'{schluessel} steht nicht mehr im Python-Dienst — umbenannt? '
            f"Gefunden: {sorted(im_python)}"
        )


def test_literal_gelesene_schluessel_treffen_eine_echte_konstante():
    """periodic_report.py liest vier Schluessel als Zeichenkette statt ueber
    die Konstante. Jede davon muss einem definierten Schluessel entsprechen —
    sonst liest der Wochenbericht still ins Leere.

    Die Frontend-Schluessel zaehlen mit: analysis:applied_overrides hat auf der
    Python-Seite gar keine Konstante, weil geschrieben wird es drueben.
    """
    import re as _re
    from pathlib import Path as _Path

    bekannte = {wert for orte in _redis_schluessel_definitionen().values()
                for _, wert in orte}
    bekannte |= set(_frontend_analysis_schluessel())
    wurzel = _Path(__file__).resolve().parent.parent

    geprueft = 0
    for pfad in wurzel.rglob("*.py"):
        if "__pycache__" in str(pfad) or pfad.name.startswith("test_"):
            continue
        for m in _re.finditer(
            r'redis_(?:get|set)_json\(\s*"(analysis:[^"]+)"',
            pfad.read_text(encoding="utf-8", errors="ignore")
        ):
            geprueft += 1
            assert m.group(1) in bekannte, (
                f'{pfad.name} liest "{m.group(1)}" — kein Schluessel dieses '
                f"Namens definiert. Bekannt: {sorted(bekannte)}"
            )

    # Ohne diese Zeile waere der Test gruen, wenn das Muster ins Leere laeuft.
    assert geprueft >= 4, f"nur {geprueft} Literale gefunden — Muster kaputt?"


def test_jeder_geschriebene_schluessel_wird_auch_gelesen():
    """Schreiben ohne Leser ist keine Messung, sondern Ballast.

    Genau das war die Bandhistorie vor diesem Durchgang: geschrieben, 400 Tage
    Haltbarkeit, kein einziger Leser. Gelesen wird sowohl ueber
    redis_get_json() als auch ueber den rohen Client (r.get) — insights.py
    macht Letzteres, und ein Pruefer, der nur das Erste kennt, meldet einen
    Fehlalarm. Beides zaehlt.
    """
    import re as _re
    from pathlib import Path as _Path

    wurzel = _Path(__file__).resolve().parent.parent
    geschrieben: dict[str, str] = {}
    gelesen: set[str] = set()

    for pfad in wurzel.rglob("*.py"):
        if "__pycache__" in str(pfad) or pfad.name.startswith("test_"):
            continue
        t = pfad.read_text(encoding="utf-8", errors="ignore")
        for m in _re.finditer(r'redis_set_json\(\s*(REDIS_KEY_\w+|"analysis:[^"]+")', t):
            geschrieben[m.group(1).strip('"')] = pfad.name
        for m in _re.finditer(
            r'(?:redis_get_json|r\.get|redis\.get)\(\s*(REDIS_KEY_\w+|"analysis:[^"]+")', t
        ):
            gelesen.add(m.group(1).strip('"'))

    assert len(geschrieben) >= 6, f"nur {len(geschrieben)} Schreiber — Muster kaputt?"
    ohne_leser = {k: v for k, v in geschrieben.items() if k not in gelesen}
    assert not ohne_leser, (
        "geschrieben, aber nirgends gelesen: "
        + ", ".join(f"{k} (in {v})" for k, v in sorted(ohne_leser.items()))
    )


# ---------------------------------------------------------------------------
# Die Wurzel muss die ECHTEN Endpunkte nennen (24.08.).
#
# Vorher stand dort eine von Hand gepflegte Liste mit fuenf Eintraegen, waehrend
# der Dienst achtzehn Routen hatte — konsens, muster, walkforward,
# recommendations, comms-check und vola-baender fehlten alle. Dazu ein Verweis
# auf /docs, das mit docs_url=None abgeschaltet ist.
#
# Eine Liste, die von Hand nachgezogen werden muss, veraltet zuverlaessig.
# Diese Pruefung stellt sicher, dass sie ABGELEITET bleibt.
# ---------------------------------------------------------------------------

def _engine_main():
    """main.py importieren — mit den drei Einstellungen, die es dabei liest.

    Der Stub am Kopf dieser Datei setzt settings als leeren Namespace; main.py
    braucht APP_NAME, VERSION und ANALYSIS_API_KEY schon beim Import. Gesetzt
    wird nur, was fehlt, damit kein anderer Test etwas anderes vorfindet als
    bisher. Der Scheduler startet nicht: er sitzt in lifespan().
    """
    from core.config import settings as _s
    for name, wert in (("APP_NAME", "Destinate Analysis Engine"),
                       ("VERSION", "0.0.0-test"),
                       ("ANALYSIS_API_KEY", "")):
        if not hasattr(_s, name):
            setattr(_s, name, wert)
    import main as _M
    return _M


def test_wurzel_nennt_alle_echten_endpunkte():
    _M = _engine_main()

    aus = _M.root()
    echte = {r.path for r in _M.app.routes
             if "GET" in (getattr(r, "methods", set()) or set())
             and r.path not in ("/", "/openapi.json", "/docs", "/redoc")}
    assert set(aus["endpoints"]) == echte, (
        "Wurzel und Router weichen ab — fehlend: "
        f"{sorted(echte - set(aus['endpoints']))}, "
        f"zuviel: {sorted(set(aus['endpoints']) - echte)}"
    )
    # Nicht nur eine Handvoll: der Dienst hat deutlich mehr als die fuenf,
    # die frueher dort standen.
    assert len(aus["endpoints"]) >= 10, aus["endpoints"]
    # Die heute gebaute Bandhistorie muss dabei sein.
    assert "/api/v1/vola-baender" in aus["endpoints"], aus["endpoints"]


def test_wurzel_verweist_nicht_auf_abgeschaltete_doku():
    """docs_url=None — ein Verweis auf /docs ginge ins Leere."""
    _M = _engine_main()

    aus = _M.root()
    assert "docs" not in aus, aus
    assert "/docs" not in str(aus), aus
    assert _M.app.docs_url is None and _M.app.openapi_url is None


def test_wurzel_nennt_die_ausloeser_getrennt():
    """POST-Routen stossen Jobs an und gehoeren nicht in dieselbe Liste wie
    die lesenden Endpunkte."""
    _M = _engine_main()

    aus = _M.root()
    posts = {r.path for r in _M.app.routes
             if "POST" in (getattr(r, "methods", set()) or set())}
    assert set(aus["trigger"]) == posts, (sorted(posts), aus["trigger"])
    assert all(p.startswith("/api/v1/run/") for p in aus["trigger"]), aus["trigger"]
    # Und sie duerfen NICHT in der Leseliste auftauchen.
    assert not (set(aus["trigger"]) & set(aus["endpoints"])), aus
