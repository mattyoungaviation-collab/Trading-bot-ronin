"use client";

import { useState } from "react";

type Decision = {
  id: number;
  token: {
    id: number;
    symbol: string;
    name: string;
    contractAddress: string;
    pairAddress: string | null;
    poolType: string;
    isActive: boolean;
  };
  accepted: boolean;
  tradeScore: number;
  expectedProfitPct: number;
  reasons: Array<{ code: string; message: string; severity: string }>;
  createdAt: string;
};

type DecisionResponse = {
  generatedAt: string;
  settings: { botMode: string; emergencyStop: boolean; minTradeScore: number } | null;
  decisions: Decision[];
};

export default function DecisionsPage() {
  const [data, setData] = useState<DecisionResponse | null>(null);
  const [status, setStatus] = useState("Run a decision scan to score tokens.");
  const [loading, setLoading] = useState(false);

  async function runScan() {
    setLoading(true);
    setStatus("Running conservative decision scan...");
    try {
      const response = await fetch("/api/decisions", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Decision scan failed.");
      setData(json);
      setStatus("Decision scan complete.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Decision scan failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 32, fontFamily: "Arial, sans-serif", maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ marginBottom: 8 }}>Trade Decisions</h1>
          <p style={{ marginTop: 0, color: "#555" }}>Read only trade scoring. The bot must prove it can reject bad setups before paper trading.</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <a href="/watch" style={linkStyle}>Watch</a>
          <a href="/paper" style={linkStyle}>Paper</a>
          <button onClick={runScan} disabled={loading} style={buttonStyle}>{loading ? "Scanning..." : "Run Scan"}</button>
        </div>
      </div>

      <section style={{ border: "1px solid #ddd", borderRadius: 14, padding: 18, margin: "20px 0", background: "#f8fafc" }}>
        <strong>Status:</strong> {status}
        {data ? <p style={{ marginBottom: 0 }}>Last scan: {new Date(data.generatedAt).toLocaleString()}</p> : null}
      </section>

      {data ? (
        <>
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 24 }}>
            <Card title="Bot Mode" value={data.settings?.botMode || "UNKNOWN"} detail={data.settings?.emergencyStop ? "Emergency Stop ON" : "Emergency Stop OFF"} danger={!data.settings?.emergencyStop || data.settings?.botMode === "LIVE"} />
            <Card title="Minimum Score" value={String(data.settings?.minTradeScore ?? "?")} detail="Required for future accepted trades" />
            <Card title="Scanned Tokens" value={String(data.decisions.length)} detail="Tokens evaluated" />
            <Card title="Accepted" value={String(data.decisions.filter((decision) => decision.accepted).length)} detail="Should be zero in this stage" danger={data.decisions.some((decision) => decision.accepted)} />
          </section>

          <section style={{ display: "grid", gap: 14 }}>
            {data.decisions.length === 0 ? <p>No tokens to scan. Add tokens on /tokens.</p> : null}
            {data.decisions.map((decision) => (
              <article key={decision.id} style={{ border: "1px solid #ddd", borderRadius: 14, padding: 16, background: decision.accepted ? "#f0fff4" : "#fff7ed" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <h2 style={{ margin: 0 }}>{decision.accepted ? "ACCEPTED" : "REJECTED"} · {decision.token.symbol}</h2>
                    <p style={{ margin: "8px 0", color: "#555" }}>{decision.token.name} / Score {decision.tradeScore} / Expected profit {decision.expectedProfitPct}%</p>
                    <p style={{ margin: "8px 0", overflowWrap: "anywhere" }}><strong>Contract:</strong> {decision.token.contractAddress}</p>
                    <p style={{ margin: "8px 0", overflowWrap: "anywhere" }}><strong>Pool:</strong> {decision.token.pairAddress || "Missing"}</p>
                  </div>
                  <div style={{ minWidth: 260 }}>
                    <strong>Reasons</strong>
                    <ul style={{ paddingLeft: 18 }}>
                      {decision.reasons.map((reason) => (
                        <li key={reason.code} style={{ marginBottom: 6 }}>{reason.code}: {reason.message}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            ))}
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
