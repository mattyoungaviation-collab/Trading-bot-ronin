"use client";

import { useEffect, useState } from "react";

type TrackedTrade = {
  id: number;
  tokenId: number;
  side: string;
  txHash: string | null;
  status: string;
  pnl: number;
  createdAt: string;
  explorerUrl: string | null;
  chainStatus: any | null;
};

type TrackerData = {
  generatedAt: string;
  liveTrades: TrackedTrade[];
};

export default function LiveTrackerPage() {
  const [data, setData] = useState<TrackerData | null>(null);
  const [txHash, setTxHash] = useState("");
  const [side, setSide] = useState("BUY");
  const [tokenId, setTokenId] = useState("");
  const [note, setNote] = useState("manual transaction");
  const [status, setStatus] = useState("Loading tracker...");
  const [loading, setLoading] = useState(false);

  async function loadTracker() {
    setLoading(true);
    try {
      const response = await fetch("/api/live-tracker", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Tracker load failed.");
      setData(json);
      setStatus("Tracker loaded.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Tracker load failed.");
    } finally {
      setLoading(false);
    }
  }

  async function trackTx() {
    setLoading(true);
    setStatus("Tracking transaction...");
    try {
      const response = await fetch("/api/live-tracker", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash, side, tokenId: tokenId ? Number(tokenId) : undefined, note }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Track transaction failed.");
      setStatus(`Tracked transaction: ${json.chainStatus.status}`);
      setTxHash("");
      await loadTracker();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Track transaction failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTracker();
  }, []);

  return (
    <main style={{ padding: 32, fontFamily: "Arial, sans-serif", maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ marginBottom: 8 }}>Live Transaction Tracker</h1>
          <p style={{ marginTop: 0, color: "#555" }}>Paste manually sent approval or swap hashes and track confirmation status on Ronin.</p>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <a href="/" style={linkStyle}>Home</a>
          <a href="/approval-builder" style={linkStyle}>Approval Builder</a>
          <a href="/tx-builder" style={linkStyle}>Swap Builder</a>
          <button onClick={loadTracker} disabled={loading} style={buttonStyle}>{loading ? "Refreshing..." : "Refresh"}</button>
        </div>
      </div>

      <section style={{ border: "1px solid #ddd", borderRadius: 14, padding: 18, margin: "20px 0", background: "#f8fafc" }}>
        <strong>Status:</strong> {status}
        {data ? <p style={{ marginBottom: 0 }}>Last checked: {new Date(data.generatedAt).toLocaleString()}</p> : null}
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 14, padding: 18, marginBottom: 24 }}>
        <h2 style={{ marginTop: 0 }}>Track Manual Transaction</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          <label>
            <strong>Transaction Hash</strong>
            <input value={txHash} onChange={(event) => setTxHash(event.target.value)} placeholder="0x..." style={inputStyle} />
          </label>
          <label>
            <strong>Side</strong>
            <select value={side} onChange={(event) => setSide(event.target.value)} style={inputStyle}>
              <option value="APPROVAL">APPROVAL</option>
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
          </label>
          <label>
            <strong>Token ID optional</strong>
            <input value={tokenId} onChange={(event) => setTokenId(event.target.value)} placeholder="Leave blank to use latest accepted decision" style={inputStyle} />
          </label>
          <label>
            <strong>Note</strong>
            <input value={note} onChange={(event) => setNote(event.target.value)} style={inputStyle} />
          </label>
        </div>
        <button onClick={trackTx} disabled={loading || !txHash} style={buttonStyle}>Track Transaction</button>
      </section>

      <section>
        <h2>Tracked Live Transactions</h2>
        <div style={{ display: "grid", gap: 14 }}>
          {data?.liveTrades.length === 0 ? <p>No tracked live transactions yet.</p> : null}
          {data?.liveTrades.map((trade) => (
            <article key={trade.id} style={{ border: "1px solid #ddd", borderRadius: 14, padding: 16, background: trade.status === "CONFIRMED" ? "#f0fff4" : trade.status === "FAILED" ? "#fff7ed" : "#f8fafc" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <h3 style={{ margin: 0 }}>{trade.side} · Token {trade.tokenId}</h3>
                  <p><strong>Status:</strong> {trade.status}</p>
                  <p style={{ overflowWrap: "anywhere" }}><strong>Hash:</strong> {trade.txHash || "No hash"}</p>
                  {trade.explorerUrl ? <p><a href={trade.explorerUrl} target="_blank" rel="noreferrer">Open in Ronin Explorer</a></p> : null}
                </div>
                <div>
                  <p><strong>Created:</strong> {new Date(trade.createdAt).toLocaleString()}</p>
                  {trade.chainStatus ? <p><strong>Confirmations:</strong> {trade.chainStatus.confirmations ?? "?"}</p> : null}
                  {trade.chainStatus?.blockNumber ? <p><strong>Block:</strong> {trade.chainStatus.blockNumber}</p> : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  marginTop: 8,
  width: "100%",
  padding: 10,
  border: "1px solid #ccc",
  borderRadius: 10,
  boxSizing: "border-box",
};

const buttonStyle: React.CSSProperties = {
  marginTop: 18,
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
