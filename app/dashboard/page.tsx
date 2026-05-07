"use client";

import { useEffect, useState } from "react";

type DashboardData = {
  generatedAt: string;
  settings: {
    botMode: string;
    emergencyStop: boolean;
    maxTradeSizeUsd: number;
    minTradeScore: number;
    maxBuyImpactPct: number;
    maxSellImpactPct: number;
  } | null;
  rpcStatus: {
    ok: boolean;
    chainId: number | null;
    blockNumber: number | null;
    message: string;
  };
  summary: {
    totalTokens: number;
    activeTokens: number;
    readyTokens: number;
    latestDecisionCount: number;
    acceptedDecisionCount: number;
    paperTradeCount: number;
    openPaperTrades: number;
    realizedPaperPnl: number;
    recentRiskEvents: number;
  };
  latestDecisions: Array<{
    id: number;
    accepted: boolean;
    tradeScore: number;
    expectedProfitPct: number;
    reasons: string;
    createdAt: string;
    token: { symbol: string; name: string } | null;
  }>;
  latestPaperTrades: Array<{
    id: number;
    side: string;
    status: string;
    entryPrice: number;
    qty: number;
    pnl: number;
    createdAt: string;
    token: { symbol: string; name: string } | null;
  }>;
  riskEvents: Array<{
    id: number;
    reason: string;
    severity: string;
    createdAt: string;
    token: { symbol: string; name: string } | null;
  }>;
  botLogs: Array<{
    id: number;
    level: string;
    message: string;
    meta: string | null;
    createdAt: string;
  }>;
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [status, setStatus] = useState("Loading dashboard...");
  const [refreshing, setRefreshing] = useState(false);

  async function loadDashboard() {
    setRefreshing(true);
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Dashboard load failed.");
      setData(json);
      setStatus("Dashboard loaded.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Dashboard load failed.");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  return (
    <main style={{ padding: 32, fontFamily: "Arial, sans-serif", maxWidth: 1260, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ marginBottom: 8 }}>Ronin Trading Bot Dashboard</h1>
          <p style={{ marginTop: 0, color: "#555" }}>Command center for safe buildout, token readiness, decisions, paper trades, and risk logs.</p>
        </div>
        <button onClick={loadDashboard} disabled={refreshing} style={buttonStyle}>{refreshing ? "Refreshing..." : "Refresh"}</button>
      </div>

      <nav style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "18px 0" }}>
        <Nav href="/settings" label="Settings" />
        <Nav href="/tokens" label="Tokens" />
        <Nav href="/watch" label="Watch" />
        <Nav href="/decisions" label="Decisions" />
        <Nav href="/paper" label="Paper" />
        <Nav href="/db-test" label="DB Test" />
      </nav>

      <section style={{ border: "1px solid #ddd", borderRadius: 14, padding: 18, margin: "20px 0", background: "#f8fafc" }}>
        <strong>Status:</strong> {status}
        {data ? <p style={{ marginBottom: 0 }}>Last checked: {new Date(data.generatedAt).toLocaleString()}</p> : null}
      </section>

      {data ? (
        <>
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
            <Card title="Bot Mode" value={data.settings?.botMode || "UNKNOWN"} detail={data.settings?.emergencyStop ? "Emergency Stop ON" : "Emergency Stop OFF"} danger={!data.settings?.emergencyStop || data.settings?.botMode === "LIVE"} />
            <Card title="Ronin RPC" value={data.rpcStatus.ok ? "Connected" : "Problem"} detail={`Block ${data.rpcStatus.blockNumber || "?"}`} danger={!data.rpcStatus.ok} />
            <Card title="Tokens" value={`${data.summary.activeTokens}/${data.summary.totalTokens}`} detail={`${data.summary.readyTokens} ready for watching`} />
            <Card title="Decisions" value={String(data.summary.latestDecisionCount)} detail={`${data.summary.acceptedDecisionCount} accepted recently`} danger={data.summary.acceptedDecisionCount > 0} />
            <Card title="Paper Trades" value={String(data.summary.paperTradeCount)} detail={`${data.summary.openPaperTrades} open simulations`} />
            <Card title="Paper PnL" value={`$${data.summary.realizedPaperPnl.toFixed(2)}`} detail="Fake PnL only" danger={data.summary.realizedPaperPnl < 0} />
          </section>

          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 18 }}>
            <Panel title="Risk Guardrails">
              <Mini label="Max trade size" value={`$${data.settings?.maxTradeSizeUsd ?? "?"}`} />
              <Mini label="Min trade score" value={String(data.settings?.minTradeScore ?? "?")} />
              <Mini label="Max buy impact" value={`${data.settings?.maxBuyImpactPct ?? "?"}%`} />
              <Mini label="Max sell impact" value={`${data.settings?.maxSellImpactPct ?? "?"}%`} />
            </Panel>

            <Panel title="Latest Decisions">
              {data.latestDecisions.length === 0 ? <p>No decisions yet.</p> : null}
              {data.latestDecisions.map((decision) => (
                <Item key={decision.id} title={`${decision.accepted ? "ACCEPTED" : "REJECTED"} · ${decision.token?.symbol || "Unknown"}`} detail={`Score ${decision.tradeScore} / Expected ${decision.expectedProfitPct}%`} time={decision.createdAt} />
              ))}
            </Panel>

            <Panel title="Latest Paper Trades">
              {data.latestPaperTrades.length === 0 ? <p>No paper trades yet.</p> : null}
              {data.latestPaperTrades.map((trade) => (
                <Item key={trade.id} title={`${trade.side} · ${trade.token?.symbol || "Unknown"}`} detail={`${trade.status} / Qty ${trade.qty} / PnL $${trade.pnl.toFixed(2)}`} time={trade.createdAt} />
              ))}
            </Panel>

            <Panel title="Recent Risk Events">
              {data.riskEvents.length === 0 ? <p>No risk events yet.</p> : null}
              {data.riskEvents.map((event) => (
                <Item key={event.id} title={`${event.severity.toUpperCase()} · ${event.token?.symbol || "System"}`} detail={event.reason} time={event.createdAt} />
              ))}
            </Panel>

            <Panel title="Bot Logs">
              {data.botLogs.length === 0 ? <p>No logs yet.</p> : null}
              {data.botLogs.map((log) => (
                <Item key={log.id} title={`${log.level.toUpperCase()} · ${log.message}`} detail={log.meta || "No metadata"} time={log.createdAt} />
              ))}
            </Panel>
          </section>
        </>
      ) : null}
    </main>
  );
}

function Nav({ href, label }: { href: string; label: string }) {
  return <a href={href} style={linkStyle}>{label}</a>;
}

function Card({ title, value, detail, danger = false }: { title: string; value: string; detail: string; danger?: boolean }) {
  return (
    <section style={{ border: "1px solid #ddd", borderRadius: 14, padding: 18, background: danger ? "#fff7ed" : "#f0fff4" }}>
      <p style={{ margin: 0, color: "#555" }}>{title}</p>
      <h2 style={{ margin: "8px 0" }}>{value}</h2>
      <p style={{ margin: 0 }}>{detail}</p>
    </section>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ border: "1px solid #ddd", borderRadius: 14, padding: 18, background: "#fff" }}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <div style={{ display: "grid", gap: 10 }}>{children}</div>
    </section>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
      <p style={{ margin: 0, color: "#555" }}>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}

function Item({ title, detail, time }: { title: string; detail: string; time: string }) {
  return (
    <article style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
      <strong>{title}</strong>
      <p style={{ margin: "6px 0", color: "#555", overflowWrap: "anywhere" }}>{detail}</p>
      <small>{new Date(time).toLocaleString()}</small>
    </article>
  );
}

const buttonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #111",
  cursor: "pointer",
  fontWeight: 700,
};

const linkStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #ddd",
  color: "#111",
  textDecoration: "none",
  fontWeight: 700,
};
