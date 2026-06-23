"""
Market Mapper — Symbol Mapping für Capital.com + IC Markets
Einheitliche Symbole für beide Broker + Yahoo Finance + Python Backend.
"""

from typing import Optional

# ── Capital.com: Epic → internes Symbol ──────────────────────────────────────

CAPITAL_EPIC_TO_SYMBOL: dict[str, str] = {
    # Forex
    "EURUSD": "EURUSD", "GBPUSD": "GBPUSD", "USDJPY": "USDJPY",
    "AUDUSD": "AUDUSD", "USDCHF": "USDCHF", "USDCAD": "USDCAD",
    "EURGBP": "EURGBP", "EURJPY": "EURJPY", "GBPJPY": "GBPJPY",
    "NZDUSD": "NZDUSD",
    # Metals
    "GOLD":   "XAUUSD", "SILVER": "XAGUSD",
    "XAUUSD": "XAUUSD", "XAGUSD": "XAGUSD",
    # Indices
    "US500":  "US500",  "SPX500": "US500",
    "UK100":  "UK100",
    "USTEC":  "NAS100", "US100":  "NAS100",
    "DE40":   "GER40",
    "US30":   "US30",
    # Oil
    "OIL_CRUDE": "USOIL", "USOIL": "USOIL", "OIL": "USOIL",
    "OIL_BRENT": "BRENT", "BRENT": "BRENT",
    # Crypto
    "BTCUSD": "BTCUSD", "ETHUSD": "ETHUSD",
}

# ── IC Markets cTrader: internes Symbol → cTrader symbolName ─────────────────

IC_SYMBOL_MAP: dict[str, str] = {
    # Forex (verified via /api/icmarkets/symbols)
    "EURUSD": "EURUSD",  # symbolId: 1
    "GBPUSD": "GBPUSD",  # symbolId: 2
    "EURJPY": "EURJPY",  # symbolId: 3
    "USDJPY": "USDJPY",  # symbolId: 4
    "AUDUSD": "AUDUSD",  # symbolId: 5
    "USDCHF": "USDCHF",  # symbolId: 6
    "GBPJPY": "GBPJPY",  # symbolId: 7
    "USDCAD": "USDCAD",  # symbolId: 8
    "EURGBP": "EURGBP",  # symbolId: 9
    "NZDUSD": "NZDUSD",  # symbolId: 12
    # Indices
    "US500":  "US500",   # symbolId: 10013
    "SPX500": "US500",
    "UK100":  "UK100",   # symbolId: 10011
    "NAS100": "USTEC",   # symbolId: 10014
    "US100":  "USTEC",
    "GER40":  "DE40",    # symbolId: 10046
    # Commodities
    "XAUUSD": "XAUUSD",  # symbolId: 41
    "GOLD":   "XAUUSD",
    "XAGUSD": "XAGUSD",  # symbolId: 42
    "SILVER": "XAGUSD",
    "USOIL":  "WTI",     # symbolId: 10022
    "OIL":    "WTI",
    "BRENT":  "BRENT",   # symbolId: 10021
}

# ── Yahoo Finance: internes Symbol → yfinance ticker ────────────────────────

YAHOO_SYMBOL_MAP: dict[str, str] = {
    "EURUSD": "EURUSD=X", "GBPUSD": "GBPUSD=X", "USDJPY": "USDJPY=X",
    "USDCHF": "USDCHF=X", "AUDUSD": "AUDUSD=X", "NZDUSD": "NZDUSD=X",
    "USDCAD": "USDCAD=X", "EURGBP": "EURGBP=X", "EURJPY": "EURJPY=X",
    "GBPJPY": "GBPJPY=X",
    "XAUUSD": "GC=F",     # Gold Futures
    "XAGUSD": "SI=F",     # Silver Futures
    "USOIL":  "CL=F",     # Crude Oil
    "BRENT":  "BZ=F",     # Brent Oil
    "BTCUSD": "BTC-USD",  "ETHUSD": "ETH-USD",
    "US30":   "^DJI",     "NAS100": "^NDX",
    "US500":  "^GSPC",    "GER40":  "^GDAXI",
    "UK100":  "^FTSE",
}

# ── Instrument Eigenschaften ─────────────────────────────────────────────────

INSTRUMENT_INFO: dict[str, dict] = {
    # symbol: {type, pip_size, min_sl_pips, category}
    "EURUSD": {"type": "forex",     "pip": 0.0001, "min_sl": 10, "category": "major"},
    "GBPUSD": {"type": "forex",     "pip": 0.0001, "min_sl": 10, "category": "major"},
    "USDJPY": {"type": "forex",     "pip": 0.01,   "min_sl": 10, "category": "major"},
    "AUDUSD": {"type": "forex",     "pip": 0.0001, "min_sl": 10, "category": "major"},
    "USDCHF": {"type": "forex",     "pip": 0.0001, "min_sl": 10, "category": "major"},
    "USDCAD": {"type": "forex",     "pip": 0.0001, "min_sl": 10, "category": "major"},
    "EURGBP": {"type": "forex",     "pip": 0.0001, "min_sl": 10, "category": "cross"},
    "EURJPY": {"type": "forex",     "pip": 0.01,   "min_sl": 10, "category": "cross"},
    "GBPJPY": {"type": "forex",     "pip": 0.01,   "min_sl": 10, "category": "cross"},
    "NZDUSD": {"type": "forex",     "pip": 0.0001, "min_sl": 10, "category": "minor"},
    "XAUUSD": {"type": "metal",     "pip": 0.1,    "min_sl": 5,  "category": "commodity"},
    "XAGUSD": {"type": "metal",     "pip": 0.001,  "min_sl": 5,  "category": "commodity"},
    "USOIL":  {"type": "oil",       "pip": 0.01,   "min_sl": 5,  "category": "commodity"},
    "BRENT":  {"type": "oil",       "pip": 0.01,   "min_sl": 5,  "category": "commodity"},
    "US500":  {"type": "index",     "pip": 0.1,    "min_sl": 5,  "category": "index"},
    "NAS100": {"type": "index",     "pip": 0.1,    "min_sl": 5,  "category": "index"},
    "UK100":  {"type": "index",     "pip": 0.1,    "min_sl": 5,  "category": "index"},
    "GER40":  {"type": "index",     "pip": 0.1,    "min_sl": 5,  "category": "index"},
    "US30":   {"type": "index",     "pip": 0.1,    "min_sl": 5,  "category": "index"},
    "BTCUSD": {"type": "crypto",    "pip": 1.0,    "min_sl": 50, "category": "crypto"},
    "ETHUSD": {"type": "crypto",    "pip": 0.1,    "min_sl": 10, "category": "crypto"},
}

# ── Hilfsfunktionen ───────────────────────────────────────────────────────────

def capital_epic_to_symbol(epic: str) -> str:
    return CAPITAL_EPIC_TO_SYMBOL.get(epic.upper(), epic.upper())

def symbol_to_ic(symbol: str) -> str:
    return IC_SYMBOL_MAP.get(symbol.upper(), symbol.upper())

def symbol_to_yahoo(symbol: str) -> str:
    return YAHOO_SYMBOL_MAP.get(symbol.upper(), symbol.upper())

def get_instrument_info(symbol: str) -> Optional[dict]:
    return INSTRUMENT_INFO.get(symbol.upper())

def get_pip_size(symbol: str) -> float:
    info = get_instrument_info(symbol)
    return info["pip"] if info else 0.0001

def get_all_symbols() -> list[str]:
    return list(INSTRUMENT_INFO.keys())

def get_symbols_by_category(category: str) -> list[str]:
    return [s for s, info in INSTRUMENT_INFO.items() if info["category"] == category]
