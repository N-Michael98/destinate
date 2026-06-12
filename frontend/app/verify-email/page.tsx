"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function VerifyContent() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) { setStatus("error"); setMessage("Kein Bestätigungs-Token gefunden."); return; }
    fetch(`/api/auth/verify-email?token=${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) { setStatus("ok"); setMessage("E-Mail erfolgreich bestätigt! Der Admin wird deinen Account freigeben."); }
        else { setStatus("error"); setMessage(d.error ?? "Ungültiger Link."); }
      })
      .catch(() => { setStatus("error"); setMessage("Verbindungsfehler."); });
  }, [token]);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1a", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace" }}>
      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", padding: "40px", maxWidth: "420px", width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: "40px", marginBottom: "16px" }}>
          {status === "loading" ? "⏳" : status === "ok" ? "✅" : "❌"}
        </div>
        <div style={{ fontSize: "18px", fontWeight: 700, color: "#f1f5f9", marginBottom: "12px" }}>
          {status === "loading" ? "Bestätige E-Mail..." : status === "ok" ? "E-Mail bestätigt!" : "Fehler"}
        </div>
        <div style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "24px" }}>{message}</div>
        {status !== "loading" && (
          <a href="/login" style={{ display: "inline-block", padding: "11px 24px", background: "rgba(99,102,241,0.3)", border: "1px solid rgba(99,102,241,0.5)", borderRadius: "8px", color: "#a5b4fc", textDecoration: "none", fontSize: "13px", fontWeight: 700 }}>
            Zum Login →
          </a>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return <Suspense><VerifyContent /></Suspense>;
}
