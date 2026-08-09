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
    _st.redis_get_json = lambda k: _REDIS.get(k)
    _st.redis_set_json = lambda *a, **k: True
    sys.modules["services.storage"] = _st

from services.data_collector import _aggregate, _exit_grund          # noqa: E402
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
