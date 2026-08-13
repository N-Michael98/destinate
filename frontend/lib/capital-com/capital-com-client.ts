// Capital.com Demo REST API client — DEMO execution enabled, LIVE blocked
const DEMO_BASE = "https://demo-api-capital.backend-capital.com/api/v1";
const LIVE_BASE = "https://api-capital.backend-capital.com/api/v1";

export interface SessionResult {
  ok: boolean;
  cst?: string;
  securityToken?: string;
  clientId?: string;
  accountId?: string;
  accountType?: string;
  currency?: string;
  balance?: number;
  error?: string;
}

export interface AccountInfo {
  accountId: string;
  accountName: string;
  accountType: string;
  currency: string;
  balance: number;
  deposit: number;
  profitLoss: number;
  available: number;
}

export interface MarketPrice {
  symbol: string;
  bid: number;
  ask: number;
  spread: number;
  updateTime: string;
}

export interface OrderRequest {
  epic: string;
  direction: "BUY" | "SELL";
  size: number;
  stopLevel?: number;
  profitLevel?: number;
  guaranteedStop?: boolean;
}

export interface OrderResult {
  ok: boolean;
  dealReference?: string;
  dealId?: string;
  status?: string;
  error?: string;
  openLevel?: number; // actual fill price from /confirms
  /** Die Order wurde abgeschickt, der Bestaetigungsschritt war aber nicht
   *  lesbar (10.08.). ok bleibt true, weil die Order live sein KANN — sie als
   *  Fehlschlag zu melden waere gefaehrlicher, ein Aufrufer koennte sie erneut
   *  senden und die Position verdoppeln. */
  unbestaetigt?: boolean;
}

export interface OpenPosition {
  dealId: string;
  epic: string;
  symbol: string;
  direction: "BUY" | "SELL";
  size: number;
  openLevel: number;
  stopLevel: number | null;
  profitLevel: number | null;
  profitLoss: number;
  currency: string;
  createdDate: string;
}

// Capital.com epic names for our symbols
export const EPIC_MAP: Record<string, string> = {
  // Forex
  EURUSD: "EURUSD",
  GBPUSD: "GBPUSD",
  USDJPY: "USDJPY",
  USDCHF: "USDCHF",
  AUDUSD: "AUDUSD",
  USDCAD: "USDCAD",
  NZDUSD: "NZDUSD",
  EURGBP: "EURGBP",
  EURJPY: "EURJPY",
  GBPJPY: "GBPJPY",
  // Commodities
  XAUUSD: "GOLD",
  XAGUSD: "SILVER",
  USOIL: "OIL_CRUDE",
  UKOIL: "OIL_BRENT",
  NATGAS: "NATURALGAS",  // war "NATURAL_GAS" (ohne Unterstrich) — siehe unten
  // Indices
  NAS100: "US100",
  SPX500: "US500",
  DJ30: "US30",
  GER40: "DE40",        // war "GERMANY40" — siehe unten
  UK100: "UK100",
  JPN225: "J225",       // war "JAPAN225" — siehe unten
  // Crypto
  // KORREKTUR 03.08.: Diese zehn Epics existierten bei Capital.com NICHT.
  // Jeder Abruf lief in HTTP 404, jede Order wäre abgelehnt worden — alle
  // neun Kryptos und der Nikkei waren damit seit jeher tote Märkte, ihre
  // Kurse kamen ausschliesslich aus dem yfinance-Rückfall.
  // Bewiesen am 03.08. 15:20 im Betrieb: Abruf ergab HTTP 404, und Capitals
  // eigene Marktsuche lieferte zu jedem Symbol den echten Epic mit exakt
  // passendem Instrumentnamen (z.B. BTCUSD[Bitcoin/USD], J225[Japan 225],
  // LINKUSD[ChainLink/USD]). Keine Vermutung, sondern Auskunft des Brokers.
  // NACHTRAG 03.08. 16:51: GERMANY40 und NATURAL_GAS hatte ich zunächst
  // entlastet, weil sie im Zyklus 15:20 kein 404 auslösten. Das war ein
  // Trugschluss — in jenem Zyklus wurden sie noch vom Ratenlimit abgefangen,
  // und die Selbstauskunft läuft nur einmal je Prozess. Sobald alle anderen
  // Epics stimmten und das Limit weg war, meldeten beide sauber HTTP 404,
  // zweimal hintereinander (16:51 und 16:56). Die Marktsuche hatte die
  // richtigen Namen schon genannt: DE40[Germany 40], NATURALGAS[Natural Gas].
  // Lehre: das Fehlen eines 404 beweist nichts, solange ein anderer Fehler
  // denselben Abruf abfangen kann.
  BTCUSD: "BTCUSD",     // war "BITCOIN"
  ETHUSD: "ETHUSD",     // war "ETHEREUM"
  LTCUSD: "LTCUSD",     // war "LITECOIN"
  XRPUSD: "XRPUSD",     // war "RIPPLE"
  ADAUSD: "ADAUSD",     // war "CARDANO"
  SOLUSD: "SOLUSD",     // war "SOLANA"
  DOTUSD: "DOTUSD",     // war "POLKADOT"
  LNKUSD: "LINKUSD",    // war "CHAINLINK" — Capital schreibt LINKUSD, nicht LNKUSD
  BNBUSD: "BNBUSD",     // war "BNB"
};

// Reverse map: epic → symbol
export const EPIC_TO_SYMBOL: Record<string, string> = Object.fromEntries(
  Object.entries(EPIC_MAP).map(([sym, epic]) => [epic, sym])
);

// Instrument metadata for display
const INSTRUMENT_META: Record<string, { name: string; type: string }> = {
  EURUSD: { name: "EUR/USD", type: "CURRENCIES" },
  GBPUSD: { name: "GBP/USD", type: "CURRENCIES" },
  USDJPY: { name: "USD/JPY", type: "CURRENCIES" },
  USDCHF: { name: "USD/CHF", type: "CURRENCIES" },
  AUDUSD: { name: "AUD/USD", type: "CURRENCIES" },
  USDCAD: { name: "USD/CAD", type: "CURRENCIES" },
  NZDUSD: { name: "NZD/USD", type: "CURRENCIES" },
  EURGBP: { name: "EUR/GBP", type: "CURRENCIES" },
  EURJPY: { name: "EUR/JPY", type: "CURRENCIES" },
  GBPJPY: { name: "GBP/JPY", type: "CURRENCIES" },
  XAUUSD: { name: "Gold", type: "COMMODITIES" },
  XAGUSD: { name: "Silver", type: "COMMODITIES" },
  USOIL: { name: "Crude Oil (WTI)", type: "COMMODITIES" },
  UKOIL: { name: "Brent Oil", type: "COMMODITIES" },
  NATGAS: { name: "Natural Gas", type: "COMMODITIES" },
  NAS100: { name: "Nasdaq 100", type: "INDICES" },
  SPX500: { name: "S&P 500", type: "INDICES" },
  DJ30: { name: "Dow Jones 30", type: "INDICES" },
  GER40: { name: "DAX 40", type: "INDICES" },
  UK100: { name: "FTSE 100", type: "INDICES" },
  JPN225: { name: "Nikkei 225", type: "INDICES" },
  BTCUSD: { name: "Bitcoin", type: "CRYPTOCURRENCIES" },
  ETHUSD: { name: "Ethereum", type: "CRYPTOCURRENCIES" },
  LTCUSD: { name: "Litecoin", type: "CRYPTOCURRENCIES" },
  XRPUSD: { name: "Ripple (XRP)", type: "CRYPTOCURRENCIES" },
  ADAUSD: { name: "Cardano", type: "CRYPTOCURRENCIES" },
  SOLUSD: { name: "Solana", type: "CRYPTOCURRENCIES" },
  DOTUSD: { name: "Polkadot", type: "CRYPTOCURRENCIES" },
  LNKUSD: { name: "Chainlink", type: "CRYPTOCURRENCIES" },
  BNBUSD: { name: "BNB", type: "CRYPTOCURRENCIES" },
};

// Fetch live prices for all curated top markets via /markets/{epic}
export async function capitalGetTopMarkets(
  apiKey: string,
  cst: string,
  securityToken: string,
  filterTypes?: string[]
): Promise<{ ok: boolean; markets?: CapitalMarket[]; error?: string }> {
  try {
    const entries = Object.entries(EPIC_MAP).filter(([sym]) => {
      if (!filterTypes || filterTypes.includes("ALL")) return true;
      const meta = INSTRUMENT_META[sym];
      return meta && filterTypes.some((t) => meta.type.includes(t));
    });

    // URSACHE gefunden (03.08., Logbeleg 14:51/14:56): hier standen alle 30
    // Abrufe in EINEM Promise.allSettled — 30 gleichzeitige Anfragen gegen ein
    // Limit von ~10 pro Sekunde. Capital antwortete auf zwei Drittel mit
    // HTTP 429 (Too Many Requests), diese Märkte fielen still weg und landeten
    // im yfinance-Rückfall. Genau daher stammte der 63 Stunden alte NAS100-Kurs:
    // nicht weil der Markt zu war, sondern weil wir uns selbst ausgesperrt haben.
    // Dass das Limit existiert, stand seit dem 08.07. im Kommentar von Stufe 1
    // des Orchestrators ("nur 7/16 geliefert") — dort wurde es umgangen, auf dem
    // Hauptweg hier aber nie behoben.
    // Jetzt in Gruppen mit Pause, wie es Stufe 1 seit dem 08.07. bewährt macht.
    const CHUNK = 5;
    const PAUSE_MS = 500; // 5 Anfragen je 500 ms = 10/s, am Limit statt darüber
    const drops: string[] = [];
    const results: PromiseSettledResult<CapitalMarket | null>[] = [];

    for (let i = 0; i < entries.length; i += CHUNK) {
      if (i > 0) await new Promise((r) => setTimeout(r, PAUSE_MS));
      const group = entries.slice(i, i + CHUNK);
      const settled = await Promise.allSettled(
        group.map(async ([symbol, epic]) => {
          const res = await fetch(`${DEMO_BASE}/markets/${epic}`, {
            headers: authHeaders(apiKey, cst, securityToken),
            signal: AbortSignal.timeout(5000),
          });
          if (!res.ok) {
            drops.push(`${symbol}(${epic}): HTTP ${res.status}`);
            return null;
          }
          const data = (await res.json()) as Record<string, unknown>;
          const snap = (data.snapshot ?? {}) as Record<string, unknown>;
          const bid = Number(snap.bid ?? 0);
          const offer = Number(snap.offer ?? bid);
          if (!(bid > 0)) {
            drops.push(`${symbol}(${epic}): bid=${bid} status=${String(snap.marketStatus ?? "?")}`);
          }
          const meta = INSTRUMENT_META[symbol] ?? { name: symbol, type: "CURRENCIES" };
          return {
            epic,
            instrumentName: meta.name,
            instrumentType: meta.type,
            symbol,
            bid,
            ask: offer,
            spread: Number((offer - bid).toFixed(5)),
            updateTime: String(snap.updateTime ?? ""), // leer = unbekannt, NICHT als frisch werten (02.08.)
          } as CapitalMarket;
        })
      );
      results.push(...settled);
    }

    for (const r of results) {
      if (r.status === "rejected") {
        drops.push(`Abbruch: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
      }
    }

    const markets = results
      .filter((r): r is PromiseFulfilledResult<CapitalMarket> => r.status === "fulfilled" && r.value !== null)
      .map((r) => r.value)
      .filter((m) => m.bid > 0);

    if (drops.length > 0) {
      console.warn(`[capital-markets] ${markets.length}/${entries.length} Märkte mit Kurs. Ohne Kurs: ${drops.join(" | ")}`);
      // Die Epic-Selbstauskunft NUR bei HTTP 404 starten — nur dann ist das Epic
      // wirklich unbekannt. Bei 429 (Ratenlimit) oder geschlossenem Markt sagt
      // sie nichts aus und würde das Limit zusätzlich belasten; genau das ist
      // mir im Zyklus 14:51 passiert.
      const unknownEpics = drops
        .filter((d) => d.includes("HTTP 404"))
        .map((d) => d.split("(")[0]);
      if (unknownEpics.length > 0) {
        void diagnoseEpicsOnce(apiKey, cst, securityToken, unknownEpics);
      }
    }

    return { ok: true, markets };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

// ── Epic-Selbstauskunft (03.08.) ─────────────────────────────────────────────
// Wenn ein Markt keinen Kurs liefert, gibt es genau zwei mögliche Ursachen:
// das Epic in EPIC_MAP passt nicht zum Konto, oder der Markt ist wirklich zu.
// Statt zu vermuten, fragen wir Capital selbst: die Markt-Suche liefert die
// echten Epics samt Handelsstatus. Rein lesend (GET), läuft EINMAL pro Prozess,
// nacheinander mit Pause (Ratenlimit), Fehler bleiben folgenlos.
let _epicDiagDone = false;
async function diagnoseEpicsOnce(
  apiKey: string,
  cst: string,
  securityToken: string,
  failedSymbols: string[]
): Promise<void> {
  if (_epicDiagDone || failedSymbols.length === 0) return;
  _epicDiagDone = true;
  try {
    for (const symbol of failedSymbols.slice(0, 12)) {
      const term = INSTRUMENT_META[symbol]?.name ?? symbol;
      const found = await capitalSearchMarkets(apiKey, cst, securityToken, term);
      if (!found.ok || !found.markets?.length) {
        console.warn(`[capital-epic] ${symbol}: Suche "${term}" ergab nichts (${found.error ?? "0 Treffer"})`);
      } else {
        const list = found.markets
          .slice(0, 5)
          .map((m) => `${m.epic}[${m.instrumentName}] bid=${m.bid}`)
          .join(", ");
        console.warn(`[capital-epic] ${symbol}: hinterlegt="${EPIC_MAP[symbol]}" | Capital kennt: ${list}`);
      }
      await new Promise((r) => setTimeout(r, 350)); // Ratenlimit schonen
    }
  } catch (e) {
    console.warn("[capital-epic] Selbstauskunft fehlgeschlagen:", e instanceof Error ? e.message : String(e));
  }
}

function authHeaders(apiKey: string, cst: string, securityToken: string) {
  return {
    "X-CAP-API-KEY": apiKey,
    CST: cst,
    "X-SECURITY-TOKEN": securityToken,
    "Content-Type": "application/json",
  };
}

export async function capitalCreateSession(
  apiKey: string,
  identifier: string,   // Capital.com uses "identifier" (= email/username), NOT "login"
  password: string,
  useLiveApi = false    // false = DEMO, true = LIVE (blocked by safety lock)
): Promise<SessionResult> {
  const base = useLiveApi ? LIVE_BASE : DEMO_BASE;
  try {
    const res = await fetch(`${base}/session`, {
      method: "POST",
      headers: {
        "X-CAP-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        encryptedPassword: false,
        identifier,
        password,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000), // 8s max — prevents page from hanging
    });

    if (!res.ok) {
      let errMsg = `HTTP ${res.status}`;
      try {
        const errBody = await res.json() as Record<string, string>;
        errMsg = errBody.errorCode ?? errBody.errorMessage ?? errMsg;
      } catch { /* ignore parse error */ }
      return { ok: false, error: errMsg };
    }

    const cst = res.headers.get("CST") ?? "";
    const securityToken = res.headers.get("X-SECURITY-TOKEN") ?? "";
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    return {
      ok: true,
      cst,
      securityToken,
      clientId: String(data.clientId ?? ""),
      accountId: String(data.currentAccountId ?? ""),
      accountType: String(data.accountType ?? ""),
      currency: String(data.currency ?? ""),
    };
  } catch (err) {
    // "fetch failed" = network-level error (DNS, SSL, timeout)
    const msg = err instanceof Error ? err.message : "Network error";
    return { ok: false, error: `Network error — ${msg}` };
  }
}

export async function capitalGetAccounts(
  apiKey: string,
  cst: string,
  securityToken: string
): Promise<{ ok: boolean; accounts?: AccountInfo[]; error?: string }> {
  try {
    const res = await fetch(`${DEMO_BASE}/accounts`, {
      headers: authHeaders(apiKey, cst, securityToken),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };

    const data = (await res.json()) as { accounts: Record<string, unknown>[] };
    const accounts: AccountInfo[] = (data.accounts ?? []).map((a) => {
      // Capital.com returns balance as nested object: { balance, deposit, profitLoss, available }
      const bal = (a.balance && typeof a.balance === "object")
        ? (a.balance as Record<string, unknown>)
        : null;
      return {
        accountId: String(a.accountId ?? ""),
        accountName: String(a.accountName ?? ""),
        accountType: String(a.accountType ?? ""),
        currency: String(a.currency ?? "CHF"),
        balance: bal ? Number(bal.balance ?? 0) : Number(a.balance ?? 0),
        deposit: bal ? Number(bal.deposit ?? 0) : Number(a.deposit ?? 0),
        profitLoss: bal ? Number(bal.profitLoss ?? 0) : Number(a.profitLoss ?? 0),
        available: bal ? Number(bal.available ?? 0) : Number(a.available ?? 0),
      };
    });
    return { ok: true, accounts };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

export async function capitalGetPrices(
  apiKey: string,
  cst: string,
  securityToken: string,
  symbols: string[] = ["XAUUSD", "EURUSD", "NAS100", "USOIL", "BTCUSD", "SPX500"]
): Promise<{ ok: boolean; prices?: MarketPrice[]; error?: string }> {
  try {
    // Parallel fetching — alle Symbole gleichzeitig statt sequenziell
    // (sequentiell mit await-in-for führt bei >5 Symbolen zu Rate-Limit-Drops)
    // Der Aufrufer (Orchestrator Stufe 1) ruft bewusst in 5er-Gruppen auf.
    //
    // Gründe für fehlende Kurse werden GESAMMELT und am Ende in EINER Zeile
    // ausgegeben (03.08.). Zuerst hatte ich je Symbol eine Zeile geschrieben —
    // das ergab pro Zyklus über 20 rote Meldungen und machte das Log unlesbar.
    const drops: string[] = [];
    const results = await Promise.all(
      symbols.map(async (symbol): Promise<MarketPrice | null> => {
        const epic = EPIC_MAP[symbol];
        if (!epic) {
          drops.push(`${symbol}: kein Epic hinterlegt`);
          return null;
        }
        try {
          const res = await fetch(`${DEMO_BASE}/markets/${epic}`, {
            headers: authHeaders(apiKey, cst, securityToken),
            signal: AbortSignal.timeout(6000),
          });
          if (!res.ok) {
            drops.push(`${symbol}(${epic}): HTTP ${res.status}`);
            return null;
          }
          const data = (await res.json()) as Record<string, unknown>;
          const snapshot = (data.snapshot ?? {}) as Record<string, unknown>;
          const bid = Number(snapshot.bid ?? 0);
          const offer = Number(snapshot.offer ?? 0);
          if (bid <= 0 && offer <= 0) {
            drops.push(`${symbol}(${epic}): kein Kurs, marketStatus=${String(snapshot.marketStatus ?? "?")}`);
            return null;
          }
          return {
            symbol,
            bid,
            ask: offer,
            spread: Number((offer - bid).toFixed(5)),
            updateTime: String(snapshot.updateTime ?? ""), // leer = unbekannt, NICHT als frisch werten (02.08.)
          };
        } catch (e) {
          drops.push(`${symbol}(${epic}): ${e instanceof Error ? e.message : String(e)}`);
          return null;
        }
      })
    );
    const prices = results.filter((p): p is MarketPrice => p !== null);
    if (drops.length > 0) {
      console.warn(`[capital-prices] ${prices.length}/${symbols.length} nachgeholt. Ohne Kurs: ${drops.join(" | ")}`);
    }
    return { ok: true, prices };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

// ── Mindest-Stop-Abstand des Brokers (10.08.) ────────────────────────────────
//
// Capital.com schreibt je Markt vor, wie nah ein Stop am Kurs stehen darf, und
// liefert die Regel bei jedem Marktabruf in dealingRules.minStopOrProfitDistance
// mit. Ausgewertet wurde bisher NUR data.snapshot (die Kurse) — die Regel wurde
// nie angeschaut, und unser Stop ging ungeprueft raus.
//
// WAS DABEI WIRKLICH PASSIERT, nachgeprueft statt vermutet: der Broker nimmt
// eine Order mit zu engem Stop nicht etwa ohne Stop an, sondern LEHNT SIE AB.
// Der Bestaetigungsschritt oben faengt das als REJECTED ab. Die Folge ist also
// kein ungeschuetzter Trade, sondern ein verlorener — mit einem Fehlercode, den
// niemand einordnen kann. Diese Pruefung macht daraus eine klare Meldung, bevor
// die Order ueberhaupt rausgeht.
//
// WAS HIER BEWUSST NICHT GERATEN WIRD: die Regel kommt mit einer Einheit.
// "PERCENTAGE" ist eindeutig in einen Kursabstand umzurechnen. Bei "POINTS"
// haengt die Umrechnung an der Punktgroesse des Instruments, und die laesst
// sich ohne echte Broker-Antwort nicht belegen. Statt zu raten wird der Rohwert
// mitgeschrieben und die Pruefung uebersprungen — sie blockiert dann nichts.
// Sobald ein echter Lauf die Werte zeigt, ist die Umrechnung belegbar
// nachzutragen. Ein geratener Riegel waere schlimmer als keiner: er wuerde
// gueltige Orders abweisen.

export interface MarktRegeln {
  epic: string;
  /** Mindestabstand in KURSEINHEITEN. null = aus der Antwort nicht ableitbar. */
  minStopDistanz: number | null;
  einheit: string;
  rohwert: number | null;
  bid: number;
  offer: number;
}

/** Rechnet die Broker-Regel in einen Kursabstand um.
 *
 *  Als eigene Funktion, damit der Pruefer sie AUSFUEHREN kann — eingebettet
 *  waere sie nur vorhanden, nicht bewiesen. */
export function mindestAbstandAusRegel(
  einheit: unknown,
  wert: unknown,
  referenzkurs: number,
): number | null {
  const w = typeof wert === "number" ? wert : Number(wert);
  if (!Number.isFinite(w) || w <= 0) return null;
  const e = String(einheit ?? "").toUpperCase();
  if (e === "PERCENTAGE") {
    if (!(referenzkurs > 0) || !Number.isFinite(referenzkurs)) return null;
    return (referenzkurs * w) / 100;
  }
  // POINTS und alles andere: nicht belegbar umrechenbar — siehe Kommentar oben.
  return null;
}

/** Steht der Stop weit genug vom Kurs weg?
 *
 *  Prueft NUR, es wird nichts verschoben. Den Stop automatisch aufzuweiten
 *  waere gefaehrlich: die Positionsgroesse ist fuer den urspruenglichen
 *  Abstand gerechnet, ein weiterer Stop bedeutet mehr Risiko als erlaubt.
 *  Lieber die Order gar nicht senden als sie mit falschem Risiko senden. */
export function stopAbstandGenug(
  stopLevel: number,
  richtung: "BUY" | "SELL",
  referenzkurs: number,
  minDistanz: number | null,
): { ok: boolean; abstand: number; grund: string } {
  if (minDistanz == null) {
    return { ok: true, abstand: 0, grund: "keine belegbare Regel — nicht geprueft" };
  }
  if (!(referenzkurs > 0) || !Number.isFinite(referenzkurs) || !Number.isFinite(stopLevel)) {
    return { ok: true, abstand: 0, grund: "Kurs oder Stop unbrauchbar — nicht geprueft" };
  }
  // Stop auf der falschen Seite faengt realesChanceRisiko() schon ab; hier
  // zaehlt nur der Abstand, deshalb der Betrag.
  const abstand = Math.abs(referenzkurs - stopLevel);
  // Relative Toleranz gegen Gleitkomma-Rauschen: |100 - 99.9| ergibt in
  // Binaerdarstellung 0.09999999999999432 und waere gegen eine Regel von 0.1
  // knapp zu klein. Eine gueltige Order deswegen abzuweisen waere ein
  // selbstgemachter Fehler — der Broker rechnet ohnehin mit begrenzter
  // Genauigkeit. 1e-9 relativ ist weit unter jeder echten Kursbewegung und
  // kann keinen wirklich zu engen Stop durchlassen.
  if (abstand >= minDistanz * (1 - 1e-9)) {
    return { ok: true, abstand, grund: "" };
  }
  return {
    ok: false,
    abstand,
    grund: `Stop ${stopLevel} liegt ${abstand.toFixed(5)} vom Kurs ${referenzkurs} entfernt, `
      + `der Broker verlangt mindestens ${minDistanz.toFixed(5)} (${richtung})`,
  };
}

// Regeln je Epic zwischenspeichern — sie aendern sich selten, und der
// Positions-Monitor laeuft alle zwei Minuten.
const regelCache = new Map<string, { regeln: MarktRegeln; bis: number }>();
const REGEL_TTL_MS = 10 * 60 * 1000;

export async function capitalMarktRegeln(
  apiKey: string,
  cst: string,
  securityToken: string,
  epic: string,
): Promise<MarktRegeln | null> {
  const zwischen = regelCache.get(epic);
  if (zwischen && zwischen.bis > Date.now()) return zwischen.regeln;
  try {
    const res = await fetch(`${DEMO_BASE}/markets/${epic}`, {
      headers: authHeaders(apiKey, cst, securityToken),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    const snap = (data.snapshot ?? {}) as Record<string, unknown>;
    const regeln = (data.dealingRules ?? {}) as Record<string, unknown>;
    const min = (regeln.minStopOrProfitDistance ?? {}) as Record<string, unknown>;
    const bid = Number(snap.bid ?? 0);
    const offer = Number(snap.offer ?? bid);
    const referenz = bid > 0 ? (bid + offer) / 2 : 0;
    const ergebnis: MarktRegeln = {
      epic,
      minStopDistanz: mindestAbstandAusRegel(min.unit, min.value, referenz),
      einheit: String(min.unit ?? "unbekannt"),
      rohwert: min.value != null ? Number(min.value) : null,
      bid, offer,
    };
    regelCache.set(epic, { regeln: ergebnis, bis: Date.now() + REGEL_TTL_MS });
    return ergebnis;
  } catch {
    return null;
  }
}

// Place a market order on Capital.com DEMO
export async function capitalPlaceOrder(
  apiKey: string,
  cst: string,
  securityToken: string,
  order: OrderRequest
): Promise<OrderResult> {
  try {
    const body: Record<string, unknown> = {
      epic: order.epic,
      direction: order.direction,
      size: order.size,
      guaranteedStop: order.guaranteedStop ?? false,
    };
    if (order.stopLevel != null) body.stopLevel = order.stopLevel;
    if (order.profitLevel != null) body.profitLevel = order.profitLevel;

    // Mindest-Stop-Abstand des Brokers pruefen, BEVOR die Order rausgeht
    // (10.08.). Vorher ging der Stop ungeprueft raus; ein zu enger fuehrte zu
    // einer Ablehnung mit einem Fehlercode, den niemand einordnen konnte.
    // Der Aufruf ist zwischengespeichert (10 Minuten je Epic) und laesst die
    // Order durch, wenn die Regel nicht belegbar ist — ein geratener Riegel
    // wuerde gueltige Orders abweisen.
    if (order.stopLevel != null) {
      const regeln = await capitalMarktRegeln(apiKey, cst, securityToken, order.epic);
      if (regeln) {
        const referenz = regeln.bid > 0 ? (regeln.bid + regeln.offer) / 2 : 0;
        const urteil = stopAbstandGenug(order.stopLevel, order.direction, referenz, regeln.minStopDistanz);
        if (!urteil.ok) {
          console.warn(`[capital] Order ${order.epic} nicht gesendet — ${urteil.grund}`);
          return { ok: false, error: `Mindest-Stop-Abstand verletzt: ${urteil.grund}` };
        }
        if (regeln.minStopDistanz == null && regeln.rohwert != null) {
          // Sichtbar machen, was der Broker wirklich schickt — damit die
          // Umrechnung fuer diese Einheit spaeter BELEGT statt geraten wird.
          console.log(`[capital] ${order.epic}: Mindestabstand-Regel nicht umrechenbar `
            + `(${regeln.rohwert} ${regeln.einheit}) — Stop ungeprueft gesendet`);
        }
      }
    }

    const res = await fetch(`${DEMO_BASE}/positions`, {
      method: "POST",
      headers: authHeaders(apiKey, cst, securityToken),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const errMsg: string = (errBody as Record<string, string>).errorCode ?? `HTTP ${res.status}`;
      return { ok: false, error: errMsg };
    }

    const data = (await res.json()) as Record<string, unknown>;
    const dealReference = String(data.dealReference ?? "");

    // Capital.com requires a confirm step to get the real dealId and verify acceptance
    let bestaetigungsFehler = "";
    if (dealReference) {
      await new Promise((r) => setTimeout(r, 800)); // brief wait for backend to process
      try {
        const confirmRes = await fetch(`${DEMO_BASE}/confirms/${dealReference}`, {
          headers: authHeaders(apiKey, cst, securityToken),
          signal: AbortSignal.timeout(8000),
        });
        if (!confirmRes.ok) {
          bestaetigungsFehler = `HTTP ${confirmRes.status}`;
        }
        if (confirmRes.ok) {
          const confirm = (await confirmRes.json()) as Record<string, unknown>;
          const status = String(confirm.status ?? "");
          const dealId = String(confirm.dealId ?? dealReference);
          if (status === "REJECTED" || status === "DELETED") {
            const reason = String(confirm.reason ?? confirm.rejectReason ?? "Order rejected by broker");
            return { ok: false, error: reason };
          }
          const openLevel = Number(confirm.level ?? confirm.openLevel ?? 0);
          return { ok: true, dealReference, dealId, status: "OPENED", openLevel: openLevel > 0 ? openLevel : undefined };
        }
      } catch (e) {
        bestaetigungsFehler = e instanceof Error ? e.message : String(e);
      }
    }

    // HIER LANDET, WER NICHT BESTAETIGEN KONNTE (Fund 10.08.).
    //
    // Bis heute meldete diese Stelle `status: "OPENED"` — also "Order steht" —
    // obwohl der Bestaetigungsschritt gar nicht gelesen werden konnte. Eine
    // echte Ablehnung faengt der Block oben zwar ab; aber ein Zeitfehler, ein
    // HTTP-Fehler oder ein Netzabbruch beim Bestaetigen sahen exakt aus wie ein
    // Erfolg. Das System hielt dann eine Position fuer offen, ueber die es
    // nichts wusste.
    //
    // ok BLEIBT true, und das ist Absicht: die Order kann sehr wohl live sein.
    // Sie als Fehlschlag zu melden waere gefaehrlicher — ein Aufrufer koennte
    // sie erneut senden und die Position verdoppeln. Gemeldet wird deshalb die
    // UNSICHERHEIT, nicht ein erfundenes Ergebnis.
    if (dealReference) {
      console.warn(
        `[capital] Order ${dealReference} NICHT bestaetigt${bestaetigungsFehler ? ` (${bestaetigungsFehler})` : ""}`
        + ` — Status unbekannt. Die Order kann live sein; nicht erneut senden.`
      );
    }
    return {
      ok: true,
      dealReference,
      dealId: String(data.dealId ?? dealReference),
      status: dealReference ? "UNBESTAETIGT" : "OPENED",
      unbestaetigt: dealReference ? true : undefined,
      error: dealReference
        ? `Bestaetigung nicht lesbar${bestaetigungsFehler ? `: ${bestaetigungsFehler}` : ""}`
        : undefined,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

// Get all open positions
export async function capitalGetPositions(
  apiKey: string,
  cst: string,
  securityToken: string
): Promise<{ ok: boolean; positions?: OpenPosition[]; error?: string }> {
  try {
    const res = await fetch(`${DEMO_BASE}/positions`, {
      headers: authHeaders(apiKey, cst, securityToken),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };

    const data = (await res.json()) as { positions: Record<string, unknown>[] };
const positions: OpenPosition[] = (data.positions ?? []).map((p) => {
      const pos = (p.position ?? {}) as Record<string, unknown>;
      const market = (p.market ?? {}) as Record<string, unknown>;
      const epic = String(market.epic ?? "");
      return {
        dealId: String(pos.dealId ?? ""),
        epic,
        symbol: EPIC_TO_SYMBOL[epic] ?? epic,
        direction: (pos.direction as "BUY" | "SELL") ?? "BUY",
        size: Number(pos.dealSize ?? pos.size ?? 0),
        openLevel: Number(pos.level ?? pos.openLevel ?? 0),
        stopLevel: pos.stopLevel != null ? Number(pos.stopLevel) : null,
        profitLevel: pos.limitLevel != null ? Number(pos.limitLevel) : null,
        profitLoss: Number(pos.upl ?? 0),
        currency: String(pos.currency ?? "USD"),
        createdDate: String(pos.createdDate ?? new Date().toISOString()),
      };
    });

    return { ok: true, positions };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

// Update SL/TP on an open position
export async function capitalUpdatePosition(
  apiKey: string,
  cst: string,
  securityToken: string,
  dealId: string,
  stopLevel: number,
  limitLevel?: number
): Promise<OrderResult> {
  try {
    const body: Record<string, unknown> = { stopLevel };
    if (limitLevel && limitLevel > 0) body.limitLevel = limitLevel;
    const res = await fetch(`${DEMO_BASE}/positions/${dealId}`, {
      method: "PUT",
      headers: authHeaders(apiKey, cst, securityToken),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      return { ok: false, error: (errBody as Record<string, string>).errorCode ?? `HTTP ${res.status}` };
    }
    const data = (await res.json()) as Record<string, unknown>;
    return { ok: true, dealReference: String(data.dealReference ?? ""), status: "UPDATED" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

// Partially close a position: opens opposite order for partialSize
export async function capitalClosePartial(
  apiKey: string,
  cst: string,
  securityToken: string,
  epic: string,
  direction: "BUY" | "SELL",
  partialSize: number,
): Promise<OrderResult> {
  try {
    const oppositeDir = direction === "BUY" ? "SELL" : "BUY";
    const res = await fetch(`${DEMO_BASE}/positions`, {
      method: "POST",
      headers: authHeaders(apiKey, cst, securityToken),
      body: JSON.stringify({ epic, direction: oppositeDir, size: partialSize, orderType: "MARKET" }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      return { ok: false, error: (errBody as Record<string, string>).errorCode ?? `HTTP ${res.status}` };
    }
    const data = (await res.json()) as Record<string, unknown>;
    return { ok: true, dealReference: String(data.dealReference ?? ""), status: "PARTIAL_CLOSE" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

// Close a specific position by dealId
export async function capitalClosePosition(
  apiKey: string,
  cst: string,
  securityToken: string,
  dealId: string
): Promise<OrderResult> {
  try {
    const res = await fetch(`${DEMO_BASE}/positions/${dealId}`, {
      method: "DELETE",
      headers: authHeaders(apiKey, cst, securityToken),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const errMsg: string = (errBody as Record<string, string>).errorCode ?? `HTTP ${res.status}`;
      return { ok: false, error: errMsg };
    }

    const data = (await res.json()) as Record<string, unknown>;
    return {
      ok: true,
      dealReference: String(data.dealReference ?? ""),
      status: "CLOSED",
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

export interface CapitalMarket {
  epic: string;
  instrumentName: string;
  instrumentType: string;
  symbol: string; // derived from epic
  bid: number;
  ask: number;
  spread: number;
  /** Echter Zeitpunkt des Kurses. Leer = unbekannt (NICHT als frisch werten). */
  updateTime: string;
  /** Alter des Kurses in Minuten, sofern bekannt (02.08.). null = unbekannt. */
  ageMinutes?: number | null;
  /** Woher der Kurs stammt — Broker-Kurse sind live, yfinance kann alt sein. */
  priceSource?: "CAPITAL" | "YFINANCE_FALLBACK";
}

// Fetch all available markets from Capital.com (by instrument type)
// Returns markets with current bid/ask from Capital.com snapshot
export async function capitalGetAvailableMarkets(
  apiKey: string,
  cst: string,
  securityToken: string,
  instrumentTypes: string[] = ["CURRENCIES", "INDICES", "COMMODITIES", "CRYPTOCURRENCIES"]
): Promise<{ ok: boolean; markets?: CapitalMarket[]; error?: string }> {
  try {
    const all: CapitalMarket[] = [];

    for (const type of instrumentTypes) {
      const res = await fetch(
        `${DEMO_BASE}/markets?instrumentTypes=${type}&limit=50`,
        { headers: authHeaders(apiKey, cst, securityToken), signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) continue;

      const data = (await res.json()) as { markets: Record<string, unknown>[] };
      for (const m of data.markets ?? []) {
        const snap = (m.snapshot ?? {}) as Record<string, unknown>;
        const epic = String(m.epic ?? "");
        const bid = Number(snap.bid ?? 0);
        const offer = Number(snap.offer ?? bid);
        all.push({
          epic,
          instrumentName: String(m.instrumentName ?? epic),
          instrumentType: type,
          symbol: EPIC_TO_SYMBOL[epic] ?? epic,
          bid,
          ask: offer,
          spread: Number((offer - bid).toFixed(5)),
          updateTime: String(snap.updateTime ?? ""), // leer = unbekannt, NICHT als frisch werten (02.08.)
        });
      }
    }

    return { ok: true, markets: all };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

// Search markets by term (e.g. "gold", "eur", "bitcoin")
export async function capitalSearchMarkets(
  apiKey: string,
  cst: string,
  securityToken: string,
  searchTerm: string
): Promise<{ ok: boolean; markets?: CapitalMarket[]; error?: string }> {
  try {
    const res = await fetch(
      `${DEMO_BASE}/markets?searchTerm=${encodeURIComponent(searchTerm)}&limit=20`,
      { headers: authHeaders(apiKey, cst, securityToken), signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };

    const data = (await res.json()) as { markets: Record<string, unknown>[] };
    const markets: CapitalMarket[] = (data.markets ?? []).map((m) => {
      const snap = (m.snapshot ?? {}) as Record<string, unknown>;
      const epic = String(m.epic ?? "");
      const bid = Number(snap.bid ?? 0);
      const offer = Number(snap.offer ?? bid);
      return {
        epic,
        instrumentName: String(m.instrumentName ?? epic),
        instrumentType: String(m.instrumentType ?? ""),
        symbol: EPIC_TO_SYMBOL[epic] ?? epic,
        bid,
        ask: offer,
        spread: Number((offer - bid).toFixed(5)),
        updateTime: String(snap.updateTime ?? ""), // leer = unbekannt, NICHT als frisch werten (02.08.)
      };
    });
    return { ok: true, markets };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

export interface ClosedPositionRecord {
  dealId: string;
  epic: string;
  symbol: string;
  direction: "BUY" | "SELL";
  size: number;
  openLevel: number;
  closeLevel: number;
  profitLoss: number;
  currency: string;
  openDate: string;
  closeDate: string;
}

// Fetch closed position history from Capital.com via /history/activity
export async function capitalGetClosedPositions(
  apiKey: string,
  cst: string,
  securityToken: string,
  lastNDays = 7
): Promise<{ ok: boolean; positions?: ClosedPositionRecord[]; error?: string }> {
  try {
    const from = new Date(Date.now() - lastNDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 19);
    const to = new Date().toISOString().slice(0, 19);
    const res = await fetch(
      `${DEMO_BASE}/history/activity?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&pageSize=50`,
      { headers: authHeaders(apiKey, cst, securityToken), signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };

    const data = (await res.json()) as { activities?: Record<string, unknown>[] };
    const activities = data.activities ?? [];

    const positions: ClosedPositionRecord[] = [];
    for (const a of activities) {
      const details = (a.details ?? {}) as Record<string, unknown>;
      const actions = Array.isArray(details.actions) ? details.actions as Record<string, unknown>[] : [];

      // Only process closed position activities
      const hasDealClosed = actions.some(
        (act) => String(act.actionType ?? "").includes("CLOSE") || String(act.actionType ?? "").includes("CLOSED")
      );
      if (!hasDealClosed && String(a.type ?? "") !== "CLOSE_POSITION") continue;

      // Get dealId — from actions affectedDealId or top-level
      const closedAction = actions.find((act) => String(act.actionType ?? "").includes("CLOSE"));
      const dealId = String(closedAction?.affectedDealId ?? a.dealId ?? details.dealReference ?? "");
      if (!dealId) continue;

      const epic = String(details.epic ?? a.epic ?? "");
      // profitAndLoss is a string like "+5.00" or "-3.50"
      const pnlRaw = details.profitAndLoss ?? details.profit ?? 0;
      const profitLoss = typeof pnlRaw === "string" ? parseFloat(pnlRaw.replace("+", "")) : Number(pnlRaw);

      positions.push({
        dealId,
        epic,
        symbol: EPIC_TO_SYMBOL[epic] ?? String(a.epic ?? epic),
        direction: (details.direction as "BUY" | "SELL") ?? "BUY",
        size: Number(details.dealSize ?? details.size ?? 0),
        openLevel: Number(details.openLevel ?? details.level ?? 0),
        closeLevel: Number(details.closeLevel ?? 0),
        profitLoss,
        currency: String(details.currency ?? "CHF"),
        openDate: String(a.date ?? new Date().toISOString()),
        closeDate: String(a.date ?? new Date().toISOString()),
      });
    }

    console.log(`[capital] /history/activity: ${activities.length} activities, ${positions.length} closed positions`);
    return { ok: true, positions };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

export async function capitalDeleteSession(
  apiKey: string,
  cst: string,
  securityToken: string
): Promise<void> {
  await fetch(`${DEMO_BASE}/session`, {
    method: "DELETE",
    headers: authHeaders(apiKey, cst, securityToken),
    signal: AbortSignal.timeout(5000),
  }).catch(() => {});
}
