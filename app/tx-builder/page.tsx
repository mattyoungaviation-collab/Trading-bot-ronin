"use client";

import { useEffect, useState } from "react";

type TxBuilderData = {
  generatedAt: string;
  ready: boolean;
  preview: any | null;
  transaction: { to: string; value: string; data: string } | null;
  blockers: string[];
  warnings: string[];
};

function num(value: number | undefined | null, digits = 8) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: digits });
}

export default function TxBuilderPage() {
  const [data, setData] = useState<TxBuilderData | null>(null);
  const [status, setStatus] = useState("Loading transaction builder...");
  const [loading, setLoading] = useState(false);

  async function loadBuilder() {
    setLoading(true);
    try {
      const response = await fetch("/api/tx-builder", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Transaction builder failed.");
      setData(json);
      setStatus("Transaction builder loaded.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Transaction builder failed.");
    } finally {
      setLoading(false);
    }
  }

  async function copyText(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    setStatus(`${label} copied.`);
  }

  useEffect(() => {
    loadBuilder();
  }, []);

  return (
    <main style={{ padding: 32, fontFamily: "Arial, sans-serif", maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ marginBottom: 8 }}>Manual Transaction Builder</h1>
          <p style={{ marginTop: 0, color: "#555" }}>Builds calldata from the latest accepted decision. It does not approve, sign, or send transactions.</p>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <a href="/" style={linkStyle}>Home</a>
          <a href="/live-preview" style={linkStyle}>Live Preview</a>
          <a href="/live" style={linkStyle}>Live Gate</a>
          <button onClick={loadBuilder} disabled={loading} style={buttonStyle}>{loading ? "Refreshing..." : "Refresh"}</button>
        </div>
      </div>

      <section style={{ border: "1px solid #ddd", borderRadius: 14, padding: 18, margin: "20px 0", background: "#f8fafc" }}>
        <strong>Status:</strong> {status}
        {data ? <p style={{ marginBottom: 0 }}>Last checked: {new Date(data.generatedAt).toLocaleString()}</p> : null}
      </section>

      {data ? (
        <>
          <section style={{ border: "1px solid #ddd", borderRadius: 14, padding: 18, marginBottom: 24, background: data.ready ? "#f0fff4" : "#fff7ed" }}>
            <h2 style={{ marginTop: 0 }}>Readiness</h2>
            <p><strong>Ready:</strong> {data.ready ? "YES" : "NO"}</p>
            {data.blockers.length ? <ul>{data.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul> : <p>No blockers.</p>}
          </section>

          {data.warnings.length ? (
            <section style={{ border: "1px solid #ddd", borderRadius: 14, padding: 18, marginBottom: 24, background: "#fff7ed" }}>
              <h2 style={{ marginTop: 0 }}>Warnings</h2>
              <ul>{data.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
            </section>
          ) : null}

          {data.preview ? (
            <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 18, marginBottom: 24 }}>
              <Panel title="Swap Details">
                <Mini label="Route" value={`${data.preview.tokenInSymbol} → ${data.preview.tokenOutSymbol}`} />
                <Mini label="Amount In" value={`${num(data.preview.amountIn, 6)} ${data.preview.tokenInSymbol}`} />
                <Mini label="Expected Out" value={`${num(data.preview.expectedAmountOut, 8)} ${data.preview.tokenOutSymbol}`} />
                <Mini label="Minimum Out" value={`${num(data.preview.minimumAmountOut, 8)} ${data.preview.tokenOutSymbol}`} />
                <Mini label="Slippage" value={`${data.preview.maxSlippagePct}%`} />
                <Mini label="Fee Tier" value={String(data.preview.feeTier)} />
              </Panel>
              <Panel title="Contracts">
                <Mini label="Router" value={data.preview.routerAddress} />
                <Mini label="Recipient" value={data.preview.recipientAddress} />
                <Mini label="Token In" value={data.preview.tokenInAddress} />
                <Mini label="Token Out" value={data.preview.tokenOutAddress} />
                <Mini label="Deadline" value={data.preview.deadlineHuman} />
              </Panel>
              <Panel title="Decision Source">
                <Mini label="Decision ID" value={String(data.preview.decisionId)} />
                <Mini label="Quote ID" value={String(data.preview.quoteId)} />
                <Mini label="Trade Score" value={String(data.preview.tradeScore)} />
                <Mini label="Entry Price" value={num(data.preview.entryPrice, 10)} />
              </Panel>
            </section>
          ) : null}

          {data.transaction ? (
            <section style={{ border: "1px solid #ddd", borderRadius: 14, padding: 18 }}>
              <h2 style={{ marginTop: 0 }}>Transaction Payload</h2>
              <Payload label="To" value={data.transaction.to} onCopy={() => copyText(data.transaction!.to, "To address")} />
              <Payload label="Value" value={data.transaction.value} onCopy={() => copyText(data.transaction!.value, "Value")} />
              <Payload label="Data" value={data.transaction.data} onCopy={() => copyText(data.transaction!.data, "Calldata")} />
            </section>
          ) : null}
        </>
      ) : null}
    </main>
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

function Payload({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <strong>{label}</strong>
        <button onClick={onCopy} style={buttonStyle}>Copy</button>
      </div>
      <p style={{ overflowWrap: "anywhere", color: "#555" }}>{value}</p>
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
