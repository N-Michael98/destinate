 "use client";

import React, { useState } from "react";

type NavItem = {
  label: string;
  icon: string;
  view: string;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    title: "Dashboard",
    items: [
      { label: "Mission Control", icon: "🏠", view: "dashboard" },
    ],
  },
  {
    title: "Trading",
    items: [
      { label: "Trading Journal", icon: "📒", view: "trading-journal" },
      { label: "Trading Desk", icon: "📈", view: "trading-desk" },
      { label: "Signal Engine", icon: "🎯", view: "signal-engine" },
      { label: "Strategy Builder", icon: "🧩", view: "strategy-builder" },
    ],
  },
  {
    title: "AI Center",
    items: [
      { label: "GPT Analyst", icon: "🧠", view: "gpt-analyst" },
      { label: "Claude Risk", icon: "🛡", view: "claude-risk" },
      { label: "Consensus", icon: "⚡", view: "ai-consensus" },
      { label: "Portfolio Brain", icon: "🤖", view: "portfolio-brain" },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { label: "Market Data", icon: "📊", view: "market-data" },
      { label: "News Layer", icon: "📰", view: "news-layer" },
      { label: "Market Regime", icon: "🌍", view: "market-regime" },
      { label: "Portfolio Intelligence", icon: "📌", view: "portfolio-intelligence" },
    ],
  },
  {
    title: "Execution",
    items: [
      { label: "Execution Center", icon: "⚡", view: "execution-center" },
      { label: "Broker Center", icon: "🔌", view: "broker-center" },
      { label: "Live Prep", icon: "🚀", view: "live-prep" },
    ],
  },
  {
    title: "Learning",
    items: [
      { label: "Forward Testing", icon: "🚀", view: "forward-testing" },
      { label: "AI Memory", icon: "🧠", view: "ai-memory" },
      { label: "Strategy Evolution", icon: "🧬", view: "strategy-evolution" },
      { label: "Learning Reports", icon: "📑", view: "learning-reports" },
      { label: "Scheduler", icon: "⏱️", view: "scheduler" },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Security Center", icon: "🔐", view: "security" },
      { label: "Settings", icon: "⚙️", view: "settings" },
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
        <h3 className="text-2xl font-bold">🚧 Module Page Prepared</h3>
        <p className="text-gray-400 mt-3 leading-relaxed">
          Dieser Bereich ist jetzt sauber vom Hauptdashboard getrennt. Als nächster Schritt bauen wir für dieses Center eine eigene professionelle Detailseite oder Komponente.
        </p>
      </div>
    </section>
  );
}


function GPTAnalystCenter() {
  return (
    <section className="bg-gray-900 border border-cyan-900 rounded-2xl p-8">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h2 className="text-4xl font-black">🧠 GPT Analyst Center</h2>
          <p className="text-gray-400 text-xl mt-3">
            OpenAI/GPT wird hier später Marktchancen, Setups, Strategien und Learning Reports analysieren.
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
          <h3 className="text-2xl font-bold">📈 Market Context</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Market Data" value="Prepared" accent="text-cyan-400" />
            <StatusPill label="News Intelligence" value="Prepared" accent="text-blue-400" />
            <StatusPill label="Market Regime" value="Prepared" accent="text-lime-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold">🎯 GPT Output Preview</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Signal" value="WAIT" accent="text-yellow-400" />
            <StatusPill label="Confidence" value="70%" accent="text-cyan-400" />
            <StatusPill label="Reasoning" value="Structured" accent="text-purple-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold">🛡 Safety</h3>
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
          <h2 className="text-4xl font-black">🛡 Claude Risk Center</h2>
          <p className="text-gray-400 text-xl mt-3">
            Claude wird hier Risiko, Drawdown, Portfolio-Exposure, Volatilität und Makro-Risiken kontrollieren.
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
          <h3 className="text-2xl font-bold">⚠️ Risk Checks</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Volatility Risk" value="Medium" accent="text-yellow-400" />
            <StatusPill label="Macro Risk" value="Watched" accent="text-orange-400" />
            <StatusPill label="News Risk" value="Prepared" accent="text-blue-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold">📉 Drawdown</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Current DD" value="0.73%" accent="text-green-400" />
            <StatusPill label="Max DD Limit" value="5%" accent="text-yellow-400" />
            <StatusPill label="Status" value="Safe" accent="text-green-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold">🔒 Permission</h3>
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
          <h2 className="text-4xl font-black">📊 Market Data Center</h2>
          <p className="text-gray-400 text-xl mt-3">
            Zentrale Daten-Schicht für Watchlist, Preise, News, Regime, Fundamentals und spätere TradingView/Yahoo/Capital.com Feeds.
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
          <h3 className="text-2xl font-bold">🔌 Data Providers</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Capital.com" value="Prepared" accent="text-cyan-400" />
            <StatusPill label="IC Markets" value="Prepared" accent="text-blue-400" />
            <StatusPill label="TradingView" value="Later" accent="text-yellow-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold">📰 Intelligence Feeds</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="News Layer" value="Prepared" accent="text-blue-400" />
            <StatusPill label="Economic Calendar" value="Later" accent="text-yellow-400" />
            <StatusPill label="Yahoo Finance" value="Later" accent="text-purple-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold">🌍 Regime Input</h3>
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
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h2 className="text-4xl font-black">🤖 Portfolio Brain Center</h2>
          <p className="text-gray-400 text-xl mt-3">
            Das zentrale Gehirn: Market Data, GPT, Claude, Agent, Regime, Portfolio Intelligence und Consensus werden hier zusammengeführt.
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
        <h3 className="text-2xl font-bold">🧭 Brain Flow</h3>
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
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h2 className="text-4xl font-black">📒 Trading Journal Center</h2>
          <p className="text-gray-400 text-xl mt-3">
            Zentrale Übersicht für Trades, Journal-Qualität, Equity, Performance und spätere AI-Auswertung.
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
          <h3 className="text-2xl font-bold">📝 Latest Trades</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="NAS100 Long" value="+4.2R" accent="text-green-400" />
            <StatusPill label="XAUUSD Long" value="+1.8R" accent="text-green-400" />
            <StatusPill label="USOIL Short" value="-1.0R" accent="text-red-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold">📊 Journal Analytics</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Best Strategy" value="Momentum" accent="text-green-400" />
            <StatusPill label="Weak Setup" value="Inventory" accent="text-yellow-400" />
            <StatusPill label="Review Status" value="Prepared" accent="text-blue-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold">🧠 AI Journal Link</h3>
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
          <h2 className="text-4xl font-black">📈 Trading Desk Center</h2>
          <p className="text-gray-400 text-xl mt-3">
            Professioneller Desk für Watchlist, Top Opportunity, Trade Setup, Risk/Reward und Demo-Trade-Planung.
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
          <h3 className="text-2xl font-bold">🎯 Setup Preview</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Market" value="XAUUSD" accent="text-yellow-400" />
            <StatusPill label="Direction" value="SELL" accent="text-red-400" />
            <StatusPill label="Strategy" value="Risk-Off Reaction" accent="text-blue-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold">🛡 Risk Plan</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Risk per Trade" value="1%" accent="text-green-400" />
            <StatusPill label="Stop Loss" value="Defined" accent="text-yellow-400" />
            <StatusPill label="Take Profit" value="Defined" accent="text-cyan-400" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold">🤖 AI Gate</h3>
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
          <h2 className="text-4xl font-black">🎯 Signal Engine Center</h2>
          <p className="text-gray-400 text-xl mt-3">
            Signalzentrale für technische, fundamentale, sentiment- und AI-basierte Signale.
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
          <h3 className="text-2xl font-bold">📉 Technical</h3>
          <p className="text-gray-400 mt-4">Trend, breakout, momentum, structure.</p>
        </div>
        <div className="bg-black border border-yellow-900 rounded-2xl p-6">
          <h3 className="text-2xl font-bold">🌍 Macro</h3>
          <p className="text-gray-400 mt-4">Economic calendar, rates, inflation, jobs.</p>
        </div>
        <div className="bg-black border border-green-900 rounded-2xl p-6">
          <h3 className="text-2xl font-bold">📰 News</h3>
          <p className="text-gray-400 mt-4">Market-moving headlines and sentiment.</p>
        </div>
        <div className="bg-black border border-purple-900 rounded-2xl p-6">
          <h3 className="text-2xl font-bold">🤖 AI</h3>
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
          <h2 className="text-4xl font-black">🧩 Strategy Builder Center</h2>
          <p className="text-gray-400 text-xl mt-3">
            Builder für Strategien, Regeln, Risk-Filter, Regime-Fit und spätere AI-Optimierung.
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


function renderActiveCenter(activeView: string, activeLabel: string) {
  if (activeView === "trading-journal") return <TradingJournalCenter />;
  if (activeView === "trading-desk") return <TradingDeskCenter />;
  if (activeView === "signal-engine") return <SignalEngineCenter />;
  if (activeView === "strategy-builder") return <StrategyBuilderCenter />;
  if (activeView === "gpt-analyst") return <GPTAnalystCenter />;
  if (activeView === "claude-risk") return <ClaudeRiskCenter />;
  if (activeView === "market-data") return <MarketDataCenter />;
  if (activeView === "portfolio-brain") return <PortfolioBrainCenter />;

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
            <p className="text-gray-500 mt-3 text-sm">Mission Control · V9.3.4</p>
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
                      <span>{item.icon}</span>
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
          {activeView === "dashboard" && (
            <>
          <div className="flex items-start justify-between gap-8 mb-10">
            <div>
              <h2 className="text-5xl font-black">Willkommen Michael 👊</h2>
              <p className="text-gray-400 text-xl mt-4">
                AI Trading Mission Control · V9.3.4 Interactive Centers
              </p>
            </div>

            <div className="bg-gray-950 border border-green-900 rounded-2xl p-5 min-w-[220px]">
              <p className="text-gray-400">System Status</p>
              <p className="text-green-400 text-2xl font-bold mt-1">Operational</p>
              <p className="text-gray-500 mt-2 text-sm">Paper/Demo only</p>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-6 mb-8">
            <StatCard
              title="💰 Balance"
              value="30'000 CHF"
              subtitle="Paper Account"
              accent="text-green-400"
              border="border-green-900"
            />
            <StatCard
              title="📈 Equity"
              value="30'120 CHF"
              subtitle="Floating Equity"
              accent="text-cyan-400"
              border="border-cyan-900"
            />
            <StatCard
              title="📊 Closed P/L"
              value="120 CHF"
              subtitle="Closed paper trades"
              accent="text-green-400"
              border="border-blue-900"
            />
            <StatCard
              title="⚡ Open P/L"
              value="0 CHF"
              subtitle="No open exposure"
              accent="text-yellow-400"
              border="border-yellow-900"
            />
            <StatCard
              title="🧠 Engine Health"
              value="Strong"
              subtitle="Core architecture"
              accent="text-purple-400"
              border="border-purple-900"
            />
          </div>

          <div className="grid grid-cols-3 gap-8 mb-8">
            <section className="bg-gray-900 border border-blue-900 rounded-2xl p-7">
              <h3 className="text-3xl font-bold">🎯 Top Opportunity</h3>
              <p className="text-blue-400 text-5xl mt-6 font-black">Gold</p>
              <p className="text-gray-400 mt-2">Commodities · Risk sentiment</p>

              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="bg-black border border-gray-800 rounded-xl p-4">
                  <p className="text-gray-400">Direction</p>
                  <p className="text-red-400 font-bold text-xl">SELL</p>
                </div>
                <div className="bg-black border border-gray-800 rounded-xl p-4">
                  <p className="text-gray-400">Confidence</p>
                  <p className="text-cyan-400 font-bold text-xl">91%</p>
                </div>
                <div className="bg-black border border-gray-800 rounded-xl p-4">
                  <p className="text-gray-400">Score</p>
                  <p className="text-blue-400 font-bold text-xl">85</p>
                </div>
                <div className="bg-black border border-gray-800 rounded-xl p-4">
                  <p className="text-gray-400">Risk/Reward</p>
                  <p className="text-yellow-400 font-bold text-xl">1:2.8</p>
                </div>
              </div>

              <a className="inline-block text-blue-400 font-bold mt-6" href="#trading-desk">
                Analyse öffnen →
              </a>
            </section>

            <section className="bg-gray-900 border border-purple-900 rounded-2xl p-7" id="ai-consensus">
              <h3 className="text-3xl font-bold">🤖 AI Consensus</h3>

              <div className="space-y-4 mt-6">
                <StatusPill label="GPT Analyst" value="WAIT" accent="text-yellow-400" />
                <StatusPill label="Claude Risk Analyst" value="WAIT" accent="text-yellow-400" />
                <StatusPill label="System Decision" value="BUY" accent="text-green-400" />
              </div>

              <div className="bg-purple-950 border border-purple-700 rounded-xl p-5 mt-6">
                <p className="text-gray-400">Consensus Score</p>
                <p className="text-purple-300 text-4xl font-black">82%</p>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-5">
                <div className="bg-black border border-gray-800 rounded-xl p-4">
                  <p className="text-gray-400">GPT Trade Analyst</p>
                  <p className="text-cyan-400 text-2xl font-bold">68/100</p>
                </div>
                <div className="bg-black border border-gray-800 rounded-xl p-4">
                  <p className="text-gray-400">Claude Risk</p>
                  <p className="text-red-400 text-2xl font-bold">88/100</p>
                </div>
              </div>
            </section>

            <section className="bg-gray-900 border border-red-900 rounded-2xl p-7">
              <h3 className="text-3xl font-bold">🛡 Risk Monitor</h3>

              <div className="mt-6 space-y-5">
                <div>
                  <div className="flex justify-between mb-2">
                    <p className="text-gray-300">Open Risk Exposure</p>
                    <p>0</p>
                  </div>
                  <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 w-[5%]" />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <p className="text-gray-300">Max Drawdown</p>
                    <p>0.73%</p>
                  </div>
                  <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-red-400 w-[15%]" />
                  </div>
                </div>

                <div className="bg-black border border-gray-800 rounded-xl p-5">
                  <p className="text-gray-400">Risk Status</p>
                  <p className="text-green-400 text-4xl font-black">SAFE</p>
                </div>
              </div>
            </section>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8">
            <section className="bg-gray-900 border border-cyan-900 rounded-2xl p-7">
              <h3 className="text-3xl font-bold">📂 Open Positions</h3>
              <p className="text-gray-500 mt-8">Keine offenen Paper Positionen.</p>
              <a className="inline-block text-cyan-400 font-bold mt-6" href="#execution-center">
                Paper Trading öffnen →
              </a>
            </section>

            <section className="bg-gray-900 border border-blue-900 rounded-2xl p-7">
              <h3 className="text-3xl font-bold">📈 Equity Curve Snapshot</h3>
              <div className="bg-black border border-gray-800 rounded-2xl h-56 mt-6 flex items-end justify-around px-8 pb-8">
                <div className="w-16 bg-blue-950 rounded-t-xl h-16 border border-blue-900" />
                <div className="w-16 bg-blue-950 rounded-t-xl h-28 border border-blue-900" />
                <div className="w-16 bg-blue-950 rounded-t-xl h-40 border border-blue-900" />
              </div>

              <div className="grid grid-cols-3 gap-4 mt-5">
                <div className="bg-black border border-gray-800 rounded-xl p-4">
                  <p className="text-gray-400">Peak Equity</p>
                  <p className="text-yellow-400 font-bold">30'120 CHF</p>
                </div>
                <div className="bg-black border border-gray-800 rounded-xl p-4">
                  <p className="text-gray-400">Profit Factor</p>
                  <p className="text-blue-400 font-bold">2.2</p>
                </div>
                <div className="bg-black border border-gray-800 rounded-xl p-4">
                  <p className="text-gray-400">Expectancy</p>
                  <p className="text-green-400 font-bold">60 CHF</p>
                </div>
              </div>
            </section>
          </div>

          <section className="bg-gray-900 border border-gray-800 rounded-2xl p-7 mb-8">
            <h3 className="text-3xl font-bold">🧭 Core Centers</h3>
            <p className="text-gray-400 mt-2">
              Die großen Architekturblöcke sind jetzt als professionelle Center vorbereitet, statt alle Details im Dashboard zu zeigen.
            </p>

            <div className="grid grid-cols-4 gap-5 mt-6">
              <ModuleCard
                title="AI Center"
                description="GPT, Claude, Consensus und Portfolio Brain."
                score="Ready"
                status="V9.2"
                accent="text-purple-400"
                href="#gpt-analyst"
              />
              <ModuleCard
                title="Execution Center"
                description="Broker, Demo Auth, Paper Execution und Live Prep."
                score="Paper Only"
                status="Safe"
                accent="text-yellow-400"
                href="#execution-center"
              />
              <ModuleCard
                title="Intelligence Center"
                description="Market Data, News, Regime und Portfolio Intelligence."
                score="Prepared"
                status="Data"
                accent="text-cyan-400"
                href="#market-data"
              />
              <ModuleCard
                title="Learning Center"
                description="Forward Testing, AI Memory, Reports und Scheduler."
                score="Loop Ready"
                status="Learning"
                accent="text-green-400"
                href="#learning-reports"
              />
            </div>
          </section>

          {developerMode && (
            <section className="bg-gray-900 border border-orange-900 rounded-2xl p-7 mb-8">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <h3 className="text-3xl font-bold">🛠 Developer Architecture Mode</h3>
                  <p className="text-gray-400 mt-2">
                    Technische Roadmap- und Architektur-Übersicht. Standardmäßig versteckt, damit das Dashboard professionell clean bleibt.
                  </p>
                </div>

                <div className="bg-black border border-orange-800 rounded-xl p-4">
                  <p className="text-gray-400">Visible</p>
                  <p className="text-orange-400 text-2xl font-bold">ON</p>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-4 mt-6">
                {[
                  "V7 Broker Layer",
                  "V7.5 Market Data",
                  "V7.6 Intelligence",
                  "V7.7 Forward Testing",
                  "V7.8 AI Memory",
                  "V7.9 Evolution",
                  "V8.0 Demo Agent",
                  "V8.5 Reports",
                  "V8.7 Consensus",
                  "V8.8 Regime",
                  "V8.9 Portfolio",
                  "V9.0 Brain",
                  "V9.1 OpenAI",
                  "V9.2 Claude",
                  "V9.3 Refactor",
                ].map((item) => (
                  <div key={item} className="bg-black border border-gray-800 rounded-xl p-4">
                    <p className="font-bold">{item}</p>
                    <p className="text-green-400 mt-2">Prepared</p>
                  </div>
                ))}
              </div>
            </section>
          )}


            </>
          )}

          {activeView !== "dashboard" && renderActiveCenter(activeView, activeLabel)}

          {(activeView === "dashboard" || activeView === "live-prep") && (
          <section className="bg-gray-900 border border-green-900 rounded-2xl p-7 mb-8" id="live-prep">
            <h3 className="text-3xl font-bold">🚀 Live Trading Preparation</h3>
            <p className="text-gray-400 mt-2">
              Status bleibt sicher: Paper/Demo Only. Keine Live Orders ohne spätere Freigabe.
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
