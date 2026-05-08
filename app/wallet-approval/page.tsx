"use client";

import { useEffect, useState } from "react";
import { BrowserProvider, Contract, formatUnits } from "ethers";

const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 amount) returns (bool)",
];

declare global {
  interface Window {
    ethereum?: any;
  }
}

type ApprovalData = {
  ready: boolean;
  approval: {
    tokenSymbol: string;
    tokenAddress: string;
    spenderAddress: string;
    amount: number;
    amountRaw: string;
    decisionId: number;
    quoteId: number;
  } | null;
  transaction: { to: string; value: string; data: string } | null;
  blockers: string[];
  warnings: string[];
};

function short(address: string | null | undefined) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function num(value: string | number, digits = 8) {
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number(parsed || 0).toLocaleString(undefined, { maximumFractionDigits: digits });
}

export default function WalletApprovalPage() {
  const [approvalData, setApprovalData] = useState<ApprovalData | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [allowance, setAllowance] = useState<string | null>(null);
  const [allowanceHuman, setAllowanceHuman] = useState<string | null>(null);
  const [approvalNeeded, setApprovalNeeded] = useState<boolean | null>(null);
  const [status, setStatus] = useState("Load approval data, then connect your wallet.");
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  async function loadApprovalData() {
    setLoading(true);
    try {
      const response = await fetch("/api/approval-builder", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Approval data failed.");
      setApprovalData(json);
      setStatus(json.ready ? "Approval data loaded." : "Approval data loaded with blockers.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Approval data failed.");
    } finally {
      setLoading(false);
    }
  }

  async function connectWallet() {
    if (!window.ethereum) {
      setStatus("No injected wallet found. Open this page in a browser with Ronin Wallet or another EVM wallet installed.");
      return;
    }

    setLoading(true);
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const activeChain = await window.ethereum.request({ method: "eth_chainId" });
      setAccount(accounts[0]);
      setChainId(activeChain);
      setStatus(`Connected ${short(accounts[0])}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Wallet connection failed.");
    } finally {
      setLoading(false);
    }
  }

  async function checkAllowance() {
    if (!window.ethereum || !account || !approvalData?.approval) {
      setStatus("Connect wallet and load approval data first.");
      return;
    }

    setLoading(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const token = new Contract(approvalData.approval.tokenAddress, ERC20_ABI, provider);
      const decimals = Number(await token.decimals());
      const currentAllowance = await token.allowance(account, approvalData.approval.spenderAddress);
      setAllowance(currentAllowance.toString());
      setAllowanceHuman(formatUnits(currentAllowance, decimals));
      const needed = BigInt(currentAllowance.toString()) < BigInt(approvalData.approval.amountRaw);
      setApprovalNeeded(needed);
      setStatus(needed ? "Approval needed." : "Allowance is already enough.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Allowance check failed.");
    } finally {
      setLoading(false);
    }
  }

  async function requestExactApproval() {
    if (!window.ethereum || !account || !approvalData?.approval) {
      setStatus("Connect wallet and load approval data first.");
      return;
    }

    const confirmed = window.confirm(`Approve exactly ${approvalData.approval.amount} ${approvalData.approval.tokenSymbol} for the Katana router? This is not an unlimited approval.`);
    if (!confirmed) return;

    setLoading(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const token = new Contract(approvalData.approval.tokenAddress, ERC20_ABI, signer);
      const tx = await token.approve(approvalData.approval.spenderAddress, BigInt(approvalData.approval.amountRaw));
      setTxHash(tx.hash);
      setStatus(`Approval submitted: ${tx.hash}`);

      await fetch("/api/live-tracker", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash: tx.hash, side: "APPROVAL", note: "wallet exact approval" }),
      });

      await tx.wait();
      setStatus("Approval confirmed. You can now refresh /tx-builder and prepare the swap payload.");
      await checkAllowance();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Approval failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadApprovalData();
  }, []);

  return (
    <main style={{ padding: 32, fontFamily: "Arial, sans-serif", maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ marginBottom: 8 }}>Wallet Approval</h1>
          <p style={{ marginTop: 0, color: "#555" }}>Connect your wallet and approve the exact quote amount. No backend private key. No unlimited approval.</p>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <a href="/" style={linkStyle}>Home</a>
          <a href="/approval-builder" style={linkStyle}>Approval Builder</a>
          <a href="/tx-builder" style={linkStyle}>Swap Builder</a>
          <a href="/live-tracker" style={linkStyle}>Tracker</a>
          <button onClick={loadApprovalData} disabled={loading} style={buttonStyle}>Refresh Data</button>
          <button onClick={connectWallet} disabled={loading} style={buttonStyle}>Connect Wallet</button>
        </div>
      </div>

      <section style={{ border: "1px solid #ddd", borderRadius: 14, padding: 18, margin: "20px 0", background: "#f8fafc" }}>
        <strong>Status:</strong> {status}
        {txHash ? <p style={{ overflowWrap: "anywhere" }}><strong>Last tx:</strong> {txHash}</p> : null}
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 16, marginBottom: 24 }}>
        <Card title="Wallet" value={account ? short(account) : "Not connected"} detail={account || "Connect wallet first"} danger={!account} />
        <Card title="Chain" value={chainId || "Unknown"} detail="Ronin mainnet should be 0x7e4" danger={!!chainId && chainId !== "0x7e4"} />
        <Card title="Approval Data" value={approvalData?.ready ? "Ready" : "Blocked"} detail={`${approvalData?.blockers.length || 0} blocker(s)`} danger={!approvalData?.ready} />
        <Card title="Allowance" value={allowanceHuman ? num(allowanceHuman, 6) : "Unchecked"} detail={approvalNeeded === null ? "Check allowance" : approvalNeeded ? "Approval needed" : "Enough allowance"} danger={approvalNeeded === true} />
      </section>

      {approvalData?.blockers.length ? (
        <section style={{ border: "1px solid #ddd", borderRadius: 14, padding: 18, marginBottom: 24, background: "#fff7ed" }}>
          <h2 style={{ marginTop: 0 }}>Blockers</h2>
          <ul>{approvalData.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>
        </section>
      ) : null}

      {approvalData?.approval ? (
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 18, marginBottom: 24 }}>
          <Panel title="Exact Approval">
            <Mini label="Token" value={`${approvalData.approval.tokenSymbol} / ${approvalData.approval.tokenAddress}`} />
            <Mini label="Spender" value={approvalData.approval.spenderAddress} />
            <Mini label="Amount" value={`${approvalData.approval.amount} ${approvalData.approval.tokenSymbol}`} />
            <Mini label="Amount Raw" value={approvalData.approval.amountRaw} />
          </Panel>
          <Panel title="Actions">
            <button onClick={checkAllowance} disabled={loading || !account || !approvalData.ready} style={buttonStyle}>Check Allowance</button>
            <button onClick={requestExactApproval} disabled={loading || !account || !approvalData.ready || approvalNeeded === false} style={dangerButtonStyle}>Request Exact Approval</button>
            <p style={{ color: "#555" }}>After approval confirms, refresh the swap builder to generate a fresh swap payload.</p>
          </Panel>
        </section>
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
