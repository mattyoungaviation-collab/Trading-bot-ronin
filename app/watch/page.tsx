"use client";

import { useEffect, useState } from "react";

type WatchToken = {
  id: number;
  name: string;
  symbol: string;
  contractAddress: string;
  decimals: number;
  pairAddress: string | null;
  poolType: string;
  baseToken: string;
  isActive: boolean;
  notes: string | null;
  readiness: {
    ready: boolean;
    reasons: string[];
  };
};

type WatchData = {
  generatedAt: string;
  settings: {
    botMode: string;
    emergencyStop: boolean;
    maxTradeSizeUsd: number;
    maxBuyImpactPct: number;
    maxSellImpactPct: number;
    maxRoundTripImpactPct: number;
    minPoolLiquidityUsd: number;
    minTradeScore: number;
  } | null;
  rpcStatus: {
    ok: boolean;
    rpcUrl: string;
    expectedChainId: number;
    chainId: number | null;
    blockNumber: number | null;
    message: string;
  };
  tokens: WatchToken[];
  observations: string[];
};

export default function WatchPage() {
  const [data, setData] = useState<WatchData | null>(null);
  const [status, setStatus] = useState("Loading watch status...");
  const [refreshing, setRefreshing] = useState(false);

  async function loadWatchStatus() {
    setRefreshing(true);
    try {
      const response = await fetch("/api/watch", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Watch status failed.");
      setData(json);
      setStatus("Watch status loaded.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load watch status.");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadWatchStatus();
  }, []);

  return (
    <main style={{ padding: 32, fontFamily: "Arial, sans-serif", maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ marginBottom: 8 }}>Watch Mode</h1>
          <p style={{ marginTop: 0, color: "#555" }}>Safe read only status for Ronin RPC, bot settings, and token readiness. No trades. No wallet. No private key.</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <a href="/settings" style={linkStyle}>Settings</a>
          <a href="/tokens" style={linkStyle}>Tokens</a>
          <button onClick={loadWatchStatus} disabled={refreshing} style={buttonStyle}>{refreshing ? "Refreshing..." : "Refresh"}</button>
        </div>
      </div>

      <section style={{ border: "1px solid #ddd", borderRadius: 14, padding: 18, margin: "20px 0", background: "#f8fafc" }}>
        <strong>Status:</strong> {status}
        {data ? <p style={{ marginBottom: 0 }}>Last checked: {new Date(data.generatedAt).toLocaleString()}</p> : null}
      </section>

      {data ? (
        <>
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 24 }}>
            <Card title="Bot Mode" value={data.settings?.botMode || "UNKNOWN"} detail={data.settings?.emergencyStop ? "Emergency Stop ON" : "Emergency Stop OFF"} danger={!data.settings?.emergencyStop || data.settings?.botMode === "LIVE"} />
            <Card title="Ronin RPC" value={data.rpcStatus.ok ? "Connected" : "Problem"} detail={`Chain ${data.rpcStatus.chainId || "?"} / Block ${data.rpcStatus.blockNumber || "?"}`} danger={!data.rpcStatus.ok} />
            <Card title="Active Tokens" value={String(data.tokens.filter((token) => token.isActive).length)} detail="Tokens enabled for watching" />
            <Card title="Ready Tokens" value={String(data.tokens.filter((token) => token.readiness.ready).length)} detail="Have contract and pool data" />
          </section>

          <section style={{ border: "1px solid #ddd", borderRadius: 14, padding: 18, marginBottom: 24 }}>
            <h2>Observations</h2>
            <ul>
              {data.observations.map((observation, index) => (
                <li key={index} style={{ marginBottom: 8 }}>{observation}</li>
              ))}
            </ul>
          </section>

          <section style={{ border: "1px solid #ddd", borderRadius: 14, padding: 18, marginBottom: 24 }}>
            <h2>Current Risk Settings</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <MiniStat label="Max Trade" value={`$${data.settings?.maxTradeSizeUsd ?? "?"}`} />
              <MiniStat label="Buy Impact" value={`${data.settings?.maxBuyImpactPct ?? "?"}%`} />
              <MiniStat label="Sell Impact" value={`${data.settings?.maxSellImpactPct ?? "?"}%`} />
              <MiniStat label="Round Trip Impact" value={`${data.settings?.maxRoundTripImpactPct ?? "?"}%`} />
              <MiniStat label="Min Liquidity" value={`$${data.settings?.minPoolLiquidityUsd ?? "?"}`} />
              <MiniStat label="Min Score" value={`${data.settings?.minTradeScore ?? "?"}`} />
            </div>
          </section>

          <section>
            <h2>Token Readiness</h2>
            <div style={{ display: "grid", gap: 14 }}>
              {data.tokens.length === 0 ? <p>No tokens added yet. Go to /tokens and add one.</p> : null}
              {data.tokens.map((token) => (
                <article key={token.id} style={{ border: "1px solid #ddd", borderRadius: 14, padding: 16, background: token.readiness.ready ? "#f0fff4" : "#fff7ed" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <h3 style={{ margin: 0 }}>{token.symbol} · {token.name}</h3>
                      <p style={{ margin: "8px 0", color: "#555" }}>{token.isActive ? "Active" : "Inactive"} / {token.poolType} / Base {token.baseToken}</p>
                      <p style={{ margin: "8px 0", overflowWrap: "anywhere" }}><strong>Contract:</strong> {token.contractAddress}</p>
                      <p style={{ margin: "8px 0", overflowWrap: "anywhere" }}><strong>Pool:</strong> {token.pairAddress || "Missing"}</p>
                    </div>
                    <div style={{ minWidth: 180 }}>
                      <strong>{token.readiness.ready ? "Ready" : "Needs Review"}</strong>
                      {token.readiness.reasons.length ? (
                        <ul style={{ paddingLeft: 18 }}>
                          {token.readiness.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                        </ul>
                      ) : <p>Ready for pool watching.</p>}
                    </div>
                  </div>
                </article>
              ))}
            </div>
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
      <p style={{ margin: 0 }}>{detail}</p>
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
      <p style={{ margin: 0, color: "#555" }}>{label}</p>
      <strong>{value}</strong>
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

const linkStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #ddd",
  color: "#111",
  textDecoration: "none",
  fontWeight: 700,
};
