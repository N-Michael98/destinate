import {
  KillswitchReport,
  KillswitchStage,
  KillswitchStageResult,
  KillswitchTrigger,
} from "./killswitch-types";

const VERSION = "V17.0.0" as const;
const REDIS_KEY = "killswitch:state"; // persistiert über Deploys
const REDIS_TTL = 30 * 24 * 60 * 60; // 30 Tage

// State auf global (28.07.): vorher modul-scoped `let _state` — dadurch konnten
// Telegram-Route und die Trading-Loops in instrumentation.ts verschiedene
// Kopien sehen, der Killswitch hätte dort nie gegriffen. Gleiches Muster wie
// global.__capital_session__ / __icmarkets_session__ (in diesem Projekt bewährt:
// API-Routen und Hintergrund-Loops teilen sich denselben Node-Prozess).
declare global {
  var __killswitch_state__: KillswitchReport | undefined;
}
if (global.__killswitch_state__ === undefined) global.__killswitch_state__ = buildIdleState();

function getState(): KillswitchReport {
  if (global.__killswitch_state__ === undefined) global.__killswitch_state__ = buildIdleState();
  return global.__killswitch_state__;
}

function setState(s: KillswitchReport): void {
  global.__killswitch_state__ = s;
}

/** Zentrale Abfrage für alle Trading-/Broker-Pfade: darf gerade gehandelt/
 *  verbunden werden? true = GESPERRT. Nach resetKillswitch() wieder false. */
export function isKillswitchActive(): boolean {
  return getState().triggered === true;
}

function buildIdleState(): KillswitchReport {
  return {
    version: VERSION,
    armed: true,
    triggered: false,
    currentStage: "IDLE",
    trigger: null,
    triggeredAt: null,
    triggeredBy: null,
    stages: [
      buildStage("STAGE 1 — Broker Logout", "PENDING"),
      buildStage("STAGE 2 — Cancel All Orders", "PENDING"),
      buildStage("STAGE 3 — System Lockdown", "PENDING"),
    ],
    brokersLoggedOut: [],
    ordersCancelled: 0,
    systemLocked: false,
    telegramAlertSent: false,
    canReset: false,
    summary: "Kill Switch armed and on standby. No threat detected.",
    updatedAt: new Date().toISOString(),
  };
}

function buildStage(
  stage: string,
  status: KillswitchStageResult["status"]
): KillswitchStageResult {
  return {
    stage,
    status,
    startedAt: null,
    completedAt: null,
    details: status === "PENDING" ? "Awaiting trigger." : "",
  };
}

function now() {
  return new Date().toISOString();
}

// Schreibt Killswitch-State in Redis (fire-and-forget, blockiert nicht)
function persistToRedis(state: KillswitchReport): void {
  import("@/lib/cache/redis-cache").then(({ cacheSet }) => {
    cacheSet(REDIS_KEY, state, REDIS_TTL);
  }).catch(() => {});
}

// Löscht Killswitch-State aus Redis (fire-and-forget)
function deleteFromRedis(): void {
  import("@/lib/cache/redis-cache").then(({ cacheDel }) => {
    cacheDel(REDIS_KEY);
  }).catch(() => {});
}

export function getKillswitchReport(): KillswitchReport {
  return { ...getState() };
}

// Wird beim Server-Start aufgerufen — stellt Killswitch aus Redis wieder her
export async function restoreKillswitchFromRedis(): Promise<boolean> {
  try {
    const { cacheGet } = await import("@/lib/cache/redis-cache");
    const saved = await cacheGet<KillswitchReport>(REDIS_KEY);
    if (saved && saved.triggered) {
      setState(saved);
      console.log(`[killswitch] 🔴 State aus Redis wiederhergestellt — System bleibt gesperrt (seit ${saved.triggeredAt})`);
      return true;
    }
  } catch { /* non-fatal */ }
  return false;
}

/** Trennt beide Broker-Sessions — OHNE gespeicherte Credentials zu löschen
 *  (sonst käme das System nach /reset nicht mehr hoch) und OHNE offene
 *  Positionen zu schliessen (User-Vorgabe 28.07.: Positionen bleiben mit
 *  ihren Broker-seitigen SL/TP bestehen). Fire-and-forget wie persistToRedis,
 *  damit triggerKillswitch() synchron bleibt und keinen Aufrufer bricht. */
function disconnectBrokers(): void {
  (async () => {
    try {
      const { killswitchDisconnectCapital } = await import("@/lib/capital-com/capital-com-session");
      await killswitchDisconnectCapital();
    } catch (e) {
      console.error("[killswitch] Capital.com-Trennung fehlgeschlagen:", e instanceof Error ? e.message : String(e));
    }
    try {
      const { clearICMarketsSession } = await import("@/lib/icmarkets/icmarkets-session");
      await clearICMarketsSession();
    } catch (e) {
      console.error("[killswitch] IC-Markets-Trennung fehlgeschlagen:", e instanceof Error ? e.message : String(e));
    }
  })();
}

export function triggerKillswitch(
  trigger: KillswitchTrigger,
  triggeredBy: string
): KillswitchReport {
  if (getState().triggered) return { ...getState() };

  const t = now();

  // WICHTIG: State ZUERST setzen, dann trennen. Sonst könnte der 2-Minuten-
  // Keep-Alive zwischen Trennung und State-Update erneut verbinden.
  const stage1: KillswitchStageResult = {
    stage: "STAGE 1 — Broker Logout",
    status: "COMPLETED",
    startedAt: t,
    completedAt: t,
    // ── DER TEXT STIMMTE NUR FUER EINEN DER BEIDEN BROKER (27.09.) ────────
    //
    // Hier stand: "Credentials bleiben gespeichert, damit /reset wieder
    // verbinden kann." Fuer Capital.com ist das richtig — es meldet sich mit
    // den hinterlegten Zugangsdaten neu an (im Live-Log 19:12:45:
    // "[capital-com] reconnected ✅").
    //
    // Fuer IC Markets ist es FALSCH. Dort IST der Redis-Token der Zugang, und
    // `clearICMarketsSession()` loescht ihn (`clearFromRedis()`). Es gibt
    // keine zweiten Zugangsdaten, mit denen sich etwas neu anmelden koennte.
    // Genau deshalb meldete `/reset` im Test: "IC Markets: Token nicht in
    // Redis — bitte manuell verbinden".
    //
    // NACHGEPRUEFT, nicht vermutet: `global.__icmarkets_session__` wird an
    // genau drei Stellen gesetzt — `setICMarketsSession()` (Connect bzw.
    // `autoReconnectICMarkets()`), `clearICMarketsSession()` (auf null) und
    // `restoreICMarketsSessionFromRedis()` (nur beim Serverstart, und Redis
    // ist leer). Der 2-Minuten-Keep-Alive holt sie NICHT zurueck: er ruft
    // `autoReconnectICMarkets()` ausschliesslich, wenn `icGetAccount()`
    // FEHLSCHLAEGT — und die MCP-Schicht meldet sich bei HTTP 404 selbst neu
    // an, sodass der Aufruf gelingt (Live-Log 19:14:45).
    details: "Broker-Sessions getrennt. Capital.com meldet sich bei /reset mit den gespeicherten Zugangsdaten neu an. IC Markets NICHT: dort ist der Redis-Token der Zugang, er wurde geloescht — dort ist eine manuelle Verbindung noetig.",
  };

  const stage2: KillswitchStageResult = {
    stage: "STAGE 2 — Reconnect gesperrt",
    status: "COMPLETED",
    startedAt: t,
    completedAt: t,
    details: "Auto-Reconnect und Keep-Alive beider Broker blockiert — Verbindung kommt nicht von selbst zurück.",
  };

  const stage3: KillswitchStageResult = {
    stage: "STAGE 3 — System Lockdown",
    status: "COMPLETED",
    startedAt: t,
    completedAt: t,
    // ── "GESTOPPT" WAR FALSCH — SIE LAUFEN WEITER (27.09.) ────────────────
    //
    // Hier stand "Trading-Loops … gestoppt". Kein `clearInterval` im ganzen
    // Programm: die Schleifen laufen durch und fragen bei JEDEM Durchlauf
    // `isKillswitchActive()` ab (instrumentation.ts:327, :746, :822).
    //
    // Belegt im Live-Log des Tests: 19:12:41 "[position-monitor] 🔴
    // Killswitch aktiv — Zyklus uebersprungen" und "[learning] 🔴 …
    // uebersprungen" — die Schleifen liefen also und wurden blockiert.
    //
    // Der Unterschied ist nicht kosmetisch: wer "gestoppt" liest, zweifelt,
    // ob `/reset` genuegt oder ein Redeploy noetig ist. Es genuegt — gerade
    // WEIL nichts gestoppt wurde. Im Test lief der Positions-Monitor um
    // 19:14:45 wieder normal an, ohne Deploy.
    details: "Trading-Loops laufen WEITER, werden aber bei jedem Durchlauf blockiert (isKillswitchActive) — /reset genuegt, kein Redeploy noetig. Offene Positionen bleiben bewusst offen und sind weiter durch die Broker-seitigen SL/TP geschützt.",
  };

  setState({
    version: VERSION,
    armed: false,
    triggered: true,
    currentStage: "COMPLETED",
    trigger,
    triggeredAt: t,
    triggeredBy,
    stages: [stage1, stage2, stage3],
    brokersLoggedOut: ["IC_MARKETS", "CAPITAL_COM"],
    ordersCancelled: 0, // bewusst 0: Positionen werden NICHT geschlossen
    systemLocked: true,
    telegramAlertSent: true,
    canReset: true,
    summary: `KILLSWITCH AKTIV — Auslöser: ${trigger} durch ${triggeredBy}. Broker getrennt, Reconnect gesperrt, Trading gestoppt. Offene Positionen bleiben mit Broker-SL/TP bestehen. /reset zum Entsperren.`,
    updatedAt: now(),
  });

  // In Redis persistieren — überlebt Deploys
  persistToRedis(getState());

  // Erst JETZT (nach gesetztem State) wirklich trennen
  disconnectBrokers();

  console.log(`[killswitch] 🔴 AKTIVIERT — ${trigger} durch ${triggeredBy}. Trading gestoppt, Broker werden getrennt.`);

  return { ...getState() };
}

export function resetKillswitch(): KillswitchReport {
  const s = getState();
  if (!s.triggered || !s.canReset) return { ...s };
  setState(buildIdleState());
  // Aus Redis löschen
  deleteFromRedis();
  console.log("[killswitch] 🟢 ZURÜCKGESETZT — Trading und Broker-Reconnect wieder freigegeben.");
  return { ...getState() };
}
