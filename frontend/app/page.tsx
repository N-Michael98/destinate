"use client";

import React, { useEffect, useState } from "react";
import PaperTradingDashboardPanel from "@/components/PaperTradingDashboardPanel";
import PaperTradingCenter from "@/components/PaperTradingCenter";
import AIAgentControlCenter from "@/components/AIAgentControlCenter";
import UnifiedMissionControlDashboard from "@/components/UnifiedMissionControlDashboard";
import { SidebarIcon } from "@/components/SidebarIcon";
import EvolutionCenterPanel from "@/components/EvolutionCenterPanel";
import BrokerCenterPanel from "@/components/BrokerCenterPanel";
import PortfolioBrainCenterPanel from "@/components/PortfolioBrainCenterPanel";
import ExecutionCenterPanel from "@/components/ExecutionCenterPanel";
import ForwardTestingCenter from "@/components/ForwardTestingCenter";
import SecurityCenterDashboard from "@/components/SecurityCenterDashboard";

type NavItem = {
  label: string;
  icon: string;
  view: string;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

type ICMarketsApiData = {
  success: boolean;
  broker: string;
  status: {
    broker: string;
    status: string;
    config: {
      enabled: boolean;
      mode: string;
      readOnly: boolean;
      allowLiveOrders: boolean;
    };
  };
  account: {
    broker: string;
    mode: string;
    balance: number;
    equity: number;
    margin: number;
    freeMargin: number;
    currency: string;
    status: string;
    updatedAt: string;
  };
  health: {
    broker: string;
    mode: string;
    currency: string;
    balance: number;
    equity: number;
    freeMargin: number;
    status: string;
    healthy: boolean;
    updatedAt: string;
  };
  exposure: {
    openPositions: number;
    totalFloatingPnL: number;
    totalVolume: number;
    positions: unknown[];
    updatedAt: string;
  };
  liveTradingEnabled: boolean;
  message: string;
};


const navGroups: NavGroup[] = [
  {
    title: "Dashboard",
    items: [
      { label: "Mission Control", icon: "MC", view: "dashboard" },
    ],
  },
  {
    title: "Trading",
    items: [
      { label: "Trading Journal", icon: "TJ", view: "trading-journal" },
      { label: "Paper Trading", icon: "PT", view: "paper-trading" },
      { label: "Trading Desk", icon: "TD", view: "trading-desk" },
      { label: "Signal Engine", icon: "SE", view: "signal-engine" },
      { label: "Strategy Builder", icon: "SB", view: "strategy-builder" },
    ],
  },
  {
    title: "AI Center",
    items: [
      { label: "GPT Analyst", icon: "GPT", view: "gpt-analyst" },
      { label: "AI Agent", icon: "AI", view: "ai-agent" },
      { label: "Claude Risk", icon: "CR", view: "claude-risk" },
      { label: "Consensus", icon: "CON", view: "ai-consensus" },
      { label: "Portfolio Brain", icon: "PB", view: "portfolio-brain" },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { label: "Market Data", icon: "MD", view: "market-data" },
      { label: "News Layer", icon: "NL", view: "news-layer" },
      { label: "Market Regime", icon: "MR", view: "market-regime" },
      { label: "Portfolio Intelligence", icon: "PI", view: "portfolio-intelligence" },
    ],
  },
  {
    title: "Execution",
    items: [
      { label: "Execution Center", icon: "EX", view: "execution-center" },
      { label: "Broker Center", icon: "BR", view: "broker-center" },
      { label: "Live Prep", icon: "LP", view: "live-prep" },
    ],
  },
  {
    title: "Learning",
    items: [
      { label: "Forward Testing", icon: "FT", view: "forward-testing" },
      { label: "AI Memory", icon: "MEM", view: "ai-memory" },
      { label: "Strategy Evolution", icon: "EVO", view: "strategy-evolution" },
      { label: "Learning Reports", icon: "LR", view: "learning-reports" },
      { label: "Scheduler", icon: "SCH", view: "scheduler" },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Security Center", icon: "SEC", view: "security" },
      { label: "Settings", icon: "SET", view: "settings" },
    ],
  },
];

function StatCard({
  title,
  value,
  subtitle,
  accent = "text-blue-400",
  border = "border-blue-900",
}: {
  title: string;
  value: string;
  subtitle: string;
  accent?: string;
  border?: string;
}) {
  return (
    <div className={`bg-gray-950 ${border} border rounded-2xl p-6 min-h-[150px]`}>
      <h3 className="font-bold text-lg text-white">{title}</h3>
      <p className={`text-4xl mt-5 font-semibold ${accent}`}>{value}</p>
      <p className="text-gray-400 mt-3">{subtitle}</p>
    </div>
  );
}

function StatusPill({
  label,
  value,
  accent = "text-green-400",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="bg-black border border-gray-800 rounded-xl p-4 flex items-center justify-between">
      <span className="text-gray-300">{label}</span>
      <span className={`font-bold ${accent}`}>{value}</span>
    </div>
  );
}

function ModuleCard({
  title,
  description,
  score,
  status,
  accent = "text-blue-400",
  href,
}: {
  title: string;
  description: string;
  score: string;
  status: string;
  accent?: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="block bg-gray-950 border border-gray-800 hover:border-blue-700 transition rounded-2xl p-6"
    >
      <div className="flex justify-between gap-4">
        <h3 className="text-xl font-bold text-white">{title}</h3>
        <span className={`font-bold ${accent}`}>{status}</span>
      </div>
      <p className="text-gray-400 mt-3 leading-relaxed">{description}</p>
      <p className={`text-3xl mt-5 font-bold ${accent}`}>{score}</p>
    </a>
  );
}


function CenterPlaceholder({
  title,
  subtitle,
  cards,
}: {
  title: string;
  subtitle: string;
  cards: { title: string; value: string; note: string; accent?: string; border?: string }[];
}) {
  return (
    <section className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h2 className="text-4xl font-black">{title}</h2>
          <p className="text-gray-400 text-xl mt-3">{subtitle}</p>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-5 min-w-[180px]">
          <p className="text-gray-400">Center Status</p>
          <p className="text-green-400 text-2xl font-bold">Prepared</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {cards.map((card) => (
          <StatCard
            key={card.title}
            title={card.title}
            value={card.value}
            subtitle={card.note}
            accent={card.accent ?? "text-blue-400"}
            border={card.border ?? "border-blue-900"}
          />
        ))}
      </div>

      <div className="bg-black border border-gray-800 rounded-2xl p-6 mt-8">
        <h3 className="text-2xl font-bold"> Module Page Prepared</h3>
        <p className="text-gray-400 mt-3 leading-relaxed">
          Dieser Bereich ist jetzt sauber vom Hauptdashboard getrennt. Als nchster Schritt bauen wir fr dieses Center eine eigene professionelle Detailseite oder Komponente.
        </p>
      </div>
    </section>
  );
}


function GPTAnalystCenter() {
  return (
    <section className="bg-gray-900 border border-cyan-900 rounded-2xl p-8">
      
      <BrokerCenterPanel />
<div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h2 className="text-4xl font-black"> GPT Analyst Center</h2>
          <p className="text-gray-400 text-xl mt-3">
            OpenAI/GPT wird hier spter Marktchancen, Setups, Strategien und Learning Reports analysieren.
          </p>
        </div>
        <div className="bg-black border border-cyan-800 rounded-2xl p-5 min-w-[190px]">
          <p className="text-gray-400">GPT Status</p>
          <p className="text-cyan-400 text-2xl font-bold">Prepared</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6 mb-8">
        <StatCard title="Market Analyst" value="Ready" subtitle="Opportunity analysis" accent="text-cyan-400" border="border-cyan-900" />
        <StatCard title="Strategy Review" value="Ready" subtitle="Setup quality" accent="text-purple-400" border="border-purple-900" />
        <StatCard title="Learning Review" value="Ready" subtitle="Daily/weekly reports" accent="text-green-400" border="border-green-900" />
        <StatCard title="Decision Output" value="WAIT" subtitle="No live execution" accent="text-yellow-400" border="border-yellow-900" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Market Context</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Market Data" value="Prepared" accent="text-cyan-400" />
            <StatusPill label="News Intelligence" value="Prepared" accent="text-blue-400" />
            <StatusPill label="Market Regime" value="Prepared" accent="text-lime-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> GPT Output Preview</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Signal" value="WAIT" accent="text-yellow-400" />
            <StatusPill label="Confidence" value="70%" accent="text-cyan-400" />
            <StatusPill label="Reasoning" value="Structured" accent="text-purple-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Safety</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="API Key" value=".env only" accent="text-green-400" />
            <StatusPill label="Calls" value="Server only" accent="text-green-400" />
            <StatusPill label="Trade Permission" value="No" accent="text-red-400" />
          </div>
        </div>
      </div>
    </section>
  );
}

function ClaudeRiskCenter() {
  return (
    <section className="bg-gray-900 border border-red-900 rounded-2xl p-8">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h2 className="text-4xl font-black"> Claude Risk Center</h2>
          <p className="text-gray-400 text-xl mt-3">
            Claude wird hier Risiko, Drawdown, Portfolio-Exposure, Volatilitt und Makro-Risiken kontrollieren.
          </p>
        </div>
        <div className="bg-black border border-red-800 rounded-2xl p-5 min-w-[190px]">
          <p className="text-gray-400">Claude Status</p>
          <p className="text-red-400 text-2xl font-bold">Prepared</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6 mb-8">
        <StatCard title="Risk Review" value="Ready" subtitle="Trade risk check" accent="text-red-400" border="border-red-900" />
        <StatCard title="Portfolio Review" value="Ready" subtitle="Exposure analysis" accent="text-purple-400" border="border-purple-900" />
        <StatCard title="Drawdown Review" value="Ready" subtitle="Loss control" accent="text-yellow-400" border="border-yellow-900" />
        <StatCard title="Risk Decision" value="REVIEW" subtitle="Claude can block" accent="text-orange-400" border="border-orange-900" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Risk Checks</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Volatility Risk" value="Medium" accent="text-yellow-400" />
            <StatusPill label="Macro Risk" value="Watched" accent="text-orange-400" />
            <StatusPill label="News Risk" value="Prepared" accent="text-blue-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Drawdown</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Current DD" value="0.73%" accent="text-green-400" />
            <StatusPill label="Max DD Limit" value="5%" accent="text-yellow-400" />
            <StatusPill label="Status" value="Safe" accent="text-green-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Permission</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Can Approve" value="Yes" accent="text-green-400" />
            <StatusPill label="Can Review" value="Yes" accent="text-yellow-400" />
            <StatusPill label="Can Block" value="Yes" accent="text-red-400" />
          </div>
        </div>
      </div>
    </section>
  );
}

function MarketDataCenter() {
  return (
    <section className="bg-gray-900 border border-blue-900 rounded-2xl p-8">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h2 className="text-4xl font-black"> Market Data Center</h2>
          <p className="text-gray-400 text-xl mt-3">
            Zentrale Daten-Schicht fr Watchlist, Preise, News, Regime, Fundamentals und sptere TradingView/Yahoo/Capital.com Feeds.
          </p>
        </div>
        <div className="bg-black border border-blue-800 rounded-2xl p-5 min-w-[190px]">
          <p className="text-gray-400">Data Status</p>
          <p className="text-blue-400 text-2xl font-bold">Prepared</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6 mb-8">
        <StatCard title="NAS100" value="Watch" subtitle="Momentum market" accent="text-blue-400" border="border-blue-900" />
        <StatCard title="XAUUSD" value="Watch" subtitle="Gold / risk sentiment" accent="text-yellow-400" border="border-yellow-900" />
        <StatCard title="USOIL" value="Watch" subtitle="Inventory / macro" accent="text-orange-400" border="border-orange-900" />
        <StatCard title="EURUSD" value="Watch" subtitle="Forex / USD risk" accent="text-green-400" border="border-green-900" />
        <StatCard title="BTCUSD" value="Low" subtitle="Crypto risk appetite" accent="text-purple-400" border="border-purple-900" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Data Providers</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Capital.com" value="Prepared" accent="text-cyan-400" />
            <StatusPill label="IC Markets" value="Prepared" accent="text-blue-400" />
            <StatusPill label="TradingView" value="Later" accent="text-yellow-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Intelligence Feeds</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="News Layer" value="Prepared" accent="text-blue-400" />
            <StatusPill label="Economic Calendar" value="Later" accent="text-yellow-400" />
            <StatusPill label="Yahoo Finance" value="Later" accent="text-purple-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Regime Input</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Trend / Range" value="Prepared" accent="text-lime-400" />
            <StatusPill label="Volatility" value="Prepared" accent="text-orange-400" />
            <StatusPill label="Risk-On/Off" value="Prepared" accent="text-red-400" />
          </div>
        </div>
      </div>
    </section>
  );
}

function PortfolioBrainCenter() {
  return (
    <section className="bg-gray-900 border border-fuchsia-900 rounded-2xl p-8">
      
      <PortfolioBrainCenterPanel />
<div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h2 className="text-4xl font-black"> Portfolio Brain Center</h2>
          <p className="text-gray-400 text-xl mt-3">
            Das zentrale Gehirn: Market Data, GPT, Claude, Agent, Regime, Portfolio Intelligence und Consensus werden hier zusammengefhrt.
          </p>
        </div>
        <div className="bg-black border border-fuchsia-800 rounded-2xl p-5 min-w-[190px]">
          <p className="text-gray-400">Brain Status</p>
          <p className="text-fuchsia-400 text-2xl font-bold">Prepared</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6 mb-8">
        <StatCard title="Inputs" value="Ready" subtitle="All core engines" accent="text-blue-400" border="border-blue-900" />
        <StatCard title="Consensus" value="Required" subtitle="No single AI decision" accent="text-emerald-400" border="border-emerald-900" />
        <StatCard title="Portfolio" value="Checked" subtitle="Exposure filter" accent="text-cyan-400" border="border-cyan-900" />
        <StatCard title="Output" value="Demo" subtitle="Paper only" accent="text-yellow-400" border="border-yellow-900" />
        <StatCard title="Live" value="Blocked" subtitle="Safety first" accent="text-red-400" border="border-red-900" />
      </div>

      <div className="bg-black border border-gray-800 rounded-2xl p-6">
        <h3 className="text-2xl font-bold"> Brain Flow</h3>
        <div className="grid grid-cols-5 gap-4 mt-5">
          {[
            "Market Data",
            "GPT Analyst",
            "Claude Risk",
            "Agent Review",
            "Consensus",
            "Regime",
            "Portfolio",
            "Demo Plan",
            "Performance",
            "Learning",
          ].map((step) => (
            <div key={step} className="bg-gray-950 border border-gray-800 rounded-xl p-4">
              <p className="font-bold">{step}</p>
              <p className="text-green-400 mt-2">Prepared</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


function TradingJournalCenter() {
  return (
    <section className="bg-gray-900 border border-green-900 rounded-2xl p-8">
      
      <ExecutionCenterPanel />
<div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h2 className="text-4xl font-black"> Trading Journal Center</h2>
          <p className="text-gray-400 text-xl mt-3">
            Zentrale bersicht fr Trades, Journal-Qualitt, Equity, Performance und sptere AI-Auswertung.
          </p>
        </div>
        <div className="bg-black border border-green-800 rounded-2xl p-5 min-w-[190px]">
          <p className="text-gray-400">Journal Status</p>
          <p className="text-green-400 text-2xl font-bold">Active</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6 mb-8">
        <StatCard title="Total Trades" value="3" subtitle="Paper sample" accent="text-blue-400" border="border-blue-900" />
        <StatCard title="Winrate" value="67%" subtitle="Mock performance" accent="text-green-400" border="border-green-900" />
        <StatCard title="Profit Factor" value="2.15" subtitle="Performance sample" accent="text-purple-400" border="border-purple-900" />
        <StatCard title="Max DD" value="0.73%" subtitle="Risk tracking" accent="text-yellow-400" border="border-yellow-900" />
        <StatCard title="Journal Score" value="A-" subtitle="Discipline rating" accent="text-cyan-400" border="border-cyan-900" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Latest Trades</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="NAS100 Long" value="+4.2R" accent="text-green-400" />
            <StatusPill label="XAUUSD Long" value="+1.8R" accent="text-green-400" />
            <StatusPill label="USOIL Short" value="-1.0R" accent="text-red-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Journal Analytics</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Best Strategy" value="Momentum" accent="text-green-400" />
            <StatusPill label="Weak Setup" value="Inventory" accent="text-yellow-400" />
            <StatusPill label="Review Status" value="Prepared" accent="text-blue-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> AI Journal Link</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Performance Tracker" value="Connected" accent="text-green-400" />
            <StatusPill label="Feedback Engine" value="Connected" accent="text-green-400" />
            <StatusPill label="Learning Reports" value="Ready" accent="text-cyan-400" />
          </div>
        </div>
      </div>
    </section>
  );
}

function TradingDeskCenter() {
  return (
    <section className="bg-gray-900 border border-blue-900 rounded-2xl p-8">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h2 className="text-4xl font-black"> Trading Desk Center</h2>
          <p className="text-gray-400 text-xl mt-3">
            Professioneller Desk fr Watchlist, Top Opportunity, Trade Setup, Risk/Reward und Demo-Trade-Planung.
          </p>
        </div>
        <div className="bg-black border border-blue-800 rounded-2xl p-5 min-w-[190px]">
          <p className="text-gray-400">Desk Status</p>
          <p className="text-blue-400 text-2xl font-bold">Prepared</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6 mb-8">
        <StatCard title="Top Market" value="Gold" subtitle="Risk sentiment" accent="text-yellow-400" border="border-yellow-900" />
        <StatCard title="Bias" value="SELL" subtitle="Demo signal" accent="text-red-400" border="border-red-900" />
        <StatCard title="Confidence" value="91%" subtitle="AI score" accent="text-cyan-400" border="border-cyan-900" />
        <StatCard title="R/R" value="1:2.8" subtitle="Risk reward" accent="text-green-400" border="border-green-900" />
        <StatCard title="Execution" value="Paper" subtitle="Live blocked" accent="text-purple-400" border="border-purple-900" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Setup Preview</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Market" value="XAUUSD" accent="text-yellow-400" />
            <StatusPill label="Direction" value="SELL" accent="text-red-400" />
            <StatusPill label="Strategy" value="Risk-Off Reaction" accent="text-blue-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Risk Plan</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Risk per Trade" value="1%" accent="text-green-400" />
            <StatusPill label="Stop Loss" value="Defined" accent="text-yellow-400" />
            <StatusPill label="Take Profit" value="Defined" accent="text-cyan-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> AI Gate</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="GPT" value="WAIT" accent="text-yellow-400" />
            <StatusPill label="Claude" value="REVIEW" accent="text-orange-400" />
            <StatusPill label="Consensus" value="Required" accent="text-purple-400" />
          </div>
        </div>
      </div>
    </section>
  );
}

function SignalEngineCenter() {
  return (
    <section className="bg-gray-900 border border-purple-900 rounded-2xl p-8">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h2 className="text-4xl font-black"> Signal Engine Center</h2>
          <p className="text-gray-400 text-xl mt-3">
            Signalzentrale fr technische, fundamentale, sentiment- und AI-basierte Signale.
          </p>
        </div>
        <div className="bg-black border border-purple-800 rounded-2xl p-5 min-w-[190px]">
          <p className="text-gray-400">Signal Status</p>
          <p className="text-purple-400 text-2xl font-bold">Prepared</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6 mb-8">
        <StatCard title="Technical" value="Ready" subtitle="TA signals" accent="text-blue-400" border="border-blue-900" />
        <StatCard title="Fundamental" value="Ready" subtitle="Macro signals" accent="text-yellow-400" border="border-yellow-900" />
        <StatCard title="Sentiment" value="Ready" subtitle="News mood" accent="text-green-400" border="border-green-900" />
        <StatCard title="AI Signal" value="WAIT" subtitle="GPT/Claude later" accent="text-purple-400" border="border-purple-900" />
        <StatCard title="Final Gate" value="Consensus" subtitle="No single signal" accent="text-red-400" border="border-red-900" />
      </div>

      <div className="grid grid-cols-4 gap-6">
        <div className="bg-black border border-blue-900 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Technical</h3>
          <p className="text-gray-400 mt-4">Trend, breakout, momentum, structure.</p>
        </div>
        <div className="bg-black border border-yellow-900 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Macro</h3>
          <p className="text-gray-400 mt-4">Economic calendar, rates, inflation, jobs.</p>
        </div>
        <div className="bg-black border border-green-900 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> News</h3>
          <p className="text-gray-400 mt-4">Market-moving headlines and sentiment.</p>
        </div>
        <div className="bg-black border border-purple-900 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> AI</h3>
          <p className="text-gray-400 mt-4">GPT opportunity + Claude risk validation.</p>
        </div>
      </div>
    </section>
  );
}

function StrategyBuilderCenter() {
  return (
    <section className="bg-gray-900 border border-orange-900 rounded-2xl p-8">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h2 className="text-4xl font-black"> Strategy Builder Center</h2>
          <p className="text-gray-400 text-xl mt-3">
            Builder fr Strategien, Regeln, Risk-Filter, Regime-Fit und sptere AI-Optimierung.
          </p>
        </div>
        <div className="bg-black border border-orange-800 rounded-2xl p-5 min-w-[190px]">
          <p className="text-gray-400">Builder Status</p>
          <p className="text-orange-400 text-2xl font-bold">Prepared</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6 mb-8">
        <StatCard title="Strategies" value="4" subtitle="Mock library" accent="text-orange-400" border="border-orange-900" />
        <StatCard title="Best Setup" value="Momentum" subtitle="Current leader" accent="text-green-400" border="border-green-900" />
        <StatCard title="Weak Setup" value="Inventory" subtitle="Needs review" accent="text-red-400" border="border-red-900" />
        <StatCard title="Regime Fit" value="Ready" subtitle="V8.8 connected" accent="text-lime-400" border="border-lime-900" />
        <StatCard title="Evolution" value="Ready" subtitle="V7.9 connected" accent="text-purple-400" border="border-purple-900" />
      </div>

      <div className="grid grid-cols-4 gap-6">
        {[
          ["Momentum Breakout", "Trending markets", "Strong"],
          ["Risk-Off Trend", "Gold / safe haven", "Stable"],
          ["Inventory Reaction", "Oil events", "Review"],
          ["Macro Momentum", "Forex + USD", "Prepared"],
        ].map(([name, note, status]) => (
          <div key={name} className="bg-black border border-gray-800 rounded-2xl p-6">
            <h3 className="text-2xl font-bold">{name}</h3>
            <p className="text-gray-400 mt-4">{note}</p>
            <p className="text-cyan-400 mt-5 font-bold">{status}</p>
          </div>
        ))}
      </div>
    </section>
  );
}



function ConsensusCenter() {
  return (
    <section className="bg-gray-900 border border-emerald-900 rounded-2xl p-8">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h2 className="text-4xl font-black"> Consensus Intelligence Center</h2>
          <p className="text-gray-400 text-xl mt-3">
            Zentrale Entscheidungsprfung: GPT, Claude und AI Agent werden gemeinsam validiert, bevor ein Demo-Plan freigegeben wird.
          </p>
        </div>
        <div className="bg-black border border-emerald-800 rounded-2xl p-5 min-w-[190px]">
          <p className="text-gray-400">Consensus Status</p>
          <p className="text-emerald-400 text-2xl font-bold">Active</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6 mb-8">
        <StatCard title="GPT Signal" value="WAIT" subtitle="Opportunity check" accent="text-cyan-400" border="border-cyan-900" />
        <StatCard title="Claude Risk" value="REVIEW" subtitle="Risk validation" accent="text-red-400" border="border-red-900" />
        <StatCard title="Agent Review" value="WAIT" subtitle="Execution logic" accent="text-indigo-400" border="border-indigo-900" />
        <StatCard title="Agreement" value="82%" subtitle="Consensus score" accent="text-purple-400" border="border-purple-900" />
        <StatCard title="Decision" value="REVIEW" subtitle="No auto execution" accent="text-yellow-400" border="border-yellow-900" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Approved Scenario</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="GPT" value="LONG" accent="text-green-400" />
            <StatusPill label="Claude" value="LONG" accent="text-green-400" />
            <StatusPill label="Agent" value="LONG" accent="text-green-400" />
            <StatusPill label="Final" value="APPROVED" accent="text-emerald-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Conflict Scenario</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="GPT" value="LONG" accent="text-green-400" />
            <StatusPill label="Claude" value="BLOCK" accent="text-red-400" />
            <StatusPill label="Agent" value="WAIT" accent="text-yellow-400" />
            <StatusPill label="Final" value="BLOCKED" accent="text-red-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Safety Gate</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Single AI Decision" value="Blocked" accent="text-red-400" />
            <StatusPill label="Conflict Detection" value="Active" accent="text-green-400" />
            <StatusPill label="Live Execution" value="Locked" accent="text-red-400" />
          </div>
        </div>
      </div>
    </section>
  );
}

function ExecutionCenter() {
  return (
    <section className="bg-gray-900 border border-yellow-900 rounded-2xl p-8">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h2 className="text-4xl font-black"> Execution Center</h2>
          <p className="text-gray-400 text-xl mt-3">
            Verbindet Demo Agent, Demo Execution, Paper Orders, Performance Tracker, Feedback Engine und Adaptive Confidence.
          </p>
        </div>
        <div className="bg-black border border-yellow-800 rounded-2xl p-5 min-w-[190px]">
          <p className="text-gray-400">Execution Status</p>
          <p className="text-yellow-400 text-2xl font-bold">Paper Only</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6 mb-8">
        <StatCard title="Demo Agent" value="Ready" subtitle="Planning only" accent="text-indigo-400" border="border-indigo-900" />
        <StatCard title="Demo Orders" value="3" subtitle="Mock tickets" accent="text-blue-400" border="border-blue-900" />
        <StatCard title="Open Exec." value="0" subtitle="No active positions" accent="text-green-400" border="border-green-900" />
        <StatCard title="Performance" value="Ready" subtitle="Tracker connected" accent="text-teal-400" border="border-teal-900" />
        <StatCard title="Live Firewall" value="ON" subtitle="Broker blocked" accent="text-red-400" border="border-red-900" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Demo Order Flow</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Agent Plan" value="Prepared" accent="text-indigo-400" />
            <StatusPill label="Order Generator" value="Prepared" accent="text-blue-400" />
            <StatusPill label="Paper Engine" value="Connected" accent="text-green-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Performance Loop</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Winrate" value="67%" accent="text-green-400" />
            <StatusPill label="Profit Factor" value="2.15" accent="text-purple-400" />
            <StatusPill label="Drawdown" value="0.73%" accent="text-yellow-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Execution Safety</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Paper Mode" value="Enabled" accent="text-green-400" />
            <StatusPill label="Broker Orders" value="Blocked" accent="text-red-400" />
            <StatusPill label="Manual Approval" value="Required later" accent="text-yellow-400" />
          </div>
        </div>
      </div>
    </section>
  );
}

function LearningCenter() {
  return (
    <section className="bg-gray-900 border border-green-900 rounded-2xl p-8">
      
      <ExecutionCenterPanel />
<div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h2 className="text-4xl font-black"> Learning Center</h2>
          <p className="text-gray-400 text-xl mt-3">
            Der Lernkreislauf: Forward Testing, AI Memory, Strategy Evolution, Feedback, Reports und Scheduler arbeiten zusammen.
          </p>
        </div>
        <div className="bg-black border border-green-800 rounded-2xl p-5 min-w-[190px]">
          <p className="text-gray-400">Learning Status</p>
          <p className="text-green-400 text-2xl font-bold">Loop Ready</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6 mb-8">
        <StatCard title="Forward Tests" value="Ready" subtitle="Planning engine" accent="text-blue-400" border="border-blue-900" />
        <StatCard title="AI Memory" value="Ready" subtitle="Store lessons" accent="text-cyan-400" border="border-cyan-900" />
        <StatCard title="Evolution" value="Ready" subtitle="Strategy ranking" accent="text-lime-400" border="border-lime-900" />
        <StatCard title="Reports" value="Ready" subtitle="Multi-AI review" accent="text-purple-400" border="border-purple-900" />
        <StatCard title="Scheduler" value="Ready" subtitle="Daily/weekly/monthly" accent="text-yellow-400" border="border-yellow-900" />
      </div>

      <div className="bg-black border border-gray-800 rounded-2xl p-6 mb-6">
        <h3 className="text-2xl font-bold"> Learning Pipeline</h3>
        <div className="grid grid-cols-5 gap-4 mt-5">
          {[
            "Demo Trade",
            "Performance",
            "Feedback",
            "Confidence",
            "Memory",
            "Evolution",
            "GPT Review",
            "Claude Review",
            "Consensus",
            "Next Plan",
          ].map((step) => (
            <div key={step} className="bg-gray-950 border border-gray-800 rounded-xl p-4">
              <p className="font-bold">{step}</p>
              <p className="text-green-400 mt-2">Prepared</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Strategy Learning</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Best" value="Momentum" accent="text-green-400" />
            <StatusPill label="Stable" value="Risk-Off" accent="text-blue-400" />
            <StatusPill label="Review" value="Inventory" accent="text-yellow-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Reports</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Daily" value="Prepared" accent="text-green-400" />
            <StatusPill label="Weekly" value="Prepared" accent="text-blue-400" />
            <StatusPill label="Monthly" value="Prepared" accent="text-purple-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Scheduler</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Daily Cycle" value="Ready" accent="text-green-400" />
            <StatusPill label="Weekly Cycle" value="Ready" accent="text-blue-400" />
            <StatusPill label="Monthly Cycle" value="Ready" accent="text-purple-400" />
          </div>
        </div>
      </div>
    </section>
  );
}



function NewsLayerCenter() {
  return (
    <section className="bg-gray-900 border border-sky-900 rounded-2xl p-8">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h2 className="text-4xl font-black"> News Layer Center</h2>
          <p className="text-gray-400 text-xl mt-3">
            Zentrale News- und Sentiment-Schicht fr Macro Events, Breaking News, Market Impact und sptere AI-Zusammenfassungen.
          </p>
        </div>
        <div className="bg-black border border-sky-800 rounded-2xl p-5 min-w-[190px]">
          <p className="text-gray-400">News Status</p>
          <p className="text-sky-400 text-2xl font-bold">Prepared</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6 mb-8">
        <StatCard title="Breaking News" value="Watch" subtitle="Market moving events" accent="text-red-400" border="border-red-900" />
        <StatCard title="Sentiment" value="Ready" subtitle="News mood layer" accent="text-sky-400" border="border-sky-900" />
        <StatCard title="Macro Events" value="Later" subtitle="Calendar API later" accent="text-yellow-400" border="border-yellow-900" />
        <StatCard title="Impact Score" value="Prepared" subtitle="Low/medium/high" accent="text-purple-400" border="border-purple-900" />
        <StatCard title="AI Summary" value="Ready" subtitle="GPT/Claude later" accent="text-green-400" border="border-green-900" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Source Pipeline</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Yahoo Finance" value="Later" accent="text-purple-400" />
            <StatusPill label="Capital.com News" value="Later" accent="text-blue-400" />
            <StatusPill label="Economic Calendar" value="Later" accent="text-yellow-400" />
            <StatusPill label="Professional Feeds" value="Planned" accent="text-sky-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Market Impact</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="CPI / Inflation" value="High" accent="text-red-400" />
            <StatusPill label="FOMC / Rates" value="High" accent="text-red-400" />
            <StatusPill label="NFP / Jobs" value="Watched" accent="text-yellow-400" />
            <StatusPill label="Oil Inventories" value="USOIL" accent="text-orange-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> AI News Review</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="GPT Summary" value="Prepared" accent="text-green-400" />
            <StatusPill label="Claude Risk Impact" value="Prepared" accent="text-red-400" />
            <StatusPill label="Consensus Filter" value="Required" accent="text-purple-400" />
          </div>
        </div>
      </div>
    </section>
  );
}

function MarketRegimeCenter() {
  return (
    <section className="bg-gray-900 border border-lime-900 rounded-2xl p-8">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h2 className="text-4xl font-black"> Market Regime Center</h2>
          <p className="text-gray-400 text-xl mt-3">
            Erkennt Marktumfeld und filtert Strategien: trending, ranging, volatile, risk-on, risk-off oder news-driven.
          </p>
        </div>
        <div className="bg-black border border-lime-800 rounded-2xl p-5 min-w-[190px]">
          <p className="text-gray-400">Regime Status</p>
          <p className="text-lime-400 text-2xl font-bold">Prepared</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6 mb-8">
        <StatCard title="NAS100" value="Trending" subtitle="Momentum favored" accent="text-green-400" border="border-green-900" />
        <StatCard title="EURUSD" value="Ranging" subtitle="Mean reversion later" accent="text-yellow-400" border="border-yellow-900" />
        <StatCard title="XAUUSD" value="Risk-Off" subtitle="Safe-haven logic" accent="text-blue-400" border="border-blue-900" />
        <StatCard title="USOIL" value="News" subtitle="Inventory driven" accent="text-orange-400" border="border-orange-900" />
        <StatCard title="BTCUSD" value="Volatile" subtitle="Risk appetite" accent="text-red-400" border="border-red-900" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Trend Logic</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Trending" value="Momentum" accent="text-green-400" />
            <StatusPill label="Ranging" value="Mean Rev." accent="text-yellow-400" />
            <StatusPill label="Compression" value="Breakout Later" accent="text-cyan-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Risk Regime</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Risk-On" value="Growth Assets" accent="text-green-400" />
            <StatusPill label="Risk-Off" value="Gold / USD" accent="text-blue-400" />
            <StatusPill label="News-Driven" value="Review" accent="text-red-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Strategy Filter</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Regime Fit" value="Required" accent="text-lime-400" />
            <StatusPill label="Wrong Regime" value="Reduce" accent="text-yellow-400" />
            <StatusPill label="High News Risk" value="Block/Review" accent="text-red-400" />
          </div>
        </div>
      </div>
    </section>
  );
}

function PortfolioIntelligenceCenter() {
  return (
    <section className="bg-gray-900 border border-blue-900 rounded-2xl p-8">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h2 className="text-4xl font-black"> Portfolio Intelligence Center</h2>
          <p className="text-gray-400 text-xl mt-3">
            Prft Exposure, Korrelationen, Diversifikation, Allocation und Portfolio-Risiko vor jedem neuen Demo-Trade.
          </p>
        </div>
        <div className="bg-black border border-blue-800 rounded-2xl p-5 min-w-[190px]">
          <p className="text-gray-400">Portfolio Status</p>
          <p className="text-blue-400 text-2xl font-bold">Prepared</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6 mb-8">
        <StatCard title="Exposure" value="Medium" subtitle="Portfolio risk" accent="text-yellow-400" border="border-yellow-900" />
        <StatCard title="Correlation" value="Watched" subtitle="Overlap filter" accent="text-orange-400" border="border-orange-900" />
        <StatCard title="Allocation" value="AI Suggested" subtitle="Demo weighting" accent="text-purple-400" border="border-purple-900" />
        <StatCard title="Diversification" value="74/100" subtitle="Mock score" accent="text-blue-400" border="border-blue-900" />
        <StatCard title="Live Risk" value="Blocked" subtitle="Paper only" accent="text-red-400" border="border-red-900" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Exposure Preview</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Indexes" value="30%" accent="text-blue-400" />
            <StatusPill label="Commodities" value="40%" accent="text-yellow-400" />
            <StatusPill label="Forex" value="20%" accent="text-green-400" />
            <StatusPill label="Reserve" value="10%" accent="text-purple-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Correlation Risk</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="NAS100 / SPX" value="High" accent="text-red-400" />
            <StatusPill label="EURUSD / GBPUSD" value="Medium" accent="text-yellow-400" />
            <StatusPill label="Gold / Oil" value="Low" accent="text-green-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Allocation Plan</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="NAS100" value="30%" accent="text-blue-400" />
            <StatusPill label="XAUUSD" value="25%" accent="text-yellow-400" />
            <StatusPill label="Reserve" value="10%" accent="text-purple-400" />
          </div>
        </div>
      </div>
    </section>
  );
}




function BrokerLiveStatusPanel() {
  const [data, setData] = useState<ICMarketsApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadBrokerStatus() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/icmarkets/status", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Status request failed: ${response.status}`);
      }

      const payload = (await response.json()) as ICMarketsApiData;
      setData(payload);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unknown broker status error"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBrokerStatus();
  }, []);

  if (loading) {
    return (
      <div className="mt-8 bg-black border border-cyan-900 rounded-2xl p-6">
        <h3 className="text-3xl font-bold"> IC Markets Live Status</h3>
        <p className="text-gray-400 mt-3">Loading connector status...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mt-8 bg-black border border-red-900 rounded-2xl p-6">
        <h3 className="text-3xl font-bold"> IC Markets Live Status</h3>
        <p className="text-red-400 mt-3">{error ?? "No broker data available."}</p>
        <button
          type="button"
          onClick={loadBrokerStatus}
          className="mt-5 bg-red-950 border border-red-800 rounded-xl px-5 py-3 font-bold text-red-300"
        >
          Retry
        </button>
      </div>
    );
  }

  const updatedAt = new Date(data.account.updatedAt).toLocaleString();

  return (
    <div className="mt-8 bg-black border border-cyan-900 rounded-2xl p-6">
      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <h3 className="text-3xl font-bold"> IC Markets Live Status</h3>
          <p className="text-gray-400 mt-2">
            Live aus deiner Next.js API Route <span className="text-cyan-400">/api/icmarkets/status</span>.
          </p>
        </div>

        <button
          type="button"
          onClick={loadBrokerStatus}
          className="bg-cyan-950 border border-cyan-800 rounded-xl px-5 py-3 font-bold text-cyan-300 hover:bg-cyan-900 transition"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-5 gap-5 mb-6">
        <StatCard
          title="Broker"
          value={data.broker}
          subtitle="IC Markets connector"
          accent="text-cyan-400"
          border="border-cyan-900"
        />
        <StatCard
          title="Mode"
          value={data.account.mode}
          subtitle="Demo/read-only"
          accent="text-green-400"
          border="border-green-900"
        />
        <StatCard
          title="Status"
          value={data.account.status}
          subtitle="Connector state"
          accent="text-blue-400"
          border="border-blue-900"
        />
        <StatCard
          title="Health"
          value={data.health.healthy ? "Healthy" : "Check"}
          subtitle="API health check"
          accent={data.health.healthy ? "text-green-400" : "text-red-400"}
          border={data.health.healthy ? "border-green-900" : "border-red-900"}
        />
        <StatCard
          title="Live Trading"
          value={data.liveTradingEnabled ? "Enabled" : "Blocked"}
          subtitle="Safety firewall"
          accent={data.liveTradingEnabled ? "text-green-400" : "text-red-400"}
          border={data.liveTradingEnabled ? "border-green-900" : "border-red-900"}
        />
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5">
          <h4 className="text-xl font-bold"> Account Snapshot</h4>
          <div className="space-y-3 mt-4">
            <StatusPill label="Balance" value={`${data.account.balance} ${data.account.currency}`} accent="text-green-400" />
            <StatusPill label="Equity" value={`${data.account.equity} ${data.account.currency}`} accent="text-cyan-400" />
            <StatusPill label="Free Margin" value={`${data.account.freeMargin} ${data.account.currency}`} accent="text-blue-400" />
          </div>
        </div>

        <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5">
          <h4 className="text-xl font-bold"> Exposure</h4>
          <div className="space-y-3 mt-4">
            <StatusPill label="Open Positions" value={`${data.exposure.openPositions}`} accent="text-yellow-400" />
            <StatusPill label="Floating P/L" value={`${data.exposure.totalFloatingPnL} ${data.account.currency}`} accent="text-green-400" />
            <StatusPill label="Total Volume" value={`${data.exposure.totalVolume}`} accent="text-purple-400" />
          </div>
        </div>

        <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5">
          <h4 className="text-xl font-bold"> Safety Config</h4>
          <div className="space-y-3 mt-4">
            <StatusPill label="Read Only" value={data.status.config.readOnly ? "True" : "False"} accent="text-green-400" />
            <StatusPill label="Allow Live Orders" value={data.status.config.allowLiveOrders ? "True" : "False"} accent="text-red-400" />
            <StatusPill label="Last Update" value={updatedAt} accent="text-gray-300" />
          </div>
        </div>
      </div>

      <div className="mt-6 bg-gray-950 border border-gray-800 rounded-2xl p-5">
        <p className="text-gray-400">Connector Message</p>
        <p className="text-cyan-300 font-bold mt-2">{data.message}</p>
      </div>
    </div>
  );
}


function BrokerCenter() {
  return (
    <section className="bg-gray-900 border border-cyan-900 rounded-2xl p-8">
      
      <BrokerCenterPanel />
<div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h2 className="text-4xl font-black"> Broker Center</h2>
          <p className="text-gray-400 text-xl mt-3">
            Zentrale Broker-Infrastruktur fr Capital.com, IC Markets, Demo Auth, Account Sync und sptere kontrollierte Execution Gateways.
          </p>
        </div>
        <div className="bg-black border border-cyan-800 rounded-2xl p-5 min-w-[190px]">
          <p className="text-gray-400">Broker Status</p>
          <p className="text-cyan-400 text-2xl font-bold">Prepared</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6 mb-8">
        <StatCard title="Capital.com" value="Ready" subtitle="Connector prepared" accent="text-blue-400" border="border-blue-900" />
        <StatCard title="IC Markets" value="Ready" subtitle="Connector prepared" accent="text-cyan-400" border="border-cyan-900" />
        <StatCard title="Demo Auth" value="Ready" subtitle="Safe login layer" accent="text-green-400" border="border-green-900" />
        <StatCard title="Execution API" value="Blocked" subtitle="No live orders" accent="text-red-400" border="border-red-900" />
        <StatCard title="Account Sync" value="Later" subtitle="Balance/margin sync" accent="text-yellow-400" border="border-yellow-900" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Broker Connections</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Capital.com Demo" value="Prepared" accent="text-blue-400" />
            <StatusPill label="IC Markets Demo" value="Prepared" accent="text-cyan-400" />
            <StatusPill label="Live Gateway" value="Locked" accent="text-red-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Execution Gateway</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Paper Orders" value="Enabled" accent="text-green-400" />
            <StatusPill label="Demo Execution" value="Prepared" accent="text-yellow-400" />
            <StatusPill label="Live Orders" value="Blocked" accent="text-red-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Account Sync</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Balance Sync" value="Later" accent="text-yellow-400" />
            <StatusPill label="Margin Sync" value="Later" accent="text-yellow-400" />
            <StatusPill label="Position Sync" value="Later" accent="text-yellow-400" />
          </div>
        </div>
      </div>
      <div className="mt-8 bg-black border border-cyan-900 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <h3 className="text-3xl font-bold"> IC Markets Connector V9.4</h3>
            <p className="text-gray-400 mt-2">
              Sichere Broker-Schicht fr IC Markets Demo/Read-Only: Account Snapshot, Balance Preview, Position Sync und Order Firewall.
            </p>
          </div>
          <div className="bg-gray-950 border border-cyan-800 rounded-xl p-4 min-w-[180px]">
            <p className="text-gray-400">Connector Mode</p>
            <p className="text-cyan-400 text-2xl font-bold">Read Only</p>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-5">
          <StatCard title="Connection" value="Prepared" subtitle="IC Markets module" accent="text-cyan-400" border="border-cyan-900" />
          <StatCard title="Account" value="Demo" subtitle="No live account actions" accent="text-green-400" border="border-green-900" />
          <StatCard title="Balance Sync" value="Later" subtitle="Read-only snapshot" accent="text-blue-400" border="border-blue-900" />
          <StatCard title="Positions" value="Later" subtitle="Read-only positions" accent="text-yellow-400" border="border-yellow-900" />
          <StatCard title="Live Orders" value="Blocked" subtitle="Execution firewall" accent="text-red-400" border="border-red-900" />
        </div>

        <div className="grid grid-cols-3 gap-5 mt-6">
          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5">
            <h4 className="text-xl font-bold"> Read-Only Data</h4>
            <div className="space-y-3 mt-4">
              <StatusPill label="Account Info" value="Prepared" accent="text-cyan-400" />
              <StatusPill label="Open Positions" value="Prepared" accent="text-blue-400" />
              <StatusPill label="Margin / Equity" value="Prepared" accent="text-green-400" />
            </div>
          </div>

          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5">
            <h4 className="text-xl font-bold"> Demo Bridge</h4>
            <div className="space-y-3 mt-4">
              <StatusPill label="Demo Mode" value="Enabled" accent="text-green-400" />
              <StatusPill label="Paper Sync" value="Prepared" accent="text-yellow-400" />
              <StatusPill label="Order Simulation" value="Internal only" accent="text-purple-400" />
            </div>
          </div>

          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5">
            <h4 className="text-xl font-bold"> Safety Rules</h4>
            <div className="space-y-3 mt-4">
              <StatusPill label="API Keys" value=".env.local" accent="text-green-400" />
              <StatusPill label="Browser Exposure" value="Blocked" accent="text-red-400" />
              <StatusPill label="Live Execution" value="Disabled" accent="text-red-400" />
            </div>
          </div>
        </div>
      </div>


      <BrokerLiveStatusPanel />
    </section>
  );
}

function SecurityCenter() {
  return (
    <section className="bg-gray-900 border border-red-900 rounded-2xl p-8">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h2 className="text-4xl font-black"> Security Center</h2>
          <p className="text-gray-400 text-xl mt-3">
            Sicherheitszentrale fr API Keys, Berechtigungen, Execution Firewall, Risk Limits, Approval Gates und sptere Audit Logs.
          </p>
        </div>
        <div className="bg-black border border-red-800 rounded-2xl p-5 min-w-[190px]">
          <p className="text-gray-400">Security Status</p>
          <p className="text-red-400 text-2xl font-bold">Locked</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6 mb-8">
        <StatCard title="API Keys" value=".env only" subtitle="No browser exposure" accent="text-green-400" border="border-green-900" />
        <StatCard title="Execution Lock" value="Active" subtitle="Live blocked" accent="text-red-400" border="border-red-900" />
        <StatCard title="Risk Limits" value="Prepared" subtitle="Max DD / risk rules" accent="text-yellow-400" border="border-yellow-900" />
        <StatCard title="Approval Gate" value="Required" subtitle="No auto live trade" accent="text-purple-400" border="border-purple-900" />
        <StatCard title="Audit Log" value="Later" subtitle="Action history" accent="text-cyan-400" border="border-cyan-900" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> API Security</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="OpenAI Key" value=".env.local" accent="text-green-400" />
            <StatusPill label="Claude Key" value=".env.local" accent="text-green-400" />
            <StatusPill label="Broker Keys" value="Server only" accent="text-green-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Permission Layer</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Demo Trading" value="Allowed" accent="text-green-400" />
            <StatusPill label="Live Trading" value="Blocked" accent="text-red-400" />
            <StatusPill label="Manual Approval" value="Required" accent="text-yellow-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Audit & Monitoring</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Trade Logs" value="Prepared" accent="text-blue-400" />
            <StatusPill label="AI Decisions" value="Tracked later" accent="text-purple-400" />
            <StatusPill label="Risk Events" value="Tracked later" accent="text-red-400" />
          </div>
        </div>
      </div>
    </section>
  );
}

function SettingsCenter() {
  return (
    <section className="bg-gray-900 border border-gray-700 rounded-2xl p-8">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h2 className="text-4xl font-black"> Settings Center</h2>
          <p className="text-gray-400 text-xl mt-3">
            Zentrale Konfiguration fr AI-Profile, Broker-Profile, Trading Rules, Risk Settings, Dashboard und System-Versionen.
          </p>
        </div>
        <div className="bg-black border border-gray-700 rounded-2xl p-5 min-w-[190px]">
          <p className="text-gray-400">System Version</p>
          <p className="text-gray-200 text-2xl font-bold">V9.3.7</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6 mb-8">
        <StatCard title="AI Profile" value="Multi-AI" subtitle="GPT + Claude + Agent" accent="text-purple-400" border="border-purple-900" />
        <StatCard title="Broker Profile" value="Demo" subtitle="Paper first" accent="text-cyan-400" border="border-cyan-900" />
        <StatCard title="Risk Rules" value="Safe" subtitle="Conservative mode" accent="text-green-400" border="border-green-900" />
        <StatCard title="Dashboard" value="Clean" subtitle="Mission Control" accent="text-blue-400" border="border-blue-900" />
        <StatCard title="Developer Mode" value="Available" subtitle="Architecture view" accent="text-orange-400" border="border-orange-900" />
      </div>

      <div className="grid grid-cols-4 gap-6">
        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> AI Settings</h3>
          <p className="text-gray-400 mt-4">Model choice, temperature, provider routing, prompt profiles.</p>
          <p className="text-purple-400 font-bold mt-5">Prepared</p>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Broker Settings</h3>
          <p className="text-gray-400 mt-4">Capital.com, IC Markets, demo accounts, future live gateway.</p>
          <p className="text-cyan-400 font-bold mt-5">Prepared</p>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Trading Rules</h3>
          <p className="text-gray-400 mt-4">Risk per trade, max drawdown, max exposure, confirmation rules.</p>
          <p className="text-green-400 font-bold mt-5">Prepared</p>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> UI Settings</h3>
          <p className="text-gray-400 mt-4">Dashboard layout, developer mode, theme and module visibility.</p>
          <p className="text-blue-400 font-bold mt-5">Prepared</p>
        </div>
      </div>
    </section>
  );
}









type ExecutionTicket = {
  symbol: string;
  direction: "BUY" | "SELL";
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  confidence: number;
  approved: boolean;
  reason: string;
  createdAt: string;
};

type ExecutionTicketsApiResponse = {
  success: boolean;
  tickets: ExecutionTicket[];
  count: number;
  updatedAt: string;
};

type ExecutionQueueApiResponse = {
  success: boolean;
  queue: ExecutionTicket[];
  count: number;
  updatedAt: string;
};

type ConsensusDecision = {
  symbol: string;
  marketDataVote: string;
  regimeVote: string;
  gptVote: string;
  claudeVote: string;
  finalVote: string;
  confidence: number;
  reasoning: string;
  approved: boolean;
  createdAt: string;
};

type ConsensusApiResponse = {
  success: boolean;
  decisions: ConsensusDecision[];
  count: number;
  updatedAt: string;
};

type ClaudeRiskAssessment = {
  symbol: string;
  drawdownRisk: string;
  exposureRisk: string;
  positionRisk: string;
  volatilityRisk: string;
  overallRisk: string;
  approved: boolean;
  confidence: number;
  reasoning: string;
  createdAt: string;
};

type ClaudeRiskApiResponse = {
  success: boolean;
  risks: ClaudeRiskAssessment[];
  count: number;
  updatedAt: string;
};

type GPTAnalysisApiItem = {
  symbol: string;
  bias: string;
  entryLow: number;
  entryHigh: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  confidence: number;
  reasoning: string;
  createdAt: string;
};

type GPTAnalysisApiResponse = {
  success: boolean;
  analyses: GPTAnalysisApiItem[];
  count: number;
  updatedAt: string;
};

type MarketRegimeApiItem = {
  symbol: string;
  confidence: number;
  updatedAt: string;
  trend: string;
  volatility: string;
  risk: string;
};

type MarketRegimeApiResponse = {
  success: boolean;
  regimes: MarketRegimeApiItem[];
  count: number;
  updatedAt: string;
};

type MarketPriceApiItem = {
  symbol: string;
  bid: number;
  ask: number;
  spread: number;
  timestamp: string;
  source: string;
};

type MarketPricesApiResponse = {
  success: boolean;
  prices: MarketPriceApiItem[];
  count: number;
  source: string;
  message: string;
  updatedAt: string;
};

function TradingViewWidget({
  symbol,
  interval,
}: {
  symbol: string;
  interval: string;
}) {
  const widgetUrl =
    "https://s.tradingview.com/widgetembed/?" +
    new URLSearchParams({
      symbol,
      interval,
      theme: "dark",
      style: "1",
      timezone: "Europe/Zurich",
      locale: "de_DE",
      toolbar_bg: "#0b1220",
      hide_side_toolbar: "0",
      allow_symbol_change: "1",
      save_image: "0",
      studies: "[]",
      withdateranges: "1",
      hideideas: "1",
    }).toString();

  return (
    <div className="bg-black border border-gray-800 rounded-2xl overflow-hidden h-[520px]">
      <iframe
        title={`TradingView chart ${symbol}`}
        src={widgetUrl}
        className="w-full h-full"
        loading="lazy"
      />
    </div>
  );
}


function getRegimeColor(value: string) {
  if (value.includes("BULL") || value.includes("RISK_ON")) return "text-green-400";
  if (value.includes("BEAR") || value.includes("RISK_OFF")) return "text-red-400";
  if (value.includes("VOLATILE")) return "text-purple-400";
  if (value.includes("NORMAL")) return "text-cyan-400";
  return "text-yellow-400";
}


function getBiasColor(bias: string) {
  if (bias === "BULLISH") return "text-green-400";
  if (bias === "BEARISH") return "text-red-400";
  return "text-yellow-400";
}


function getRiskColor(risk: string) {
  if (risk === "LOW") return "text-green-400";
  if (risk === "MEDIUM") return "text-yellow-400";
  if (risk === "HIGH") return "text-orange-400";
  if (risk === "EXTREME") return "text-red-500";
  return "text-gray-300";
}


function getVoteColor(vote: string) {
  if (vote === "BUY") return "text-green-400";
  if (vote === "SELL") return "text-red-400";
  if (vote === "WAIT") return "text-yellow-400";
  if (vote === "REJECT") return "text-red-500";
  return "text-gray-300";
}


function getExecutionColor(value: string) {
  if (value === "BUY") return "text-green-400";
  if (value === "SELL") return "text-red-400";
  if (value === "APPROVED") return "text-green-400";
  if (value === "BLOCKED") return "text-red-400";
  if (value === "READY") return "text-cyan-400";
  return "text-gray-300";
}

function ExecutionLiveCenter() {
  const [tickets, setTickets] = useState<ExecutionTicket[]>([]);
  const [queue, setQueue] = useState<ExecutionTicket[]>([]);
  const [executionLoading, setExecutionLoading] = useState(true);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [lastExecutionUpdate, setLastExecutionUpdate] = useState("");

  async function loadExecutionData() {
    try {
      setExecutionLoading(true);
      setExecutionError(null);

      const [ticketsResponse, queueResponse] = await Promise.all([
        fetch("/api/execution/tickets", { cache: "no-store" }),
        fetch("/api/execution/queue", { cache: "no-store" }),
      ]);

      if (!ticketsResponse.ok) {
        throw new Error(`Execution tickets request failed: ${ticketsResponse.status}`);
      }

      if (!queueResponse.ok) {
        throw new Error(`Execution queue request failed: ${queueResponse.status}`);
      }

      const ticketsPayload =
        (await ticketsResponse.json()) as ExecutionTicketsApiResponse;

      const queuePayload =
        (await queueResponse.json()) as ExecutionQueueApiResponse;

      setTickets(ticketsPayload.tickets);
      setQueue(queuePayload.queue);
      setLastExecutionUpdate(ticketsPayload.updatedAt);
    } catch (caughtError) {
      setExecutionError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unknown execution error"
      );
    } finally {
      setExecutionLoading(false);
    }
  }

  useEffect(() => {
    loadExecutionData();

    const interval = window.setInterval(() => {
      loadExecutionData();
    }, 20000);

    return () => window.clearInterval(interval);
  }, []);

  const approvedTickets = tickets.filter((ticket) => ticket.approved).length;
  const blockedTickets = tickets.filter((ticket) => !ticket.approved).length;
  const buyTickets = tickets.filter((ticket) => ticket.direction === "BUY").length;
  const sellTickets = tickets.filter((ticket) => ticket.direction === "SELL").length;

  const averageConfidence =
    tickets.length > 0
      ? Math.round(
          tickets.reduce((sum, item) => sum + item.confidence, 0) / tickets.length
        )
      : 0;

  return (
    <section className="bg-gray-900 border border-green-900 rounded-2xl p-8">
      
      <ExecutionCenterPanel />
<div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h2 className="text-4xl font-black"> Execution Dashboard Center V10.1.2</h2>
          <p className="text-gray-400 text-xl mt-3">
            Execution Preparation Layer: Trade Tickets, Risk Lock, Order Validator, Queue Monitor und Broker Safety Lock.
          </p>
        </div>

        <div className="bg-black border border-green-800 rounded-2xl p-5 min-w-[190px]">
          <p className="text-gray-400">Execution Status</p>
          <p className="text-green-400 text-2xl font-bold">Prepared</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6 mb-8">
        <StatCard title="Engine" value="Online" subtitle="Execution prep" accent="text-green-400" border="border-green-900" />
        <StatCard title="Tickets" value={`${tickets.length}`} subtitle="Trade tickets" accent="text-blue-400" border="border-blue-900" />
        <StatCard title="Approved" value={`${approvedTickets}`} subtitle="Ready tickets" accent="text-green-400" border="border-green-900" />
        <StatCard title="Blocked" value={`${blockedTickets}`} subtitle="Safety blocked" accent="text-red-400" border="border-red-900" />
        <StatCard title="Queue" value={`${queue.length}`} subtitle="Pending orders" accent="text-yellow-400" border="border-yellow-900" />
      </div>

      <div className="bg-black border border-green-900 rounded-2xl p-6 mb-8">
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <h3 className="text-3xl font-bold"> Live Execution Tickets</h3>
            <p className="text-gray-400 mt-2">
              Daten aus <span className="text-green-400">/api/execution/tickets</span>. Auto-Refresh alle 20 Sekunden.
            </p>
          </div>

          <button
            type="button"
            onClick={loadExecutionData}
            className="bg-green-950 border border-green-800 rounded-xl px-5 py-3 font-bold text-green-300 hover:bg-green-900 transition"
          >
            Refresh
          </button>
        </div>

        {executionLoading && <p className="text-gray-400">Loading execution tickets...</p>}
        {executionError && <p className="text-red-400">{executionError}</p>}

        {!executionLoading && !executionError && (
          <div className="grid grid-cols-2 gap-6">
            {tickets.map((ticket) => (
              <div key={`${ticket.symbol}-${ticket.direction}`} className="bg-gray-950 border border-gray-800 rounded-2xl p-6">
                <div className="flex items-center justify-between gap-4 mb-5">
                  <div>
                    <h4 className="text-3xl font-black">{ticket.symbol}</h4>
                    <p className={`${getExecutionColor(ticket.direction)} text-3xl font-black mt-2`}>
                      {ticket.direction}
                    </p>
                  </div>

                  <div className="bg-black border border-gray-800 rounded-xl p-4 text-right min-w-[160px]">
                    <p className="text-gray-400">Ticket Status</p>
                    <p className={`${ticket.approved ? "text-green-400" : "text-red-400"} text-2xl font-black`}>
                      {ticket.approved ? "APPROVED" : "BLOCKED"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-5">
                  <div className="bg-black border border-gray-800 rounded-xl p-4">
                    <p className="text-gray-400">Entry</p>
                    <p className="text-cyan-400 text-xl font-bold mt-2">{ticket.entry}</p>
                  </div>

                  <div className="bg-black border border-gray-800 rounded-xl p-4">
                    <p className="text-gray-400">Stop Loss</p>
                    <p className="text-red-400 text-xl font-bold mt-2">{ticket.stopLoss}</p>
                  </div>

                  <div className="bg-black border border-gray-800 rounded-xl p-4">
                    <p className="text-gray-400">Take Profit 1</p>
                    <p className="text-green-400 text-xl font-bold mt-2">{ticket.takeProfit1}</p>
                  </div>

                  <div className="bg-black border border-gray-800 rounded-xl p-4">
                    <p className="text-gray-400">Take Profit 2</p>
                    <p className="text-green-400 text-xl font-bold mt-2">{ticket.takeProfit2}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-5">
                  <div className="bg-black border border-gray-800 rounded-xl p-4">
                    <p className="text-gray-400">Confidence</p>
                    <p className="text-cyan-400 text-2xl font-black mt-2">{ticket.confidence}%</p>
                  </div>

                  <div className="bg-black border border-gray-800 rounded-xl p-4">
                    <p className="text-gray-400">Broker Lock</p>
                    <p className="text-red-400 text-2xl font-black mt-2">LOCKED</p>
                  </div>
                </div>

                <div className="bg-black border border-gray-800 rounded-xl p-4">
                  <p className="text-gray-400 mb-2">Execution Reason</p>
                  <p className="text-gray-200 leading-relaxed">{ticket.reason}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {lastExecutionUpdate && (
          <p className="text-gray-500 mt-5 text-sm">
            Last update: {new Date(lastExecutionUpdate).toLocaleString()}
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Execution Summary</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="BUY Tickets" value={`${buyTickets}`} accent="text-green-400" />
            <StatusPill label="SELL Tickets" value={`${sellTickets}`} accent="text-red-400" />
            <StatusPill label="Approved Tickets" value={`${approvedTickets}`} accent="text-cyan-400" />
            <StatusPill label="Average Confidence" value={`${averageConfidence}%`} accent="text-blue-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Execution Safety</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Order Validator" value="Active" accent="text-green-400" />
            <StatusPill label="Risk Lock" value="Active" accent="text-yellow-400" />
            <StatusPill label="Live Execution" value="Disabled" accent="text-red-400" />
            <StatusPill label="Broker Firewall" value="Locked" accent="text-red-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Queue Monitor</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Execution Queue" value={`${queue.length}`} accent="text-yellow-400" />
            <StatusPill label="Pending Orders" value={`${queue.length}`} accent="text-cyan-400" />
            <StatusPill label="Paper Orders" value="Prepared" accent="text-green-400" />
            <StatusPill label="Live Orders" value="Blocked" accent="text-red-400" />
          </div>
        </div>
      </div>

      <div className="bg-black border border-blue-900 rounded-2xl p-6 mb-8">
        <h3 className="text-2xl font-bold"> Full AI Execution Pipeline</h3>
        <div className="grid grid-cols-6 gap-4 mt-6">
          {[
            ["Market Data", "Connected", "text-blue-400"],
            ["Regime", "Connected", "text-lime-400"],
            ["GPT Analyst", "Connected", "text-cyan-400"],
            ["Claude Risk", "Connected", "text-red-400"],
            ["Consensus", "Connected", "text-purple-400"],
            ["Execution", "Prepared", "text-green-400"],
          ].map(([label, value, accent]) => (
            <div key={label} className="bg-gray-950 border border-gray-800 rounded-xl p-4">
              <p className="font-bold">{label}</p>
              <p className={`${accent} mt-2 font-bold`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-black border border-red-900 rounded-2xl p-6">
        <h3 className="text-2xl font-bold"> Live Trading Safety Lock</h3>
        <p className="text-gray-300 mt-4 leading-relaxed">
          Execution Preparation erstellt nur vorbereitete Trade Tickets. Live Broker Orders bleiben gesperrt.
          Der nchste Schritt ist Paper Trading, damit die gesamte AI-Pipeline zuerst in einem sicheren Demo-Loop getestet werden kann.
        </p>

        <div className="grid grid-cols-5 gap-4 mt-6">
          {["Trade Ticket", "Risk Lock", "Queue", "Paper Mode", "Live Blocked"].map((step) => (
            <div key={step} className="bg-gray-950 border border-gray-800 rounded-xl p-4">
              <p className="font-bold">{step}</p>
              <p className="text-red-400 mt-2">Protected</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


function ConsensusLiveCenter() {
  const [decisions, setDecisions] = useState<ConsensusDecision[]>([]);
  const [consensusLoading, setConsensusLoading] = useState(true);
  const [consensusError, setConsensusError] = useState<string | null>(null);
  const [lastConsensusUpdate, setLastConsensusUpdate] = useState("");

  async function loadConsensusDecisions() {
    try {
      setConsensusLoading(true);
      setConsensusError(null);

      const response = await fetch("/api/consensus/decision", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Consensus request failed: ${response.status}`);
      }

      const payload = (await response.json()) as ConsensusApiResponse;
      setDecisions(payload.decisions);
      setLastConsensusUpdate(payload.updatedAt);
    } catch (caughtError) {
      setConsensusError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unknown consensus error"
      );
    } finally {
      setConsensusLoading(false);
    }
  }

  useEffect(() => {
    loadConsensusDecisions();

    const interval = window.setInterval(() => {
      loadConsensusDecisions();
    }, 20000);

    return () => window.clearInterval(interval);
  }, []);

  const approvedCount = decisions.filter((item) => item.approved).length;
  const waitingCount = decisions.filter((item) => item.finalVote === "WAIT").length;
  const buyCount = decisions.filter((item) => item.finalVote === "BUY").length;
  const sellCount = decisions.filter((item) => item.finalVote === "SELL").length;

  const averageConfidence =
    decisions.length > 0
      ? Math.round(
          decisions.reduce((sum, item) => sum + item.confidence, 0) /
            decisions.length
        )
      : 0;

  return (
    <section className="bg-gray-900 border border-purple-900 rounded-2xl p-8">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h2 className="text-4xl font-black"> Consensus Dashboard Center V10.0.2</h2>
          <p className="text-gray-400 text-xl mt-3">
            Live Decision Gate: Market Data Vote, Regime Vote, GPT Vote, Claude Risk Vote und finale AI-Entscheidung.
          </p>
        </div>

        <div className="bg-black border border-purple-800 rounded-2xl p-5 min-w-[190px]">
          <p className="text-gray-400">Consensus Status</p>
          <p className="text-purple-400 text-2xl font-bold">Live</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6 mb-8">
        <StatCard title="Engine" value="Online" subtitle="Decision gate" accent="text-purple-400" border="border-purple-900" />
        <StatCard title="Decisions" value={`${decisions.length}`} subtitle="AI outputs" accent="text-blue-400" border="border-blue-900" />
        <StatCard title="Approved" value={`${approvedCount}`} subtitle="Trade allowed" accent="text-green-400" border="border-green-900" />
        <StatCard title="Waiting" value={`${waitingCount}`} subtitle="No trade yet" accent="text-yellow-400" border="border-yellow-900" />
        <StatCard title="Confidence" value={`${averageConfidence}%`} subtitle="Average score" accent="text-cyan-400" border="border-cyan-900" />
      </div>

      <div className="bg-black border border-purple-900 rounded-2xl p-6 mb-8">
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <h3 className="text-3xl font-bold"> Live Consensus Decisions</h3>
            <p className="text-gray-400 mt-2">
              Daten aus <span className="text-purple-400">/api/consensus/decision</span>. Auto-Refresh alle 20 Sekunden.
            </p>
          </div>

          <button
            type="button"
            onClick={loadConsensusDecisions}
            className="bg-purple-950 border border-purple-800 rounded-xl px-5 py-3 font-bold text-purple-300 hover:bg-purple-900 transition"
          >
            Refresh
          </button>
        </div>

        {consensusLoading && <p className="text-gray-400">Loading consensus decisions...</p>}
        {consensusError && <p className="text-red-400">{consensusError}</p>}

        {!consensusLoading && !consensusError && (
          <div className="grid grid-cols-2 gap-6">
            {decisions.map((item) => (
              <div key={item.symbol} className="bg-gray-950 border border-gray-800 rounded-2xl p-6">
                <div className="flex items-center justify-between gap-4 mb-5">
                  <div>
                    <h4 className="text-3xl font-black">{item.symbol}</h4>
                    <p className={`${getVoteColor(item.finalVote)} text-3xl font-black mt-2`}>
                      {item.finalVote}
                    </p>
                  </div>

                  <div className="bg-black border border-gray-800 rounded-xl p-4 text-right min-w-[150px]">
                    <p className="text-gray-400">Final Status</p>
                    <p className={`${item.approved ? "text-green-400" : "text-yellow-400"} text-2xl font-black`}>
                      {item.approved ? "APPROVED" : "WAIT"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 mb-5">
                  <div className="bg-black border border-gray-800 rounded-xl p-4">
                    <p className="text-gray-400 text-sm">Market Data</p>
                    <p className={`${getVoteColor(item.marketDataVote)} text-xl font-bold mt-2`}>
                      {item.marketDataVote}
                    </p>
                  </div>

                  <div className="bg-black border border-gray-800 rounded-xl p-4">
                    <p className="text-gray-400 text-sm">Regime</p>
                    <p className={`${getVoteColor(item.regimeVote)} text-xl font-bold mt-2`}>
                      {item.regimeVote}
                    </p>
                  </div>

                  <div className="bg-black border border-gray-800 rounded-xl p-4">
                    <p className="text-gray-400 text-sm">GPT</p>
                    <p className={`${getVoteColor(item.gptVote)} text-xl font-bold mt-2`}>
                      {item.gptVote}
                    </p>
                  </div>

                  <div className="bg-black border border-gray-800 rounded-xl p-4">
                    <p className="text-gray-400 text-sm">Claude</p>
                    <p className={`${getVoteColor(item.claudeVote)} text-xl font-bold mt-2`}>
                      {item.claudeVote}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-5">
                  <div className="bg-black border border-gray-800 rounded-xl p-4">
                    <p className="text-gray-400">Confidence</p>
                    <p className="text-cyan-400 text-2xl font-black mt-2">{item.confidence}%</p>
                  </div>

                  <div className="bg-black border border-gray-800 rounded-xl p-4">
                    <p className="text-gray-400">Execution Permission</p>
                    <p className={`${item.approved ? "text-green-400" : "text-red-400"} text-2xl font-black mt-2`}>
                      {item.approved ? "ALLOWED" : "BLOCKED"}
                    </p>
                  </div>
                </div>

                <div className="bg-black border border-gray-800 rounded-xl p-4">
                  <p className="text-gray-400 mb-2">Consensus Reasoning</p>
                  <pre className="text-gray-200 whitespace-pre-wrap font-sans leading-relaxed">
                    {item.reasoning}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        )}

        {lastConsensusUpdate && (
          <p className="text-gray-500 mt-5 text-sm">
            Last update: {new Date(lastConsensusUpdate).toLocaleString()}
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Decision Summary</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="BUY Decisions" value={`${buyCount}`} accent="text-green-400" />
            <StatusPill label="SELL Decisions" value={`${sellCount}`} accent="text-red-400" />
            <StatusPill label="WAIT Decisions" value={`${waitingCount}`} accent="text-yellow-400" />
            <StatusPill label="Approved Trades" value={`${approvedCount}`} accent="text-cyan-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Consensus Logic</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Vote Calculator" value="Active" accent="text-purple-400" />
            <StatusPill label="Confidence Engine" value="Active" accent="text-cyan-400" />
            <StatusPill label="Trade Validator" value="Active" accent="text-green-400" />
            <StatusPill label="Decision Builder" value="Active" accent="text-blue-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Full AI Pipeline</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Market Data" value="Connected" accent="text-blue-400" />
            <StatusPill label="Regime Engine" value="Connected" accent="text-lime-400" />
            <StatusPill label="GPT Analyst" value="Connected" accent="text-cyan-400" />
            <StatusPill label="Claude Risk" value="Connected" accent="text-red-400" />
            <StatusPill label="Consensus" value="Active" accent="text-purple-400" />
          </div>
        </div>
      </div>

      <div className="bg-black border border-green-900 rounded-2xl p-6">
        <h3 className="text-2xl font-bold"> Next Gate: Execution Preparation</h3>
        <p className="text-gray-300 mt-4 leading-relaxed">
          Die Consensus Engine erzeugt jetzt finale Trade-Entscheidungen. Live Execution bleibt weiterhin gesperrt.
          Im nchsten Schritt wird das Execution Preparation Center diese Entscheidungen prfen, protokollieren und nur fr Paper/Demo-Flows vorbereiten.
        </p>

        <div className="grid grid-cols-5 gap-4 mt-6">
          {["Consensus", "Risk Firewall", "Paper Order", "Execution Prep", "Broker Lock"].map((step) => (
            <div key={step} className="bg-gray-950 border border-gray-800 rounded-xl p-4">
              <p className="font-bold">{step}</p>
              <p className="text-green-400 mt-2">Prepared</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


function ClaudeRiskLiveCenter() {
  const [risks, setRisks] = useState<ClaudeRiskAssessment[]>([]);
  const [riskLoading, setRiskLoading] = useState(true);
  const [riskError, setRiskError] = useState<string | null>(null);
  const [lastRiskUpdate, setLastRiskUpdate] = useState("");

  async function loadClaudeRisks() {
    try {
      setRiskLoading(true);
      setRiskError(null);

      const response = await fetch("/api/claude-risk/assess", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Claude risk request failed: ${response.status}`);
      }

      const payload = (await response.json()) as ClaudeRiskApiResponse;
      setRisks(payload.risks);
      setLastRiskUpdate(payload.updatedAt);
    } catch (caughtError) {
      setRiskError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unknown Claude risk error"
      );
    } finally {
      setRiskLoading(false);
    }
  }

  useEffect(() => {
    loadClaudeRisks();

    const interval = window.setInterval(() => {
      loadClaudeRisks();
    }, 20000);

    return () => window.clearInterval(interval);
  }, []);

  const approvedCount = risks.filter((item) => item.approved).length;
  const blockedCount = risks.filter((item) => !item.approved).length;
  const highRiskCount = risks.filter(
    (item) =>
      item.drawdownRisk === "HIGH" ||
      item.exposureRisk === "HIGH" ||
      item.positionRisk === "HIGH" ||
      item.volatilityRisk === "HIGH" ||
      item.drawdownRisk === "EXTREME" ||
      item.exposureRisk === "EXTREME" ||
      item.positionRisk === "EXTREME" ||
      item.volatilityRisk === "EXTREME"
  ).length;

  const averageConfidence =
    risks.length > 0
      ? Math.round(
          risks.reduce((sum, item) => sum + item.confidence, 0) / risks.length
        )
      : 0;

  return (
    <section className="bg-gray-900 border border-red-900 rounded-2xl p-8">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h2 className="text-4xl font-black"> Claude Risk Dashboard Center V9.9.2</h2>
          <p className="text-gray-400 text-xl mt-3">
            Live-Risk-Review aus der Claude Risk API: Drawdown, Exposure, Position Size, Volatility, Approval und Risk Reasoning.
          </p>
        </div>

        <div className="bg-black border border-red-800 rounded-2xl p-5 min-w-[190px]">
          <p className="text-gray-400">Claude Risk Status</p>
          <p className="text-red-400 text-2xl font-bold">Live</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6 mb-8">
        <StatCard title="Engine" value="Online" subtitle="Claude risk core" accent="text-red-400" border="border-red-900" />
        <StatCard title="Assessments" value={`${risks.length}`} subtitle="Risk reviews" accent="text-blue-400" border="border-blue-900" />
        <StatCard title="Approved" value={`${approvedCount}`} subtitle="Allowed ideas" accent="text-green-400" border="border-green-900" />
        <StatCard title="Blocked" value={`${blockedCount}`} subtitle="Rejected ideas" accent="text-red-400" border="border-red-900" />
        <StatCard title="Confidence" value={`${averageConfidence}%`} subtitle="Average score" accent="text-cyan-400" border="border-cyan-900" />
      </div>

      <div className="bg-black border border-red-900 rounded-2xl p-6 mb-8">
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <h3 className="text-3xl font-bold"> Live Claude Risk Review</h3>
            <p className="text-gray-400 mt-2">
              Daten aus <span className="text-red-400">/api/claude-risk/assess</span>. Auto-Refresh alle 20 Sekunden.
            </p>
          </div>

          <button
            type="button"
            onClick={loadClaudeRisks}
            className="bg-red-950 border border-red-800 rounded-xl px-5 py-3 font-bold text-red-300 hover:bg-red-900 transition"
          >
            Refresh
          </button>
        </div>

        {riskLoading && <p className="text-gray-400">Loading Claude risk assessments...</p>}
        {riskError && <p className="text-red-400">{riskError}</p>}

        {!riskLoading && !riskError && (
          <div className="grid grid-cols-2 gap-6">
            {risks.map((item) => (
              <div key={item.symbol} className="bg-gray-950 border border-gray-800 rounded-2xl p-6">
                <div className="flex items-center justify-between gap-4 mb-5">
                  <div>
                    <h4 className="text-3xl font-black">{item.symbol}</h4>
                    <p className={`${item.approved ? "text-green-400" : "text-red-400"} text-2xl font-bold mt-2`}>
                      {item.approved ? "APPROVED" : "BLOCKED"}
                    </p>
                  </div>

                  <div className="bg-black border border-gray-800 rounded-xl p-4 text-right min-w-[140px]">
                    <p className="text-gray-400">Overall Risk</p>
                    <p className={`${getRiskColor(item.overallRisk)} text-2xl font-black`}>
                      {item.overallRisk}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-5">
                  <div className="bg-black border border-gray-800 rounded-xl p-4">
                    <p className="text-gray-400">Drawdown Risk</p>
                    <p className={`${getRiskColor(item.drawdownRisk)} text-xl font-bold mt-2`}>
                      {item.drawdownRisk}
                    </p>
                  </div>

                  <div className="bg-black border border-gray-800 rounded-xl p-4">
                    <p className="text-gray-400">Exposure Risk</p>
                    <p className={`${getRiskColor(item.exposureRisk)} text-xl font-bold mt-2`}>
                      {item.exposureRisk}
                    </p>
                  </div>

                  <div className="bg-black border border-gray-800 rounded-xl p-4">
                    <p className="text-gray-400">Position Risk</p>
                    <p className={`${getRiskColor(item.positionRisk)} text-xl font-bold mt-2`}>
                      {item.positionRisk}
                    </p>
                  </div>

                  <div className="bg-black border border-gray-800 rounded-xl p-4">
                    <p className="text-gray-400">Volatility Risk</p>
                    <p className={`${getRiskColor(item.volatilityRisk)} text-xl font-bold mt-2`}>
                      {item.volatilityRisk}
                    </p>
                  </div>
                </div>

                <div className="bg-black border border-gray-800 rounded-xl p-4">
                  <p className="text-gray-400 mb-2">Risk Reasoning</p>
                  <pre className="text-gray-200 whitespace-pre-wrap font-sans leading-relaxed">
                    {item.reasoning}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        )}

        {lastRiskUpdate && (
          <p className="text-gray-500 mt-5 text-sm">
            Last update: {new Date(lastRiskUpdate).toLocaleString()}
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Risk Heatmap</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Approved Ideas" value={`${approvedCount}`} accent="text-green-400" />
            <StatusPill label="Blocked Ideas" value={`${blockedCount}`} accent="text-red-400" />
            <StatusPill label="High Risk Flags" value={`${highRiskCount}`} accent="text-orange-400" />
            <StatusPill label="Average Confidence" value={`${averageConfidence}%`} accent="text-cyan-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Claude Risk Logic</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Drawdown Checker" value="Active" accent="text-red-400" />
            <StatusPill label="Exposure Checker" value="Active" accent="text-yellow-400" />
            <StatusPill label="Position Sizing" value="Active" accent="text-orange-400" />
            <StatusPill label="Volatility Filter" value="Active" accent="text-purple-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> AI Pipeline</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Market Data" value="Connected" accent="text-blue-400" />
            <StatusPill label="Regime Engine" value="Connected" accent="text-lime-400" />
            <StatusPill label="GPT Analyst" value="Connected" accent="text-cyan-400" />
            <StatusPill label="Claude Risk" value="Active" accent="text-red-400" />
            <StatusPill label="Consensus" value="Next" accent="text-purple-400" />
          </div>
        </div>
      </div>

      <div className="bg-black border border-purple-900 rounded-2xl p-6">
        <h3 className="text-2xl font-bold"> Next Gate: Consensus Engine</h3>
        <p className="text-gray-300 mt-4 leading-relaxed">
          Claude Risk kann Trade-Ideen genehmigen oder blockieren, aber die finale Entscheidung kommt erst im Consensus Gate.
          Dort werden GPT Bias, Claude Risk, Regime, Market Data und Portfolio Safety gemeinsam bewertet.
        </p>

        <div className="grid grid-cols-5 gap-4 mt-6">
          {["Market Data", "Regime", "GPT Analyst", "Claude Risk", "Consensus"].map((step) => (
            <div key={step} className="bg-gray-950 border border-gray-800 rounded-xl p-4">
              <p className="font-bold">{step}</p>
              <p className="text-red-400 mt-2">Prepared</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


function GPTAnalystLiveCenter() {
  const [analyses, setAnalyses] = useState<GPTAnalysisApiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState("");

  async function loadAnalyses() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/gpt-analyst/analyze", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`GPT analyst request failed: ${response.status}`);
      }

      const payload = (await response.json()) as GPTAnalysisApiResponse;
      setAnalyses(payload.analyses);
      setLastUpdate(payload.updatedAt);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unknown GPT analyst error"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnalyses();

    const interval = window.setInterval(() => {
      loadAnalyses();
    }, 20000);

    return () => window.clearInterval(interval);
  }, []);

  const bullishCount = analyses.filter((item) => item.bias === "BULLISH").length;
  const bearishCount = analyses.filter((item) => item.bias === "BEARISH").length;
  const neutralCount = analyses.filter((item) => item.bias === "NEUTRAL").length;
  const averageConfidence =
    analyses.length > 0
      ? Math.round(
          analyses.reduce((sum, item) => sum + item.confidence, 0) /
            analyses.length
        )
      : 0;

  return (
    <section className="bg-gray-900 border border-cyan-900 rounded-2xl p-8">
      
      <BrokerCenterPanel />
<div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h2 className="text-4xl font-black"> GPT Analyst Dashboard Center V9.8.2</h2>
          <p className="text-gray-400 text-xl mt-3">
            Live-AI-Analyse aus der GPT Analyst API: Bias, Entry Zone, Stop Loss, Take Profits, Confidence und Reasoning.
          </p>
        </div>

        <div className="bg-black border border-cyan-800 rounded-2xl p-5 min-w-[190px]">
          <p className="text-gray-400">GPT Analyst Status</p>
          <p className="text-cyan-400 text-2xl font-bold">Live</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6 mb-8">
        <StatCard title="Engine" value="Online" subtitle="GPT analyst core" accent="text-cyan-400" border="border-cyan-900" />
        <StatCard title="Analyses" value={`${analyses.length}`} subtitle="Trade ideas" accent="text-blue-400" border="border-blue-900" />
        <StatCard title="Confidence" value={`${averageConfidence}%`} subtitle="Average score" accent="text-green-400" border="border-green-900" />
        <StatCard title="Bullish" value={`${bullishCount}`} subtitle="Long bias" accent="text-green-400" border="border-green-900" />
        <StatCard title="Bearish" value={`${bearishCount}`} subtitle="Short bias" accent="text-red-400" border="border-red-900" />
      </div>

      <div className="bg-black border border-cyan-900 rounded-2xl p-6 mb-8">
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <h3 className="text-3xl font-bold"> Live GPT Trade Analysis</h3>
            <p className="text-gray-400 mt-2">
              Daten aus <span className="text-cyan-400">/api/gpt-analyst/analyze</span>. Auto-Refresh alle 20 Sekunden.
            </p>
          </div>

          <button
            type="button"
            onClick={loadAnalyses}
            className="bg-cyan-950 border border-cyan-800 rounded-xl px-5 py-3 font-bold text-cyan-300 hover:bg-cyan-900 transition"
          >
            Refresh
          </button>
        </div>

        {loading && <p className="text-gray-400">Loading GPT analyses...</p>}
        {error && <p className="text-red-400">{error}</p>}

        {!loading && !error && (
          <div className="grid grid-cols-2 gap-6">
            {analyses.map((item) => (
              <div key={item.symbol} className="bg-gray-950 border border-gray-800 rounded-2xl p-6">
                <div className="flex items-center justify-between gap-4 mb-5">
                  <div>
                    <h4 className="text-3xl font-black">{item.symbol}</h4>
                    <p className={`${getBiasColor(item.bias)} text-2xl font-bold mt-2`}>
                      {item.bias}
                    </p>
                  </div>

                  <div className="bg-black border border-gray-800 rounded-xl p-4 text-right min-w-[120px]">
                    <p className="text-gray-400">Confidence</p>
                    <p className="text-green-400 text-2xl font-black">{item.confidence}%</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-5">
                  <div className="bg-black border border-gray-800 rounded-xl p-4">
                    <p className="text-gray-400">Entry Zone</p>
                    <p className="text-cyan-400 text-xl font-bold mt-2">
                      {item.entryLow} - {item.entryHigh}
                    </p>
                  </div>

                  <div className="bg-black border border-gray-800 rounded-xl p-4">
                    <p className="text-gray-400">Stop Loss</p>
                    <p className="text-red-400 text-xl font-bold mt-2">{item.stopLoss}</p>
                  </div>

                  <div className="bg-black border border-gray-800 rounded-xl p-4">
                    <p className="text-gray-400">Take Profit 1</p>
                    <p className="text-green-400 text-xl font-bold mt-2">{item.takeProfit1}</p>
                  </div>

                  <div className="bg-black border border-gray-800 rounded-xl p-4">
                    <p className="text-gray-400">Take Profit 2</p>
                    <p className="text-green-400 text-xl font-bold mt-2">{item.takeProfit2}</p>
                  </div>
                </div>

                <div className="bg-black border border-gray-800 rounded-xl p-4">
                  <p className="text-gray-400 mb-2">Reasoning</p>
                  <pre className="text-gray-200 whitespace-pre-wrap font-sans leading-relaxed">
                    {item.reasoning}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        )}

        {lastUpdate && (
          <p className="text-gray-500 mt-5 text-sm">
            Last update: {new Date(lastUpdate).toLocaleString()}
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Bias Overview</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Bullish Ideas" value={`${bullishCount}`} accent="text-green-400" />
            <StatusPill label="Bearish Ideas" value={`${bearishCount}`} accent="text-red-400" />
            <StatusPill label="Neutral Ideas" value={`${neutralCount}`} accent="text-yellow-400" />
            <StatusPill label="Average Confidence" value={`${averageConfidence}%`} accent="text-cyan-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Analyst Logic</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Bias Detector" value="Active" accent="text-cyan-400" />
            <StatusPill label="Entry Planner" value="Active" accent="text-blue-400" />
            <StatusPill label="Risk/Reward" value="Active" accent="text-green-400" />
            <StatusPill label="Reasoning Builder" value="Active" accent="text-purple-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> AI Pipeline</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Market Data" value="Connected" accent="text-blue-400" />
            <StatusPill label="Regime Engine" value="Connected" accent="text-lime-400" />
            <StatusPill label="GPT Analyst" value="Active" accent="text-cyan-400" />
            <StatusPill label="Claude Risk" value="Waiting" accent="text-red-400" />
            <StatusPill label="Consensus" value="Pending" accent="text-purple-400" />
          </div>
        </div>
      </div>

      <div className="bg-black border border-purple-900 rounded-2xl p-6">
        <h3 className="text-2xl font-bold"> Next Gate: Claude Risk Review</h3>
        <p className="text-gray-300 mt-4 leading-relaxed">
          GPT erzeugt nur eine Analyse und Trade-Idee. Kein Trade wird allein durch GPT erlaubt.
          Als nchstes prft Claude Risk Engine Drawdown, Volatilitt, Exposure, Positionsgre und Safety Rules.
        </p>

        <div className="grid grid-cols-5 gap-4 mt-6">
          {["Market Data", "Regime", "GPT Idea", "Claude Risk", "Consensus"].map((step) => (
            <div key={step} className="bg-gray-950 border border-gray-800 rounded-xl p-4">
              <p className="font-bold">{step}</p>
              <p className="text-cyan-400 mt-2">Prepared</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


function MarketRegimeLiveCenter() {
  const [regimes, setRegimes] = useState<MarketRegimeApiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState("");

  async function loadRegimes() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/market-regime/classify", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Market regime request failed: ${response.status}`);
      }

      const payload = (await response.json()) as MarketRegimeApiResponse;
      setRegimes(payload.regimes);
      setLastUpdate(payload.updatedAt);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unknown market regime error"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRegimes();

    const interval = window.setInterval(() => {
      loadRegimes();
    }, 20000);

    return () => window.clearInterval(interval);
  }, []);

  const averageConfidence =
    regimes.length > 0
      ? Math.round(
          (regimes.reduce((sum, item) => sum + item.confidence, 0) /
            regimes.length) *
            100
        )
      : 0;

  const bullishCount = regimes.filter((item) => item.trend.includes("BULL")).length;
  const bearishCount = regimes.filter((item) => item.trend.includes("BEAR")).length;
  const volatileCount = regimes.filter((item) => item.volatility.includes("VOLATILE")).length;
  const riskOnCount = regimes.filter((item) => item.risk.includes("RISK_ON")).length;

  return (
    <section className="bg-gray-900 border border-lime-900 rounded-2xl p-8">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h2 className="text-4xl font-black"> Market Regime Dashboard Center V9.7.2</h2>
          <p className="text-gray-400 text-xl mt-3">
            Live-Regime-Erkennung aus der Market Regime API: Trend, Volatilitt, Risk-On/Risk-Off und Confidence fr AI-Entscheidungen.
          </p>
        </div>

        <div className="bg-black border border-lime-800 rounded-2xl p-5 min-w-[190px]">
          <p className="text-gray-400">Regime Status</p>
          <p className="text-lime-400 text-2xl font-bold">Live</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6 mb-8">
        <StatCard title="Engine" value="Online" subtitle="Regime core" accent="text-lime-400" border="border-lime-900" />
        <StatCard title="Symbols" value={`${regimes.length}`} subtitle="Classified markets" accent="text-blue-400" border="border-blue-900" />
        <StatCard title="Confidence" value={`${averageConfidence}%`} subtitle="Average score" accent="text-green-400" border="border-green-900" />
        <StatCard title="Volatile" value={`${volatileCount}`} subtitle="Volatility flags" accent="text-purple-400" border="border-purple-900" />
        <StatCard title="Risk-On" value={`${riskOnCount}`} subtitle="Risk appetite" accent="text-yellow-400" border="border-yellow-900" />
      </div>

      <div className="bg-black border border-lime-900 rounded-2xl p-6 mb-8">
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <h3 className="text-3xl font-bold"> Live Regime Classification</h3>
            <p className="text-gray-400 mt-2">
              Daten aus <span className="text-lime-400">/api/market-regime/classify</span>. Auto-Refresh alle 20 Sekunden.
            </p>
          </div>

          <button
            type="button"
            onClick={loadRegimes}
            className="bg-lime-950 border border-lime-800 rounded-xl px-5 py-3 font-bold text-lime-300 hover:bg-lime-900 transition"
          >
            Refresh
          </button>
        </div>

        {loading && <p className="text-gray-400">Loading market regimes...</p>}
        {error && <p className="text-red-400">{error}</p>}

        {!loading && !error && (
          <div className="grid grid-cols-4 gap-5">
            {regimes.map((item) => (
              <div key={item.symbol} className="bg-gray-950 border border-gray-800 rounded-2xl p-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h4 className="text-2xl font-black">{item.symbol}</h4>
                  <p className="text-green-400 font-bold">{Math.round(item.confidence * 100)}%</p>
                </div>

                <div className="space-y-3">
                  <StatusPill label="Trend" value={item.trend} accent={getRegimeColor(item.trend)} />
                  <StatusPill label="Volatility" value={item.volatility} accent={getRegimeColor(item.volatility)} />
                  <StatusPill label="Risk" value={item.risk} accent={getRegimeColor(item.risk)} />
                </div>
              </div>
            ))}
          </div>
        )}

        {lastUpdate && (
          <p className="text-gray-500 mt-5 text-sm">
            Last update: {new Date(lastUpdate).toLocaleString()}
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Regime Heatmap</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Bullish Markets" value={`${bullishCount}`} accent="text-green-400" />
            <StatusPill label="Bearish Markets" value={`${bearishCount}`} accent="text-red-400" />
            <StatusPill label="Volatile Markets" value={`${volatileCount}`} accent="text-purple-400" />
            <StatusPill label="Neutral Risk" value={`${regimes.filter((item) => item.risk === "NEUTRAL").length}`} accent="text-yellow-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Regime Safety Logic</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="News-driven" value="Extra review later" accent="text-yellow-400" />
            <StatusPill label="Volatile" value="Reduce size" accent="text-purple-400" />
            <StatusPill label="Risk-Off" value="Defensive filter" accent="text-red-400" />
            <StatusPill label="Trending" value="Momentum allowed" accent="text-green-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> AI Pipeline Connection</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Market Data" value="Connected" accent="text-blue-400" />
            <StatusPill label="Regime Engine" value="Active" accent="text-lime-400" />
            <StatusPill label="GPT Analyst" value="Next input" accent="text-cyan-400" />
            <StatusPill label="Claude Risk" value="Risk filter" accent="text-red-400" />
            <StatusPill label="Consensus" value="Required" accent="text-purple-400" />
          </div>
        </div>
      </div>

      <div className="bg-black border border-cyan-900 rounded-2xl p-6">
        <h3 className="text-2xl font-bold"> Regime Decision Impact</h3>
        <p className="text-gray-300 mt-4 leading-relaxed">
          Die Regime Engine wird spter jede AI-Entscheidung filtern: Momentum-Strategien nur bei Trend,
          Mean-Reversion eher bei Range, Positionsgre kleiner bei Volatilitt und zustzliche Prfung bei Risk-Off.
        </p>

        <div className="grid grid-cols-5 gap-4 mt-6">
          {["Price Cache", "Regime Classifier", "Strategy Filter", "Risk Review", "Consensus Gate"].map((step) => (
            <div key={step} className="bg-gray-950 border border-gray-800 rounded-xl p-4">
              <p className="font-bold">{step}</p>
              <p className="text-lime-400 mt-2">Prepared</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


function MarketDataEngineCenter() {
  const tradingViewSymbols = [
    {
      label: "Gold",
      symbol: "OANDA:XAUUSD",
      market: "Commodities",
      purpose: "Risk sentiment / safe haven",
      accent: "text-yellow-400",
      border: "border-yellow-900",
    },
    {
      label: "Oil",
      symbol: "TVC:USOIL",
      market: "Commodities",
      purpose: "Inventory / macro driver",
      accent: "text-orange-400",
      border: "border-orange-900",
    },
    {
      label: "EURUSD",
      symbol: "FX:EURUSD",
      market: "Forex",
      purpose: "ECB / Fed / USD risk",
      accent: "text-green-400",
      border: "border-green-900",
    },
    {
      label: "BTCUSD",
      symbol: "BINANCE:BTCUSDT",
      market: "Crypto",
      purpose: "Risk appetite",
      accent: "text-purple-400",
      border: "border-purple-900",
    },
  ];

  const timeframes = [
    { label: "15m", value: "15" },
    { label: "1H", value: "60" },
    { label: "4H", value: "240" },
    { label: "1D", value: "D" },
  ];

  const [selectedSymbol, setSelectedSymbol] = useState("OANDA:XAUUSD");
  const [selectedInterval, setSelectedInterval] = useState("60");
  const [multiChartMode, setMultiChartMode] = useState(false);

  const selectedMarket =
    tradingViewSymbols.find((item) => item.symbol === selectedSymbol) ??
    tradingViewSymbols[0];

  const [marketPrices, setMarketPrices] = useState<MarketPriceApiItem[]>([]);
  const [pricesLoading, setPricesLoading] = useState(true);
  const [pricesError, setPricesError] = useState<string | null>(null);
  const [lastPriceUpdate, setLastPriceUpdate] = useState<string>("");

  async function loadMarketPrices() {
    try {
      setPricesLoading(true);
      setPricesError(null);

      const response = await fetch("/api/market-data/prices", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Market price request failed: ${response.status}`);
      }

      const payload = (await response.json()) as MarketPricesApiResponse;
      setMarketPrices(payload.prices);
      setLastPriceUpdate(payload.updatedAt);
    } catch (caughtError) {
      setPricesError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unknown market data error"
      );
    } finally {
      setPricesLoading(false);
    }
  }

  useEffect(() => {
    loadMarketPrices();

    const interval = window.setInterval(() => {
      loadMarketPrices();
    }, 15000);

    return () => window.clearInterval(interval);
  }, []);

  const selectedCleanSymbol =
    selectedSymbol.includes(":") ? selectedSymbol.split(":")[1] : selectedSymbol;

  const selectedPrice =
    marketPrices.find((price) => price.symbol === "XAUUSD" && selectedSymbol.includes("XAUUSD")) ??
    marketPrices.find((price) => price.symbol === "USOIL" && selectedSymbol.includes("USOIL")) ??
    marketPrices.find((price) => price.symbol === "EURUSD" && selectedSymbol.includes("EURUSD")) ??
    marketPrices.find((price) => price.symbol === "BTCUSD" && selectedSymbol.includes("BTC")) ??
    marketPrices[0];

  return (
    <section className="bg-gray-900 border border-blue-900 rounded-2xl p-8">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h2 className="text-4xl font-black"> Market Data Engine V9.6.4</h2>
          <p className="text-gray-400 text-xl mt-3">
            Live verbundene Marktdaten-Schicht: Price Cache API, Mock-Live-Preise, TradingView Chart Layer, Feed Router und AI Data Pipeline.
          </p>
        </div>

        <div className="bg-black border border-blue-800 rounded-2xl p-5 min-w-[190px]">
          <p className="text-gray-400">Market Data Status</p>
          <p className="text-blue-400 text-2xl font-bold">Online</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6 mb-8">
        <StatCard title="Engine" value="Online" subtitle="Market data core" accent="text-blue-400" border="border-blue-900" />
        <StatCard title="Selected" value={selectedMarket.label} subtitle={selectedPrice ? `${selectedPrice.bid}` : selectedMarket.symbol} accent={selectedMarket.accent} border={selectedMarket.border} />
        <StatCard title="Timeframe" value={timeframes.find((timeframe) => timeframe.value === selectedInterval)?.label ?? selectedInterval} subtitle="Selectable" accent="text-cyan-400" border="border-cyan-900" />
        <StatCard title="Feed Priority" value="Ready" subtitle="Capital / IC / TV" accent="text-green-400" border="border-green-900" />
        <StatCard title="Safety" value="Safe" subtitle="No unofficial API" accent="text-red-400" border="border-red-900" />
      </div>

      <div className="bg-black border border-blue-900 rounded-2xl p-6 mb-8">
        <div className="flex flex-wrap items-center justify-between gap-6 mb-6">
          <div>
            <h3 className="text-3xl font-bold"> TradingView Chart Workspace</h3>
            <p className="text-gray-400 mt-2">
              Wechsel zwischen Gold, Oil, EURUSD und BTCUSD. Die echten AI-Daten kommen spter trotzdem aus eigenen Broker-/Market-Feeds.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setMultiChartMode((value) => !value)}
              className="bg-purple-950 border border-purple-800 rounded-xl px-5 py-3 font-bold text-purple-300 hover:bg-purple-900 transition"
            >
              {multiChartMode ? "Single Chart" : "Multi Chart"}
            </button>

            <a
              href={`https://www.tradingview.com/chart/?symbol=${selectedSymbol}`}
              target="_blank"
              rel="noreferrer"
              className="bg-blue-950 border border-blue-800 rounded-xl px-5 py-3 font-bold text-blue-300 hover:bg-blue-900 transition"
            >
              Open TradingView 
            </a>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-5">
          {tradingViewSymbols.map((item) => (
            <button
              key={item.symbol}
              type="button"
              onClick={() => {
                setSelectedSymbol(item.symbol);
                setMultiChartMode(false);
              }}
              className={`text-left bg-gray-950 border rounded-2xl p-5 hover:bg-gray-900 transition ${
                selectedSymbol === item.symbol ? item.border : "border-gray-800"
              }`}
            >
              <p className="text-gray-400">{item.market}</p>
              <h4 className={`text-3xl font-black mt-3 ${item.accent}`}>{item.label}</h4>
              <p className="text-gray-300 mt-3">{item.symbol}</p>
              <p className="text-gray-500 mt-3">{item.purpose}</p>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          {timeframes.map((timeframe) => (
            <button
              key={timeframe.value}
              type="button"
              onClick={() => setSelectedInterval(timeframe.value)}
              className={`rounded-xl px-5 py-3 font-bold border transition ${
                selectedInterval === timeframe.value
                  ? "bg-cyan-950 border-cyan-700 text-cyan-300"
                  : "bg-gray-950 border-gray-800 text-gray-300 hover:bg-gray-900"
              }`}
            >
              {timeframe.label}
            </button>
          ))}
        </div>

        {multiChartMode ? (
          <div className="grid grid-cols-2 gap-5">
            {tradingViewSymbols.map((item) => (
              <div key={item.symbol}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className={`text-xl font-bold ${item.accent}`}>{item.label}</h4>
                  <p className="text-gray-500">{item.symbol}</p>
                </div>
                <TradingViewWidget symbol={item.symbol} interval={selectedInterval} />
              </div>
            ))}
          </div>
        ) : (
          <TradingViewWidget symbol={selectedSymbol} interval={selectedInterval} />
        )}
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Symbol Mapper</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="GOLD" value="OANDA:XAUUSD" accent="text-yellow-400" />
            <StatusPill label="USOIL" value="TVC:USOIL" accent="text-orange-400" />
            <StatusPill label="EURUSD" value="FX:EURUSD" accent="text-green-400" />
            <StatusPill label="BTCUSD" value="BINANCE:BTCUSDT" accent="text-purple-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Datafeed Plan</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Phase 1" value="TradingView Widget" accent="text-blue-400" />
            <StatusPill label="Phase 2" value="Capital.com API" accent="text-cyan-400" />
            <StatusPill label="Phase 3" value="IC Markets Data" accent="text-green-400" />
            <StatusPill label="Phase 4" value="Unified Feed" accent="text-purple-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Integration Safety</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Unofficial API" value="Avoided" accent="text-green-400" />
            <StatusPill label="Scraping" value="No" accent="text-red-400" />
            <StatusPill label="Private Charting Library" value="Approval later" accent="text-yellow-400" />
            <StatusPill label="Broker Feed" value="Preferred" accent="text-cyan-400" />
          </div>
        </div>
      </div>


      <div className="bg-black border border-green-900 rounded-2xl p-6 mb-8">
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <h3 className="text-3xl font-bold"> Market Data Engine Core</h3>
            <p className="text-gray-400 mt-2">
              V9.6 verbindet Symbol Registry, Feed Router, Price Cache und Health Monitor zu einer zentralen AI-Datenversorgung.
            </p>
          </div>

          <div className="bg-gray-950 border border-green-800 rounded-xl p-4 min-w-[180px]">
            <p className="text-gray-400">Engine Health</p>
            <p className="text-green-400 text-2xl font-bold">Ready</p>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-5">
          <StatCard title="Symbols" value="4" subtitle="Registry ready" accent="text-blue-400" border="border-blue-900" />
          <StatCard title="Price Cache" value={marketPrices.length ? `${marketPrices.length}` : "0"} subtitle="Live mock prices" accent="text-green-400" border="border-green-900" />
          <StatCard title="Feed Router" value="Ready" subtitle="Priority logic" accent="text-purple-400" border="border-purple-900" />
          <StatCard title="Health Check" value="Active" subtitle="Feed monitoring" accent="text-cyan-400" border="border-cyan-900" />
          <StatCard title="AI Pipeline" value="Prepared" subtitle="GPT/Claude/Consensus" accent="text-yellow-400" border="border-yellow-900" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Feed Health</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="TradingView" value="Online" accent="text-green-400" />
            <StatusPill label="Capital.com" value="Planned" accent="text-yellow-400" />
            <StatusPill label="IC Markets" value="Prepared" accent="text-cyan-400" />
            <StatusPill label="Unified Feed" value="Later" accent="text-purple-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Symbol Registry</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="GOLD" value="XAUUSD" accent="text-yellow-400" />
            <StatusPill label="USOIL" value="USOIL" accent="text-orange-400" />
            <StatusPill label="EURUSD" value="EURUSD" accent="text-green-400" />
            <StatusPill label="BTCUSD" value="BTCUSD" accent="text-purple-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> Feed Priority</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Priority 1" value="Capital.com" accent="text-blue-400" />
            <StatusPill label="Priority 2" value="IC Markets" accent="text-cyan-400" />
            <StatusPill label="Priority 3" value="TradingView" accent="text-green-400" />
            <StatusPill label="Fallback" value="Cache" accent="text-yellow-400" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-2xl font-bold"> Live Price Cache</h3>
              <p className="text-gray-500 mt-2">
                Preise aus <span className="text-cyan-400">/api/market-data/prices</span>.
              </p>
            </div>

            <button
              type="button"
              onClick={loadMarketPrices}
              className="bg-cyan-950 border border-cyan-800 rounded-xl px-4 py-2 font-bold text-cyan-300 hover:bg-cyan-900 transition"
            >
              Refresh
            </button>
          </div>

          {pricesLoading && (
            <p className="text-gray-400 mt-6">Loading market prices...</p>
          )}

          {pricesError && (
            <p className="text-red-400 mt-6">{pricesError}</p>
          )}

          {!pricesLoading && !pricesError && (
            <div className="grid grid-cols-2 gap-4 mt-5">
              {marketPrices.map((price) => (
                <div key={price.symbol} className="bg-gray-950 border border-gray-800 rounded-xl p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold">{price.symbol}</p>
                    <p className="text-xs text-gray-500">{price.source}</p>
                  </div>

                  <p className="text-green-400 text-2xl font-black mt-3">
                    {price.bid}
                  </p>

                  <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                    <div>
                      <p className="text-gray-500">Ask</p>
                      <p className="text-cyan-400 font-bold">{price.ask}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Spread</p>
                      <p className="text-yellow-400 font-bold">{price.spread}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {lastPriceUpdate && (
            <p className="text-gray-500 mt-5 text-sm">
              Last update: {new Date(lastPriceUpdate).toLocaleString()}
            </p>
          )}
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold"> AI Data Pipeline</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Market Data" value="Prepared" accent="text-blue-400" />
            <StatusPill label="Market Regime" value="Prepared" accent="text-lime-400" />
            <StatusPill label="GPT Analyst" value="Prepared" accent="text-cyan-400" />
            <StatusPill label="Claude Risk" value="Prepared" accent="text-red-400" />
            <StatusPill label="Consensus" value="Required" accent="text-purple-400" />
          </div>
        </div>
      </div>

      <div className="bg-black border border-cyan-900 rounded-2xl p-6">
        <h3 className="text-2xl font-bold"> AI Connection Plan</h3>
        <p className="text-gray-300 mt-4 leading-relaxed">
          TradingView bleibt der visuelle Chart-Layer. Die AI-Entscheidungen werden spter ber eigene Marktdaten,
          Brokerdaten, News, Regime und Portfolio Intelligence gespeist. Dadurch vermeiden wir Lizenz- und API-Probleme
          und behalten die Kontrolle ber den Datafeed.
        </p>

        <div className="grid grid-cols-5 gap-4 mt-6">
          {["TradingView Chart", "Market Data", "GPT Analyst", "Claude Risk", "Consensus"].map((step) => (
            <div key={step} className="bg-gray-950 border border-gray-800 rounded-xl p-4">
              <p className="font-bold">{step}</p>
              <p className="text-green-400 mt-2">Prepared</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function renderActiveCenter(activeView: string, activeLabel: string) {
  if (activeView === "trading-journal") return <TradingJournalCenter />;
  if (activeView === "paper-trading") return <PaperTradingCenter />;
  if (activeView === "trading-desk") return <TradingDeskCenter />;
  if (activeView === "signal-engine") return <SignalEngineCenter />;
  if (activeView === "strategy-builder") return <StrategyBuilderCenter />;
  if (activeView === "ai-agent") return <AIAgentControlCenter />;
  if (activeView === "gpt-analyst") return <GPTAnalystLiveCenter />;
  if (activeView === "claude-risk") return <ClaudeRiskLiveCenter />;
  if (activeView === "market-data") return <MarketDataEngineCenter />;
  if (activeView === "news-layer") return <NewsLayerCenter />;
  if (activeView === "market-regime") return <MarketRegimeLiveCenter />;
  if (activeView === "portfolio-intelligence") return <PortfolioIntelligenceCenter />;
  if (activeView === "broker-center") return <BrokerCenter />;
  if (activeView === "security") return <SecurityCenterDashboard />;
  if (activeView === "settings") return <SettingsCenter />;
  if (activeView === "portfolio-brain") return <PortfolioBrainCenter />;
  if (activeView === "ai-consensus") return <ConsensusCenter />;
  if (activeView === "execution-center") return <ExecutionLiveCenter />;
  if (activeView === "strategy-evolution") return <EvolutionCenterPanel />;

  if (activeView === "forward-testing") return <ForwardTestingCenter />;

  if (
    activeView === "ai-memory" ||
    activeView === "learning-reports" ||
    activeView === "scheduler"
  ) {
    return <LearningCenter />;
  }

  return (
    <CenterPlaceholder
      title={`${activeLabel}`}
      subtitle="Professionelles Modul-Center. Diese Ansicht ist bewusst aus dem Hauptdashboard ausgelagert."
      cards={[
        {
          title: "Status",
          value: "Prepared",
          note: "Module architecture ready",
          accent: "text-green-400",
          border: "border-green-900",
        },
        {
          title: "Mode",
          value: "Simulation",
          note: "No live execution",
          accent: "text-purple-400",
          border: "border-purple-900",
        },
        {
          title: "Safety",
          value: "Locked",
          note: "Live trading blocked",
          accent: "text-red-400",
          border: "border-red-900",
        },
      ]}
    />
  );
}


export default function Home() {
  const [developerMode, setDeveloperMode] = useState(false);
  const [activeView, setActiveView] = useState("dashboard");

  const activeLabel =
    navGroups
      .flatMap((group) => group.items)
      .find((item) => item.view === activeView)?.label ?? "Mission Control";

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="flex">
        <aside className="w-80 min-h-screen sticky top-0 bg-gray-950 border-r border-gray-800 p-6 overflow-y-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-black leading-tight">AI Trading<br />System</h1>
            <p className="text-gray-500 mt-3 text-sm">Mission Control  V10.1.2</p>
          </div>

          <nav className="space-y-7">
            {navGroups.map((group) => (
              <div key={group.title}>
                <p className="text-xs uppercase tracking-[0.25em] text-gray-500 mb-3">
                  {group.title}
                </p>
                <div className="space-y-2">
                  {group.items.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setActiveView(item.view)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition ${
                        activeView === item.view
                          ? "bg-gray-900 text-white border border-gray-700"
                          : "text-gray-200 hover:bg-gray-900 hover:text-white"
                      }`}
                    >
                      <SidebarIcon code={item.icon} />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="mt-8 bg-black border border-gray-800 rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-bold">Developer Mode</p>
                <p className="text-gray-500 text-sm">Show architecture blocks</p>
              </div>
              <button
                onClick={() => setDeveloperMode((value) => !value)}
                className={`px-4 py-2 rounded-xl font-bold ${
                  developerMode
                    ? "bg-green-900 text-green-300 border border-green-700"
                    : "bg-gray-900 text-gray-400 border border-gray-700"
                }`}
              >
                {developerMode ? "ON" : "OFF"}
              </button>
            </div>
          </div>
        </aside>

        <section className="flex-1 p-10 max-w-[1700px] mx-auto" >
          {activeView === "dashboard" ? (
            <UnifiedMissionControlDashboard />
          ) : activeView === "live-prep" ? null : (
            renderActiveCenter(activeView, activeLabel)
          )}

          {(activeView === "dashboard" || activeView === "live-prep") && (
          <section className="bg-gray-900 border border-green-900 rounded-2xl p-7 mb-8" id="live-prep">
            <h3 className="text-3xl font-bold"> Live Trading Preparation</h3>
            <p className="text-gray-400 mt-2">
              Status bleibt sicher: Paper/Demo Only. Keine Live Orders ohne sptere Freigabe.
            </p>

            <div className="grid grid-cols-4 gap-5 mt-6">
              <StatusPill label="OpenAI Layer" value="Prepared" accent="text-green-400" />
              <StatusPill label="Claude Layer" value="Prepared" accent="text-red-400" />
              <StatusPill label="Broker API" value="Disconnected" accent="text-yellow-400" />
              <StatusPill label="Live Execution" value="Blocked" accent="text-red-400" />
            </div>
          </section>
          )}
        </section>
      </div>
    </main>
  );
}











