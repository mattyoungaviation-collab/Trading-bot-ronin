"use client";

import { useEffect, useState } from "react";

type LivePreviewData = {
  generatedAt: string;
  readyForPreview: boolean;
  settings: { botMode: string; emergencyStop: boolean; maxSlippagePct: number } | null;
  wallet: { ok: boolean; maskedAddress: string | null; ronBalance: number | null; message: string };
  acceptedDecision: any | null;
  token: any | null;
  quote: any | null;
  preview: any | null;
  blockers: string[];
};

function money(value: number | undefined | null) {
  return `$${Number(value || 0).toFixed(6)}`;
}

function num(value: number | undefined | null, digits = 8) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: digits });
}

export default function LivePreviewPage() {
  const [data, setData] = useState<LivePreviewData | null>(null);
  const [status, setStatus] = useState("Loading live preview...");
  const [loading, setLoading] = useState(false);

  async function loadPreview() {
    setLoading(true);
    try {
      const response = await fetch("/api/live-preview", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Live preview failed.");
      setData(json);
      setStatus("Live preview loaded.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Live preview failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPreview();
  }, []);

  return (
    <main style={{ padding: 32, fontFamily: "Arial, sans-serif", maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ marginBottom: 8 }}>Live Transaction Preview</h1>
          <p style={{ marginTop: 0, color: "#555" }}>Shows what the bot would prepare for a real Katana V3 swap. This page does not sign or send transactions.</p>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <a href="/live" style={linkStyle}>Live Gate</a>
          <a href="/quotes" style={linkStyle}>Quotes</a>
          <a href="/decisions" style={linkStyle}>Decisions</a>
          <a href="/settings" style={linkStyle}>Settings</a>
          <button onClick={loadPreview} disabled={loading} style={buttonStyle}>{loading ? "Refreshing..." : "Refresh Preview"}</button>
        </div>
      </div>

      <section style={{ border: "1px solid #ddd", borderRadius: 14, padding: 18, margin: "20px 0", background: "#f8fafc" }}>
        <strong>Status:</strong> {status}
        {data ? <p style={{ marginBottom: 0 }}>Last checked: {new Date(data.generatedAt).toLocaleString()}</p> : null}
      </section>

      {data ? (
        <>
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 16, marginBottom: 24 }}>
            <Card title="Preview Ready" value={data.readyForPreview ? "YES" : "NO"} detail="All preview blockers clear" danger={!data.readyForPreview} />
            <Card title="Bot Mode" value={data.settings?.botMode || "UNKNOWN"} detail={data.settings?.emergencyStop ? "Emergency Stop ON" : "Emergency Stop OFF"} danger={data.settings?.botMode !== "LIVE" || !!data.settings?.emergencyStop} />
            <Card title="Wallet" value={data.wallet.ok ? "Detected" : "Missing"} detail={data.wallet.maskedAddress || data.wallet.message} danger={!data.wallet.ok} />
            <Card title="RON Balance" value={data.wallet.ronBalance === null ? "?" : data.wallet.ronBalance.toFixed(6)} detail="Gas balance" danger={data.wallet.ronBalance !== null && data.wallet.ronBalance <= 0} />
          </section>

          <section style={{ border: "1px solid #ddd", borderRadius: 14, padding: 18, marginBottom: 24, background: data.blockers.length ? "#fff7ed" : "#f0fff4" }}>
            <h2 style={{ marginTop: 0 }}>Blockers</h2>
            {data.blockers.length === 0 ? <p>No preview blockers. This is still preview only and does not send swaps.</p> : null}
            <ul>
              {data.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
            </ul>
          </section>

          {data.preview ? (
            <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 18 }}>
              <Panel title="Swap Preview">
                <Mini label="Type" value={data.preview.type} />
                <Mini label="Route" value={`${data.preview.tokenInSymbol} → ${data.preview.tokenOutSymbol}`} />
                <Mini label="Amount In" value={`${num(data.preview.amountIn, 6)} ${data.preview.tokenInSymbol}`} />
                <Mini label="Expected Out" value={`${num(data.preview.expectedAmountOut, 8)} ${data.preview.tokenOutSymbol}`} />
                <Mini label="Minimum Out" value={`${num(data.preview.minimumAmountOut, 8)} ${data.preview.tokenOutSymbol}`} />
                <Mini label="Max Slippage" value={`${data.preview.maxSlippagePct}%`} />
                <Mini label="Entry Price" value={num(data.preview.entryPrice, 10)} />
              </Panel>

              <Panel title="Contracts">
                <Mini label="Router" value={data.preview.maskedRouterAddress || "Missing"} />
                <Mini label="Quoter" value={data.preview.maskedQuoterAddress || "Missing"} />
                <Mini label="Token In" value={data.preview.tokenInAddress} />
                <Mini label="Token Out" value={data.preview.tokenOutAddress} />
                <Mini label="Fee Tier" value={String(data.preview.feeTier)} />
              </Panel>

              <Panel title="Decision And Quote">
                <Mini label="Decision ID" value={String(data.preview.decisionId)} />
                <Mini label="Trade Score" value={String(data.preview.tradeScore)} />
                <Mini label="Required Move" value={`${Number(data.preview.expectedProfitPct || 0).toFixed(4)}%`} />
                <Mini label="Quote ID" value={String(data.preview.quoteId)} />
                <Mini label="Quote Time" value={new Date(data.preview.quoteCreatedAt).toLocaleString()} />
                <Mini label="Deadline" value={data.preview.deadlineHuman} />
              </Panel>

              <Panel title="Raw Transaction Inputs">
                <Mini label="amountInRaw" value={data.preview.amountInRaw || "Unavailable"} />
                <Mini label="minimumAmountOutRaw" value={data.preview.minimumAmountOutRaw || "Unavailable"} />
                <Mini label="Warning" value={data.preview.warning} />
              </Panel>
            </section>
          ) : (
            <section style={{ border: "1px solid #ddd", borderRadius: 14, padding: 18 }}>
              <h2>No Preview Yet</h2>
              <p>Run /quotes, then /decisions. Make sure there is an accepted decision and LIVE readiness values are present.</p>
            </section>
          )}
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

const linkStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #ddd",
  color: "#111",
  textDecoration: "none",
  fontWeight: 700,
};
