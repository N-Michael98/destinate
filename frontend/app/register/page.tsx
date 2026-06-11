"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", email: "", password: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError("Passwörter stimmen nicht überein");
      return;
    }
    setLoading(true);
    setError(null);
    const r = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: form.username, email: form.email, password: form.password }),
    }).catch(() => null);
    const d = r ? await r.json().catch(() => null) : null;
    setLoading(false);
    if (d?.ok) {
      setSuccess(d.message);
    } else {
      setError(d?.error ?? "Registrierung fehlgeschlagen");
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
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{ fontSize: "28px", marginBottom: "8px" }}>📈</div>
          <div style={{ fontSize: "18px", fontWeight: 700, color: "#f1f5f9" }}>Account erstellen</div>
          <div style={{ fontSize: "11px", color: "#475569", marginTop: "4px" }}>
            Neuer Account benötigt Admin-Freigabe
          </div>
        </div>

        {success ? (
          <div style={{ textAlign: "center" }}>
            <div style={{
              padding: "16px", background: "rgba(16,201,109,0.1)",
              border: "1px solid rgba(16,201,109,0.3)", borderRadius: "8px",
              fontSize: "13px", color: "#10c96d", marginBottom: "20px",
            }}>
              ✓ {success}
            </div>
            <a href="/login" style={{
              display: "block", padding: "12px", borderRadius: "8px",
              background: "rgba(99,102,241,0.2)", color: "#818cf8",
              fontSize: "13px", textDecoration: "none", textAlign: "center",
            }}>
              Zum Login →
            </a>
          </div>
        ) : (
          <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {[
              { key: "username" as const, label: "Benutzername", type: "text", placeholder: "Dein Benutzername...", autoComplete: "username" },
              { key: "email" as const, label: "E-Mail", type: "email", placeholder: "deine@email.com", autoComplete: "email" },
              { key: "password" as const, label: "Passwort", type: "password", placeholder: "Mindestens 8 Zeichen...", autoComplete: "new-password" },
              { key: "confirmPassword" as const, label: "Passwort wiederholen", type: "password", placeholder: "Passwort bestätigen...", autoComplete: "new-password" },
            ].map(({ key, label, type, placeholder, autoComplete }) => (
              <div key={key}>
                <label style={{ fontSize: "11px", color: "#64748b", display: "block", marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {label}
                </label>
                <input
                  type={type}
                  value={form[key]}
                  onChange={set(key)}
                  placeholder={placeholder}
                  autoComplete={autoComplete}
                  required
                  style={{
                    width: "100%", boxSizing: "border-box",
                    background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: "8px", padding: "11px 13px", color: "#f1f5f9",
                    fontSize: "13px", fontFamily: "monospace", outline: "none",
                  }}
                />
              </div>
            ))}

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
              disabled={loading}
              style={{
                padding: "12px", borderRadius: "8px", border: "none", cursor: "pointer",
                background: "rgba(99,102,241,0.7)", color: "#fff",
                fontSize: "13px", fontFamily: "monospace", fontWeight: 700,
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "Registrieren..." : "Account erstellen"}
            </button>
          </form>
        )}

        <div style={{ textAlign: "center", marginTop: "18px", fontSize: "12px", color: "#475569" }}>
          Bereits registriert?{" "}
          <a href="/login" style={{ color: "#818cf8", textDecoration: "none" }}>Einloggen</a>
        </div>
      </div>
    </div>
  );
}
