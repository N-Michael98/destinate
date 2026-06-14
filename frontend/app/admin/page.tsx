"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function fetchUsers() {
    setLoading(true);
    const res = await fetch("/api/auth/users");
    if (res.status === 403) { router.push("/"); return; }
    const data = await res.json();
    if (data.ok) setUsers(data.users);
    else setError(data.error || "Fehler beim Laden");
    setLoading(false);
  }

  async function doAction(action: "approve" | "delete", userId: string) {
    setActionLoading(userId + action);
    const res = await fetch("/api/auth/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, userId }),
    });
    const data = await res.json();
    if (data.ok) await fetchUsers();
    else alert(data.error || "Fehler");
    setActionLoading(null);
  }

  useEffect(() => { fetchUsers(); }, []);

  const pending = users.filter(u => u.status === "PENDING_APPROVAL");
  const active = users.filter(u => u.status === "ACTIVE" && u.role !== "ADMIN");
  const admins = users.filter(u => u.role === "ADMIN");

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      ACTIVE: "bg-green-500/20 text-green-400 border-green-500/30",
      PENDING_APPROVAL: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    };
    const labels: Record<string, string> = {
      ACTIVE: "Aktiv",
      PENDING_APPROVAL: "Wartet auf Genehmigung",
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs border ${colors[status] || "bg-gray-500/20 text-gray-400 border-gray-500/30"}`}>
        {labels[status] || status}
      </span>
    );
  };

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Master Admin Panel</h1>
            <p className="text-gray-400 text-sm mt-1">Benutzerverwaltung — Destinate</p>
          </div>
          <button onClick={() => router.push("/")} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm transition-colors">
            ← Zurück
          </button>
        </div>

        {error && <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>}

        {loading ? (
          <div className="text-center py-20 text-gray-400">Lade Benutzer...</div>
        ) : (
          <>
            {/* Pending Approval */}
            <section className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-lg font-semibold">Wartet auf Genehmigung</h2>
                {pending.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 text-xs font-bold">
                    {pending.length}
                  </span>
                )}
              </div>
              {pending.length === 0 ? (
                <div className="rounded-xl border border-white/5 bg-white/2 p-6 text-center text-gray-500 text-sm">
                  Keine ausstehenden Registrierungen
                </div>
              ) : (
                <div className="space-y-3">
                  {pending.map(u => (
                    <div key={u.id} className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{u.username}</span>
                          {statusBadge(u.status)}
                        </div>
                        <div className="text-sm text-gray-400 mt-0.5">{u.email}</div>
                        <div className="text-xs text-gray-500 mt-0.5">Registriert: {formatDate(u.createdAt)}</div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => doAction("approve", u.id)}
                          disabled={!!actionLoading}
                          className="px-4 py-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          {actionLoading === u.id + "approve" ? "..." : "✓ Genehmigen"}
                        </button>
                        <button
                          onClick={() => doAction("delete", u.id)}
                          disabled={!!actionLoading}
                          className="px-4 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          {actionLoading === u.id + "delete" ? "..." : "✕ Ablehnen"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Active Users */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold mb-4">Aktive Benutzer</h2>
              {active.length === 0 ? (
                <div className="rounded-xl border border-white/5 bg-white/2 p-6 text-center text-gray-500 text-sm">
                  Keine aktiven Benutzer
                </div>
              ) : (
                <div className="rounded-xl border border-white/5 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-white/3 border-b border-white/5">
                      <tr>
                        <th className="text-left px-4 py-3 text-gray-400 font-medium">Benutzer</th>
                        <th className="text-left px-4 py-3 text-gray-400 font-medium">E-Mail</th>
                        <th className="text-left px-4 py-3 text-gray-400 font-medium">Letzter Login</th>
                        <th className="text-left px-4 py-3 text-gray-400 font-medium">Status</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {active.map(u => (
                        <tr key={u.id} className="hover:bg-white/2 transition-colors">
                          <td className="px-4 py-3 font-medium">{u.username}</td>
                          <td className="px-4 py-3 text-gray-400">{u.email}</td>
                          <td className="px-4 py-3 text-gray-400">{formatDate(u.lastLoginAt)}</td>
                          <td className="px-4 py-3">{statusBadge(u.status)}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => { if (confirm(`Benutzer "${u.username}" wirklich löschen?`)) doAction("delete", u.id); }}
                              disabled={!!actionLoading}
                              className="px-3 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs transition-colors disabled:opacity-50"
                            >
                              Löschen
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Admins */}
            <section>
              <h2 className="text-lg font-semibold mb-4">Administratoren</h2>
              <div className="rounded-xl border border-white/5 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-white/3 border-b border-white/5">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-400 font-medium">Benutzer</th>
                      <th className="text-left px-4 py-3 text-gray-400 font-medium">E-Mail</th>
                      <th className="text-left px-4 py-3 text-gray-400 font-medium">Letzter Login</th>
                      <th className="text-left px-4 py-3 text-gray-400 font-medium">Rolle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {admins.map(u => (
                      <tr key={u.id} className="hover:bg-white/2 transition-colors">
                        <td className="px-4 py-3 font-medium">{u.username}</td>
                        <td className="px-4 py-3 text-gray-400">{u.email}</td>
                        <td className="px-4 py-3 text-gray-400">{formatDate(u.lastLoginAt)}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs border bg-purple-500/20 text-purple-400 border-purple-500/30">
                            Master Admin
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
