# AI Trading System - Architecture Map

> **Stand 20.08.2026 — Teile dieses Dokuments beschreiben entfernten Code.**
> An diesem Tag wurden 163 Dateien entfernt, die von keiner Stelle des
> Programms mehr erreichbar waren (Fixpunkt-Analyse ueber alle Importe,
> statisch und dynamisch). Belegt durch: die Routentabelle des Builds war
> vorher und nachher **byte-identisch**, TypeScript sauber, alle 16 Pruefer
> gruen. Betroffen sind u. a. die Panels unter `components/portfolio-brain/`
> sowie die Module `lib/learning-reports`, `lib/forward-testing`,
> `lib/claude-integration`, `lib/openai-integration`, `lib/ai-memory`,
> `lib/performance-tracker`, `lib/tradingview-integration`.
> Wer sie zurueckholen will, findet sie vollstaendig in der Git-Historie.


## 01 Core Decision

- portfolio-brain
- portfolio-brain-unified-decision
- unified-decision-trade-approval-sync
- trade-approval-execution-queue-sync

## 02 Execution

- ai-execution-scheduler
- execution-preparation
- dynamic-position-allocation
- smart-broker-execution-sync
- demo-execution
- paper-trading

## 03 Broker Intelligence

- broker-routing-layer
- broker-routing-capitalcom-sync
- broker-routing-icmarkets-sync
- dual-broker-orchestrator
- broker-health-monitor
- broker-health-dual-broker-sync
- smart-broker-selection
- adaptive-broker-weighting
- autonomous-broker-optimization
- broker-execution-quality-learning
- broker-reputation-memory
- broker-evolution-intelligence
- broker-performance-memory
- brokers
- icmarkets-connector

## 04 Strategy Intelligence

- strategy-universe-registry
- strategy-ranking
- strategy-broker-intelligence
- strategy-evolution
- strategy-weight-auto-rebalancing
- strategy-weight-portfolio-brain-sync
- trading-style-priority-engine
- trading-style-priority-trade-approval-sync
- trading-style-priority-unified-decision-sync
- multi-timeframe-trading-style-analysis
- multi-timeframe-unified-decision-sync
- multi-timeframe-trade-approval-sync

## 05 Market Intelligence

- market-data
- market-data-engine
- market-regime
- market-regime-engine
- market-universe
- economic-calendar
- news-intelligence
- tradingview-integration
- intelligence
- bank-institutional-intelligence

## 06 AI / Analysts

- gpt-analyst-engine
- claude-risk-engine
- consensus-engine
- consensus-intelligence
- openai-integration
- claude-integration
- ai-agent
- ai-memory

## 07 Learning / Feedback

- learning-feedback-integration
- learning-reports
- learning-scheduler
- feedback-engine
- outcome-learning-auto-update
- forward-testing
- performance-tracker

## 08 Portfolio / Institutional

- portfolio-intelligence
- institutional-portfolio-brain-sync
- adaptive-confidence

## Dashboard Panels

Future target structure:

- components/dashboard/broker/
- components/dashboard/strategy/
- components/dashboard/execution/
- components/dashboard/portfolio/
- components/dashboard/learning/
- components/dashboard/market/
- components/dashboard/ai/

## Refactor Rule

Do not move existing module folders until:

1. All imports are mapped.
2. API routes are mapped.
3. Dashboard panel imports are mapped.
4. Build passes before and after each move.
5. One refactor group is moved per commit.
