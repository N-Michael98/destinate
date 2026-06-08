# V15.A.2 Architecture Classification Report

## Goal

Clean the dashboard architecture without breaking the long-term AI Trading System vision.

Final target:

OpenAI / GPT, Claude, AI Agents and future broker connectors must work together as one connected intelligence system.

The dashboard should be organized into clear centers instead of stacking every engine panel inside AI Agent Control Center.

---

## Core Principle

Engines stay active in the background.

Dashboard panels are only visual layers.

We clean the dashboard first.
We do not delete engines yet.

---

## Final AI Integration Vision

The long-term system must connect:

- OpenAI / GPT Analyst
- Claude Risk Analyst
- Consensus Engine
- Portfolio Brain
- Evolution Engine
- Execution Queue
- Broker Routing
- Capital.com
- IC Markets
- AI Memory
- Learning Feedback
- Forward Testing

Target intelligence flow:

Market Data
↓
News / Fundamentals
↓
GPT Analysis
↓
Claude Risk Review
↓
Consensus Decision
↓
Portfolio Brain
↓
Evolution Species Layer
↓
Execution Queue
↓
Broker Routing
↓
Broker Execution
↓
Outcome Feedback
↓
AI Memory / Learning Loop

---

# Dashboard Target Structure

## 1. Mission Control

Purpose:
High-level overview only.

Status: KEEP

Should show:

- System Status
- Portfolio Snapshot
- Risk Snapshot
- AI Consensus Summary
- Top Opportunity
- Execution Health
- Broker Health

Should NOT show:

- Every engine
- Every species module
- Every learning module
- Old duplicated panels

---

## 2. AI Center

Purpose:
Main AI decision layer.

Status: KEEP / CENTER

Modules:

- GPT Analyst
- Claude Risk
- Consensus
- Portfolio Brain

Future AI connections:

- GPT generates market, technical and fundamental analysis.
- Claude validates risk, drawdown and execution danger.
- Consensus combines AI outputs.
- Portfolio Brain makes final portfolio-level decisions.

Classification:

GPT Analyst: ACTIVE
Claude Risk: ACTIVE
Consensus: ACTIVE
Portfolio Brain: ACTIVE

---

## 3. Evolution Center

Purpose:
Main home for V13-V15 Evolution / Species system.

Status: KEEP / CENTER

Modules:

- Mutation Competition
- Strategy Breeding
- Strategy Species Classification
- Species Survival
- Species Extinction
- Evolution Governance
- Evolution Allocation
- Evolution Allocation Portfolio Sync
- Species Capital Allocation
- Species Position Sizing
- Species Trade Allocation
- Species Execution Queue
- Species Execution Center Sync
- Species Trade Approval Sync
- Species Broker Routing Sync
- Species Execution Ticket Generator
- Species Execution Queue Integration
- Species Live Execution Bridge
- Species Broker Execution Sync

Classification:

Mutation Competition: ACTIVE
Strategy Breeding: ACTIVE
Strategy Species Classification: ACTIVE
Species Survival: ACTIVE
Species Extinction: ACTIVE
Evolution Governance: ACTIVE
Evolution Allocation: ACTIVE
Evolution Allocation Portfolio Sync: ACTIVE
Species Capital Allocation: ACTIVE
Species Position Sizing: ACTIVE
Species Trade Allocation: ACTIVE
Species Execution Queue: ACTIVE
Species Execution Center Sync: ACTIVE
Species Trade Approval Sync: ACTIVE
Species Broker Routing Sync: ACTIVE
Species Execution Ticket Generator: ACTIVE
Species Execution Queue Integration: ACTIVE
Species Live Execution Bridge: ACTIVE
Species Broker Execution Sync: ACTIVE

AI connection requirement:

Evolution Center must later receive signals from:

- GPT Analyst
- Claude Risk
- Consensus
- Portfolio Brain
- AI Memory
- Learning Feedback

Evolution Center must later send outputs to:

- Trade Approval
- Execution Queue
- Broker Routing
- Broker Execution Sync

---

## 4. Execution Center

Purpose:
Execution pipeline and order preparation.

Status: KEEP / CENTER

Modules:

- Execution Queue Engine
- Execution Tickets
- Trade Approval Engine
- Trade Approval Execution Queue Sync
- Paper Trading Execution Engine
- Species Execution Queue Integration
- Species Live Execution Bridge
- Species Broker Execution Sync

Classification:

Execution Queue Engine: ACTIVE
Execution API Queue: ACTIVE
Execution API Status: ACTIVE
Execution API Tickets: ACTIVE
Trade Approval Engine: ACTIVE
Trade Approval Execution Queue Sync: ACTIVE
Paper Trading Execution Engine: ACTIVE
Species Execution Queue Integration: ACTIVE
Species Live Execution Bridge: ACTIVE
Species Broker Execution Sync: ACTIVE

Target:

Execution Center should become the clear place for:

- Pending tickets
- Approved tickets
- Queue positions
- Broker dispatch readiness
- Execution confirmation status

---

## 5. Broker Center

Purpose:
Broker health, routing and execution connection.

Status: KEEP / CENTER

Modules:

- Smart Broker Selection
- Smart Broker Execution Sync
- Broker Routing Layer
- Broker Routing Capital.com Sync
- Broker Routing IC Markets Sync
- Dual Broker Orchestrator
- Broker Health Monitor
- Broker Health Dual Broker Sync
- Broker Performance Memory
- Broker Reputation Memory
- Broker Execution Quality Learning
- Autonomous Broker Optimization
- Capital.com future connector
- IC Markets connector

Classification:

Smart Broker Selection: ACTIVE
Smart Broker Execution Sync: ACTIVE
Broker Routing Layer: ACTIVE
Broker Routing Capital.com Sync: ACTIVE
Broker Routing IC Markets Sync: ACTIVE
Dual Broker Orchestrator: ACTIVE
Broker Health Monitor: ACTIVE
Broker Health Dual Broker Sync: ACTIVE
Broker Performance Memory: ACTIVE
Broker Reputation Memory: ACTIVE
Broker Execution Quality Learning: ACTIVE
Autonomous Broker Optimization: ACTIVE
IC Markets Status API: ACTIVE

Future connection:

Broker Center must connect to:

- Species Broker Execution Sync
- Execution Confirmation Engine
- Broker Performance Memory
- Broker Reputation Memory
- Broker Optimization

---

## 6. Learning Center

Purpose:
AI memory, feedback loop and strategy improvement.

Status: KEEP / CENTER

Modules:

- AI Paper Trader Learning
- AI Paper Trader Memory
- AI Paper Trader Outcomes
- AI Paper Trader Strategy
- AI Paper Trader Strategy Library
- Outcome Learning Auto Update
- Learning Feedback Integration
- Portfolio Brain Learning
- Portfolio Brain Adaptive Learning
- Portfolio Brain Outcome Learning Sync
- Trade Outcome Feedback Engine
- Strategy Evolution Intelligence
- Broker Execution Quality Learning

Classification:

AI Paper Trader Learning: ACTIVE
AI Paper Trader Memory: ACTIVE
AI Paper Trader Outcomes: ACTIVE
AI Paper Trader Strategy: ACTIVE
AI Paper Trader Strategy Library: ACTIVE
Outcome Learning Auto Update: ACTIVE
Learning Feedback Integration: ACTIVE
Portfolio Brain Learning: ACTIVE
Portfolio Brain Adaptive Learning: ACTIVE
Portfolio Brain Outcome Learning Sync: ACTIVE
Trade Outcome Feedback Engine: ACTIVE
Strategy Evolution Intelligence: ACTIVE
Broker Execution Quality Learning: ACTIVE

Future connection:

Learning Center must feed:

- GPT Analyst
- Claude Risk
- Consensus
- Portfolio Brain
- Evolution Center
- Broker Optimization

---

## 7. Market Intelligence Center

Purpose:
Market context and external signals.

Status: KEEP / CENTER

Modules:

- Market Data
- Dynamic Market Data
- Market Regime
- Market Regime Sync
- Economic Calendar
- News Intelligence
- Market Universe
- Bank Institutional Intelligence
- Institutional Intelligence
- Institutional Portfolio Brain Sync

Classification:

Market Data APIs: ACTIVE
Dynamic Market Data: ACTIVE
Market Regime: ACTIVE
Market Regime Sync: ACTIVE
Economic Calendar: ACTIVE
News Intelligence: ACTIVE
Market Universe: ACTIVE
Bank Institutional Intelligence: ACTIVE
Institutional Portfolio Brain Sync: ACTIVE

Future connection:

Market Intelligence must feed:

- GPT Analyst
- Claude Risk
- Consensus
- Portfolio Brain
- Evolution Center

---

# Merge Candidates

## Portfolio Brain Panels

Current:

- PortfolioBrainPanel
- PortfolioBrainMemoryPanel
- PortfolioBrainLearningPanel
- PortfolioBrainOutcomePanel
- PortfolioBrainStrategyDecisionPanel
- AdaptiveConfidencePanel
- DecisionMemoryPanel
- OutcomeLearningPanel
- PortfolioBrainLearningPanel
- PortfolioBrainOutcomePanel
- PortfolioIntelligencePanel
- PortfolioRiskManagementPanel

Target:

Portfolio Brain Center with tabs.

Classification:

MERGE INTO Portfolio Brain Center

---

## Opportunity Panels

Current:

- OpportunityDashboardPanel
- StrategyOpportunityPanel
- Opportunity Scanner API
- Strategy Opportunity Sync API

Target:

Opportunity Center.

Classification:

MERGE INTO Opportunity Center

---

## Execution Panels

Current:

- ExecutionQueuePanel
- PaperExecutionPanel
- PaperTradingExecutionEngine
- SpeciesExecutionQueuePanel
- SpeciesExecutionTicketPanel
- SpeciesLiveExecutionBridgePanel

Target:

Execution Center.

Classification:

MERGE INTO Execution Center

---

## Broker Panels

Current:

- BrokerRoutingDashboardPanel
- BrokerHealthDashboardPanel
- BrokerPerformanceMemoryPanel
- BrokerReputationMemoryPanel
- BrokerExecutionQualityLearningPanel
- SmartBrokerSelectionPanel
- SmartBrokerExecutionSyncPanel
- SpeciesBrokerRoutingPanel

Target:

Broker Center.

Classification:

MERGE INTO Broker Center

---

# Legacy Review Candidates

These modules are not deleted now.
They need verification before archive.

- Dynamic Position Allocation
- Trading Style Priority Engine
- Trading Style Priority Trade Approval Sync
- Trading Style Priority Unified Decision Sync
- Unified Decision Trade Approval Sync
- Multi Timeframe Trading Style Analysis
- Multi Timeframe Trade Approval Sync
- Multi Timeframe Unified Decision Sync
- Strategy Weight Auto Rebalancing
- Strategy Weight Portfolio Brain Sync

Reason:

The newer Species / Evolution pipeline may replace or absorb parts of these systems.

Classification:

LEGACY REVIEW

Action:

Do not delete.
Move out of main dashboard.
Keep API available until dependency check is complete.

---

# Archive Candidates

Nothing should be deleted in V15.A.2.

Potential future archive candidates after dependency check:

- Duplicate dashboard panels
- Old one-off visual panels
- Panels replaced by Center views
- Panels that only show mock data and are no longer connected

Classification:

ARCHIVE LATER

---

# Dashboard Cleanup Rule

AIAgentControlCenter should no longer show every panel.

It should become a clean navigation hub with sections:

1. AI Center
2. Evolution Center
3. Execution Center
4. Broker Center
5. Learning Center
6. Market Intelligence Center
7. Portfolio Brain Center
8. Legacy Review

---

# Chart Upgrade Plan

After cleanup, add professional visualizations:

## Evolution Center

- Species allocation donut chart
- Capital allocation stacked chart
- Species survival/extinction trend chart
- Evolution pipeline flow chart

## Execution Center

- Queue status bar chart
- Execution windows chart
- Broker distribution donut chart
- Live bridge health chart

## Broker Center

- Broker confidence radar
- Broker latency chart
- Broker health cards
- Capital.com vs IC Markets comparison chart

## Learning Center

- Winrate trend
- Confidence learning curve
- Strategy evolution score
- Outcome feedback chart

## Portfolio Brain Center

- Portfolio allocation chart
- Risk exposure chart
- AI consensus radar
- Portfolio decision timeline

---

# Immediate Next Refactor Plan

## V15.A.3 Center Shell Refactor

Create clean center shell components:

- AICenterPanel
- EvolutionCenterPanel
- ExecutionCenterPanel
- BrokerCenterPanel
- LearningCenterPanel
- MarketIntelligenceCenterPanel
- PortfolioBrainCenterPanel
- LegacyReviewPanel

AIAgentControlCenter will show only these center cards instead of all detailed engines.

Detailed engine panels remain available but move into their correct center.

---

# Safety Rule

Do not delete old APIs.
Do not delete old engines.
Do not remove existing functionality.

First refactor only the visual dashboard structure.

---

# Long-Term Architecture

The final AI Trading System should become:

Market Intelligence
↓
GPT / OpenAI Analysis
↓
Claude Risk Analysis
↓
Consensus Engine
↓
Portfolio Brain
↓
Evolution Species Engine
↓
Execution Queue
↓
Broker Routing
↓
Capital.com / IC Markets
↓
Execution Confirmation
↓
Outcome Learning
↓
AI Memory
↓
Strategy Evolution

This is the main direction.
