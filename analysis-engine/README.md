# Destinate Analysis Engine

Autonomer Analyse-Service — läuft als eigener Railway-Service, komplett
getrennt vom Live-Trading. Er liest Daten, lernt daraus und publiziert
Empfehlungen. **Fällt er aus, läuft das Trading unverändert weiter.**

## Architektur

```
Data Collector ──► Backtest Engine ──► Forward-Test Validator
      │                                        │
News & Geo Intel ──────────────────────► AI Learning Manager
                                               │
                                     Redis: analysis:insights
                                               │
                                     destinate Orchestrator (liest)
```

## Module & Phasen

| Phase | Modul | Status |
|-------|-------|--------|
| 1 | FastAPI Skeleton + Scheduler + Railway Deploy | ✅ |
| 2 | Data Collector (Trades aus PG) + News/Geo Intel (GDELT, Zentralbank-RSS) | ⬜ |
| 3 | Backtest Engine (vectorbt, nachts 02:00 UTC) | ⬜ |
| 4 | Forward-Test Validator + AI Learning Manager (Claude) + Telegram-Report | ⬜ |
| 5 | Orchestrator-Integration (Insights als Filter, mit Fallback) | ⬜ |

## Railway Setup (neuer Service)

1. Railway → New Service → GitHub Repo → **Root Directory: `analysis-engine`**
2. Environment Variables setzen (Werte aus den bestehenden Services kopieren):
   - `DATABASE_URL` — vom Postgres-Service (Reference Variable)
   - `REDIS_URL` — vom Redis-Service (Reference Variable)
   - `PYTHON_BACKEND_URL` — `http://exquisite-rejoicing.railway.internal:8000`
   - `ANTHROPIC_API_KEY` — wie bei destinate
   - `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` — wie bei destinate

**Keine Credentials im Code oder Chat — immer Railway Environment Variables.**

## Endpoints

- `GET /health` — Status + welche Configs gesetzt sind (nur booleans, keine Werte)
- `GET /api/v1/insights` — aktuelle Analyse-Empfehlungen aus Redis
