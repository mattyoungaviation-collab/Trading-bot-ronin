"use client";

import { useState } from "react";

type StepStatus = "idle" | "running" | "success" | "error";

type CycleStep = {
  name: string;
  status: StepStatus;
  message: string;
  data?: any;
};

const initialSteps: CycleStep[] = [
  { name: "Quotes", status: "idle", message: "Waiting to run quote scan." },
  { name: "Decisions", status: "idle", message: "Waiting to run decision scan." },
  { name: "Paper", status: "idle", message: "Waiting to create paper trades from accepted decisions." },
  { name: "Refresh", status: "idle", message: "Waiting to refresh paper manager state." },
];

function countQuoted(data: any) {
  return Array.isArray(data?.results) ? data.results.filter((result: any) => result.ok).length : 0;
}

function countAccepted(data: any) {
  return Array.isArray(data?.decisions) ? data.decisions.filter((decision: any) => decision.accepted).length : 0;
}

export default function CyclePage() {
  const [steps, setSteps] = useState<CycleStep[]>(initialSteps);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("Ready to run a safe paper cycle.");

  function updateStep(index: number, patch: Partial<CycleStep>) {
    setSteps((current) => current.map((step, stepIndex) => stepIndex === index ? { ...step, ...patch } : step));
  }

  async function requestJson(url: string, options?: RequestInit) {
    const response = await fetch(url, { cache: "no-store", ...options });
    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.error || `${url} failed with ${response.status}`);
    }
    return json;
  }

  async function runCycle() {
    setRunning(true);
    setStatus("Running quote → decision → paper cycle...");
    setSteps(initialSteps.map((step) => ({ ...step, status: "idle" as StepStatus })));

    try {
      updateStep(0, { status: "running", message: "Running live quote scan..." });
      const quotes = await requestJson("/api/quotes");
      updateStep(0, {
        status: "success",
        message: `Quote scan complete. ${countQuoted(quotes)} token(s) quoted out of ${quotes.results?.length || 0}.`,
        data: quotes,
      });

      updateStep(1, { status: "running", message: "Running decision scan from latest quotes..." });
      const decisions = await requestJson("/api/decisions");
      updateStep(1, {
        status: "success",
        message: `Decision scan complete. ${countAccepted(decisions)} accepted decision(s) out of ${decisions.decisions?.length || 0}.`,
        data: decisions,
      });

      updateStep(2, { status: "running", message: "Creating paper trades from accepted decisions..." });
      const paperCreate = await requestJson("/api/paper", { method: "POST" });
      updateStep(2, {
        status: "success",
        message: `Paper trade step complete. Created ${paperCreate.created?.length || 0}. Rejected ${paperCreate.rejected?.length || 0}.`,
        data: paperCreate,
      });

      updateStep(3, { status: "running", message: "Refreshing paper manager state..." });
      const paper = await requestJson("/api/paper");
      updateStep(3, {
        status: "success",
        message: `Paper refresh complete. Open ${paper.summary?.openTrades || 0}. Realized ${money(paper.summary?.realizedPnl)}. Unrealized ${money(paper.summary?.unrealizedPnl)}.`,
        data: paper,
      });

      setStatus("Cycle complete.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cycle failed.";
      setStatus(message);
      setSteps((current) => current.map((step) => step.status === "running" ? { ...step, status: "error", message } : step));
    } finally {
      setRunning(false);
    }
  }

  return (
    <main style={{ padding: 32, fontFamily: "Arial, sans-serif", maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ marginBottom: 8 }}>Paper Cycle Runner</h1>
          <p style={{ marginTop: 0, color: "#555" }}>Runs the safe loop: quotes, decisions, paper trades, then paper refresh. No wallet. No private key. No live swaps.</p>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <a href="/dashboard" style={linkStyle}>Dashboard</a>
          <a href="/quotes" style={linkStyle}>Quotes</a>
          <a href="/decisions" style={linkStyle}>Decisions</a>
          <a href="/paper" style={linkStyle}>Paper</a>
          <button onClick={runCycle} disabled={running} style={buttonStyle}>{running ? "Running..." : "Run Paper Cycle"}</button>
        </div>
      </div>

      <section style={{ border: "1px solid #ddd", borderRadius: 14, padding: 18, margin: "20px 0", background: "#f8fafc" }}>
        <strong>Status:</strong> {status}
      </section>

      <section style={{ display: "grid", gap: 14 }}>
        {steps.map((step, index) => (
          <article key={step.name} style={{ border: "1px solid #ddd", borderRadius: 14, padding: 16, background: stepColor(step.status) }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <h2 style={{ margin: 0 }}>{index + 1}. {step.name}</h2>
                <p style={{ marginBottom: 0 }}>{step.message}</p>
              </div>
              <strong>{step.status.toUpperCase()}</strong>
            </div>
          </article>
        ))}
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 14, padding: 18, marginTop: 24, background: "#fff7ed" }}>
        <h2 style={{ marginTop: 0 }}>Before running</h2>
        <p>For the paper cycle to create trades, set Bot Mode to PAPER and Emergency Stop to OFF in /settings. If Emergency Stop is ON, the bot will still quote and decide, but paper trade creation will be blocked.</p>
      </section>
    </main>
  );
}

function money(value: number | undefined | null) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function stepColor(status: StepStatus) {
  if (status === "success") return "#f0fff4";
  if (status === "running") return "#eff6ff";
  if (status === "error") return "#fff7ed";
  return "#f8fafc";
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
