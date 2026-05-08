"use client";

import { useEffect, useState } from "react";

type LiveData = {
  generatedAt: string;
  settings: { botMode: string; emergencyStop: boolean; requireManualApproval: boolean } | null;
  env: {
    maskedRouterAddress: string | null;
    routerOk: boolean;
    maskedQuoterAddress: string | null;
    quoterOk: boolean;
    livePrivateKeySet: boolean;
    liveExecutionEnabled: boolean;
  };
  walletStatus: {
    ok: boolean;
    maskedAddress: string | null;
    ronBalance: number | null;
    message: string;
  };
  recentAcceptedDecisions: any[];
  liveTrades: any[];
  readyForLiveExecution: boolean;
  blockers: string[];
};

export default function LivePage() {
  const [data, setData] = useState<LiveData | null>(null);
  const [status, setStatus] = useState("Loading live readiness...");
  const [loading, setLoading] = useState(false);

  async function loadLive() {
    try {
      const response = await fetch("/api/live", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Live readiness load failed.");
      setData(json);
      setStatus("Live readiness loaded.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Live readiness load failed.");
    }
  }

  async function testLiveReadiness() {
    setLoading(true);
    setStatus("Testing live readiness checks...");
    try {
      const response = await fetch("/api/live", { method: "POST", cache: "no-store" });
      const json = await response.json();
      setStatus(json.message || "Live readiness test complete.");
      await loadLive();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Live readiness test failed.");
      await loadLive();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLive();
  }, []);

  return (
    <main style={{ padding: 32, fontFamily: "Arial, sans-serif", maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ marginBottom: 8 }}>Live Trading Readiness</h1>
          <p style={{ marginTop: 0, color: "#555" }}>Safety gate before any real wallet execution. This page does not send swaps.</p>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <a href="/settings" style={linkStyle}>Settings</a>
          <a href="/cycle" style={linkStyle}>Cycle</a>
          <a href="/paper" style={linkStyle}>Paper</a>
          <button onClick={loadLive} disabled={loading} style={buttonStyle}>Refresh</button>
          <button onClick={testLiveReadiness} disabled={loading} style={dangerButtonStyle}>{loading ? "Checking..." : "Test Live Readiness"}</button>
        </div>
      </div>

      <section style={{ border: "1px solid #ddd", borderRadius: 14, padding: 18, margin: "20px 0", background: "#f8fafc" }}>
        <strong>Status:</strong> {status}
        {data ? <p style={{ marginBottom: 0 }}>Last checked: {new Date(data.generatedAt).toLocaleString()}</p> : null}
      </section>

      {data ? (
        <>
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 24 }}>
            <Card title="Ready" value={data.readyForLiveExecution ? "YES" : "NO"} detail="All live blockers clear" danger={!data.readyForLiveExecution} />
            <Card title="Bot Mode" value={data.settings?.botMode || "UNKNOWN"} detail={data.settings?.emergencyStop ? "Emergency Stop ON" : "Emergency Stop OFF"} danger={data.settings?.botMode !== "LIVE" || !!data.settings?.emergencyStop} />
            <Card title="Wallet" value={data.walletStatus.ok ? "Detected" : "Missing"} detail={data.walletStatus.maskedAddress || data.walletStatus.message} danger={!data.walletStatus.ok} />
            <Card title="RON Balance" value={data.walletStatus.ronBalance === null ? "?" : data.walletStatus.ronBalance.toFixed(6)} detail="Gas wallet balance" danger={data.walletStatus.ronBalance !== null && data.walletStatus.ronBalance <= 0} />
            <Card title="Router" value={data.env.routerOk ? "Set" : "Missing"} detail={data.env.maskedRouterAddress || "No router env var"} danger={!data.env.routerOk} />
            <Card title="Execution Flag" value={data.env.liveExecutionEnabled ? "Enabled" : "Disabled"} detail="LIVE_EXECUTION_ENABLED" danger={!data.env.liveExecutionEnabled} />
          </section>

          <section style={{ border: "1px solid #ddd", borderRadius: 14, padding: 18, marginBottom: 24, background: data.blockers.length ? "#fff7ed" : "#f0fff4" }}>
            <h2 style={{ marginTop: 0 }}>Blockers</h2>
            {data.blockers.length === 0 ? <p>No blockers. Live readiness checks passed, but swap sending still requires router ABI and exact path verification.</p> : null}
            <ul>
              {data.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
            </ul>
          </section>

          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 18 }}>
            <Panel title="Environment Checklist">
              <Mini label="Quoter" value={data.env.quoterOk ? data.env.maskedQuoterAddress || "Set" : "Missing"} />
              <Mini label="Router" value={data.env.routerOk ? data.env.maskedRouterAddress || "Set" : "Missing"} />
              <Mini label="Private Key" value={data.env.livePrivateKeySet ? "Set in Render" : "Not set"} />
              <Mini label="Live Execution" value={data.env.liveExecutionEnabled ? "Enabled" : "Disabled"} />
            </Panel>

            <Panel title="Recent Accepted Decisions">
              {data.recentAcceptedDecisions.length === 0 ? <p>No accepted decisions yet.</p> : null}
              {data.recentAcceptedDecisions.map((decision) => (
                <Mini key={decision.id} label={`Decision ${decision.id}`} value={`Token ${decision.tokenId} / Score ${decision.tradeScore}`} />
              ))}
            </Panel>

            <Panel title="Live Trade Log">
              {data.liveTrades.length === 0 ? <p>No live trade records yet.</p> : null}
              {data.liveTrades.map((trade) => (
                <Mini key={trade.id} label={`${trade.side} token ${trade.tokenId}`} value={`${trade.status} / ${trade.txHash || "No tx"}`} />
              ))}
            </Panel>
          </section>
        </>
      ) : null}
    </main>
  );
}

function Card({ title, value, detail, danger = false }: { title: string; value: string; detail: string; danger?: boolean }) {
  return (
    <section style={{ border: "1px solid #ddd", borderRadius: 14, padding: 18, background: danger ? "#fff7ed" : "#f0fff4" }}>
      <p style={{ margin: 0, color: "#555" }}>{title}</p>
      <h2 style={{ margin: "8px 0" }}>{value}</h2>
      <p style={{ margin: 0, overflowWrap: "anywhere" }}>{detail}</p>
    </section>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ border: "1px solid #ddd", borderRadius: 14, padding: 18 }}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <div style={{ display: "grid", gap: 10 }}>{children}</div>
    </section>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
      <p style={{ margin: 0, color: "#555" }}>{label}</p>
      <strong style={{ overflowWrap: "anywhere" }}>{value}</strong>
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #111",
  cursor: "pointer",
  fontWeight: 700,
};

const dangerButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #991b1b",
  color: "#991b1b",
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
