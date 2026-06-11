"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }).catch(() => null);
    const d = r ? await r.json().catch(() => null) : null;
    setLoading(false);
    if (d?.ok) {
      router.push("/");
      router.refresh();
    } else {
      setError(d?.error ?? "Login fehlgeschlagen");
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0f1a",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "monospace",
    }}>
      <div style={{
        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "16px", padding: "40px", width: "100%", maxWidth: "400px",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ fontSize: "32px", marginBottom: "8px" }}>📈</div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "#f1f5f9" }}>AI Trading System</div>
          <div style={{ fontSize: "11px", color: "#475569", marginTop: "4px" }}>
            Sichere Handelsplattform · DEMO Modus
          </div>
        </div>

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ fontSize: "11px", color: "#64748b", display: "block", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Benutzername
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Dein Benutzername..."
              autoComplete="username"
              required
              style={{
                width: "100%", boxSizing: "border-box",
                background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "8px", padding: "12px 14px", color: "#f1f5f9",
                fontSize: "14px", fontFamily: "monospace", outline: "none",
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: "11px", color: "#64748b", display: "block", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Passwort
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Dein Passwort..."
              autoComplete="current-password"
              required
              style={{
                width: "100%", boxSizing: "border-box",
                background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "8px", padding: "12px 14px", color: "#f1f5f9",
                fontSize: "14px", fontFamily: "monospace", outline: "none",
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: "10px 14px", background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px",
              fontSize: "12px", color: "#f87171",
            }}>
              ✗ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            style={{
              padding: "13px", borderRadius: "8px", border: "none", cursor: "pointer",
              background: loading ? "rgba(99,102,241,0.4)" : "rgba(99,102,241,0.8)",
              color: "#fff", fontSize: "14px", fontFamily: "monospace", fontWeight: 700,
              opacity: (!username || !password) ? 0.5 : 1,
              transition: "all 0.15s",
            }}
          >
            {loading ? "Anmelden..." : "▶ Einloggen"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "20px", fontSize: "12px", color: "#475569" }}>
          Kein Account?{" "}
          <a href="/register" style={{ color: "#818cf8", textDecoration: "none" }}>
            Registrieren
          </a>
        </div>

        {/* Default admin hint — only shown in dev */}
        {process.env.NODE_ENV !== "production" && (
          <div style={{
            marginTop: "24px", padding: "10px 14px",
            background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)",
            borderRadius: "8px", fontSize: "11px", color: "#92400e",
          }}>
            🔑 Standard-Admin: <strong>admin</strong> / <strong>admin123</strong>
            <br />Passwort nach erstem Login ändern!
          </div>
        )}
      </div>
    </div>
  );
}
