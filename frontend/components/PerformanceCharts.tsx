"use client";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

// ── Equity Curve ─────────────────────────────────────────────────────────────
const equityData = [
  { day: "D1", equity: 10000 },
  { day: "D2", equity: 10180 },
  { day: "D3", equity: 10420 },
  { day: "D4", equity: 10310 },
  { day: "D5", equity: 10590 },
  { day: "D6", equity: 10480 },
  { day: "D7", equity: 10760 },
  { day: "D8", equity: 10920 },
  { day: "D9", equity: 11150 },
  { day: "D10", equity: 11340 },
  { day: "D11", equity: 11220 },
  { day: "D12", equity: 11480 },
];

export function EquityCurveChart() {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "10px",
      border: "1px solid rgba(255,255,255,0.08)", padding: "16px" }}>
      <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        Equity Curve (Paper)
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={equityData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10c96d" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#10c96d" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="day" tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false}
            tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} domain={["dataMin - 200", "dataMax + 200"]} />
          <Tooltip
            contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "11px" }}
            labelStyle={{ color: "#94a3b8" }}
            formatter={(v) => [`$${Number(v ?? 0).toLocaleString()}`, "Equity"]}
          />
          <Area type="monotone" dataKey="equity" stroke="#10c96d" strokeWidth={2} fill="url(#equityGrad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Win/Loss by Symbol ────────────────────────────────────────────────────────
const symbolPerfData = [
  { symbol: "XAUUSD", wins: 8, losses: 3 },
  { symbol: "EURUSD", wins: 5, losses: 4 },
  { symbol: "NAS100", wins: 7, losses: 2 },
  { symbol: "USOIL",  wins: 3, losses: 5 },
  { symbol: "BTCUSD", wins: 2, losses: 2 },
  { symbol: "SPX500", wins: 6, losses: 1 },
];

export function WinLossBarChart() {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "10px",
      border: "1px solid rgba(255,255,255,0.08)", padding: "16px" }}>
      <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        Win / Loss by Symbol
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={symbolPerfData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="symbol" tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "11px" }}
            labelStyle={{ color: "#94a3b8" }}
          />
          <Bar dataKey="wins" name="Wins" fill="#10c96d" radius={[3, 3, 0, 0]} />
          <Bar dataKey="losses" name="Losses" fill="#f87171" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Monthly PnL Bar Chart ─────────────────────────────────────────────────────
const monthlyPnL = [
  { month: "Jan", pnl: 420 },
  { month: "Feb", pnl: -180 },
  { month: "Mar", pnl: 870 },
  { month: "Apr", pnl: 640 },
  { month: "May", pnl: -90 },
  { month: "Jun", pnl: 1150 },
];

export function MonthlyPnLChart() {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "10px",
      border: "1px solid rgba(255,255,255,0.08)", padding: "16px" }}>
      <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        Monthly PnL ($)
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={monthlyPnL} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="month" tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false}
            tickFormatter={(v) => `$${v}`} />
          <Tooltip
            contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "11px" }}
            labelStyle={{ color: "#94a3b8" }}
            formatter={(v) => [`$${Number(v ?? 0)}`, "PnL"]}
          />
          <Bar dataKey="pnl" radius={[3, 3, 0, 0]}
            fill="#6366f1"
            label={false}
          >
            {monthlyPnL.map((entry, i) => (
              <Cell key={i} fill={entry.pnl >= 0 ? "#10c96d" : "#f87171"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Portfolio Allocation Donut ────────────────────────────────────────────────
const allocationData = [
  { name: "XAUUSD", value: 28, color: "#fbbf24" },
  { name: "NAS100", value: 22, color: "#00c3ff" },
  { name: "EURUSD", value: 18, color: "#10c96d" },
  { name: "SPX500", value: 16, color: "#a5b4fc" },
  { name: "USOIL",  value: 10, color: "#fb923c" },
  { name: "BTCUSD", value: 6,  color: "#e879f9" },
];

export function PortfolioAllocationChart() {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "10px",
      border: "1px solid rgba(255,255,255,0.08)", padding: "16px" }}>
      <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        Portfolio Allocation
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={allocationData}
            cx="50%"
            cy="50%"
            innerRadius={52}
            outerRadius={78}
            paddingAngle={3}
            dataKey="value"
          >
            {allocationData.map((entry, i) => (
              <Cell key={i} fill={entry.color} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "11px" }}
            formatter={(v) => [`${Number(v ?? 0)}%`, "Allocation"]}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: "10px", color: "#64748b" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Forward Test Results Line Chart ──────────────────────────────────────────
interface FtDataPoint {
  trade: number;
  cumPnl: number;
  winRate: number;
}

export function ForwardTestResultsChart({ data }: { data?: FtDataPoint[] }) {
  const chartData = data ?? Array.from({ length: 20 }, (_, i) => ({
    trade: i + 1,
    cumPnl: Math.round((Math.sin(i * 0.6) * 300 + i * 45) * 10) / 10,
    winRate: Math.round(55 + Math.sin(i * 0.4) * 12),
  }));

  return (
    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "10px",
      border: "1px solid rgba(255,255,255,0.08)", padding: "16px" }}>
      <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        Forward Test — Cumulative PnL ($)
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="trade" tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false}
            label={{ value: "Trade #", position: "insideBottom", offset: -2, fill: "#475569", fontSize: 9 }} />
          <YAxis tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false}
            tickFormatter={(v) => `$${v}`} />
          <Tooltip
            contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "11px" }}
            labelStyle={{ color: "#94a3b8" }}
            labelFormatter={(l) => `Trade #${l}`}
            formatter={(v) => [`$${Number(v ?? 0)}`, "Cum. PnL"]}
          />
          <Line type="monotone" dataKey="cumPnl" stroke="#6366f1" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Win Rate Trend Line ───────────────────────────────────────────────────────
export function WinRateTrendChart({ data }: { data?: FtDataPoint[] }) {
  const chartData = data ?? Array.from({ length: 20 }, (_, i) => ({
    trade: i + 1,
    winRate: Math.round(55 + Math.sin(i * 0.4) * 12),
    cumPnl: 0,
  }));

  return (
    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "10px",
      border: "1px solid rgba(255,255,255,0.08)", padding: "16px" }}>
      <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        Win Rate Trend (%)
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="trade" tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false}
            tickFormatter={(v) => `${v}%`} domain={[30, 90]} />
          <Tooltip
            contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "11px" }}
            labelStyle={{ color: "#94a3b8" }}
            labelFormatter={(l) => `Trade #${l}`}
            formatter={(v) => [`${Number(v ?? 0)}%`, "Win Rate"]}
          />
          <Line type="monotone" dataKey="winRate" stroke="#fbbf24" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
