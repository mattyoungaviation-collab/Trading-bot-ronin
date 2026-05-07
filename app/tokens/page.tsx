"use client";

import { useEffect, useState } from "react";

type Token = {
  id: number;
  name: string;
  symbol: string;
  contractAddress: string;
  decimals: number;
  logoUrl: string | null;
  pairAddress: string | null;
  poolType: string;
  baseToken: string;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
};

type TokenForm = {
  name: string;
  symbol: string;
  contractAddress: string;
  decimals: string;
  logoUrl: string;
  pairAddress: string;
  poolType: string;
  baseToken: string;
  isActive: boolean;
  notes: string;
};

const emptyForm: TokenForm = {
  name: "",
  symbol: "",
  contractAddress: "",
  decimals: "18",
  logoUrl: "",
  pairAddress: "",
  poolType: "KATANA_V2",
  baseToken: "RON",
  isActive: true,
  notes: "",
};

export default function TokensPage() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [form, setForm] = useState<TokenForm>(emptyForm);
  const [status, setStatus] = useState("Loading tokens...");
  const [saving, setSaving] = useState(false);

  async function loadTokens() {
    try {
      const response = await fetch("/api/tokens");
      const data = await response.json();
      setTokens(data);
      setStatus(data.length ? "Tokens loaded." : "No tokens added yet.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load tokens.");
    }
  }

  useEffect(() => {
    loadTokens();
  }, []);

  function updateForm(key: keyof TokenForm, value: string | boolean) {
    setForm({ ...form, [key]: value });
  }

  async function saveToken() {
    setSaving(true);
    setStatus("Saving token...");
    try {
      const response = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, decimals: Number(form.decimals) }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Token save failed.");

      setForm(emptyForm);
      setStatus(`Saved ${data.symbol}.`);
      await loadTokens();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Token save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(token: Token) {
    setStatus(`Updating ${token.symbol}...`);
    try {
      const response = await fetch(`/api/tokens/${token.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...token, isActive: !token.isActive }),
      });
      if (!response.ok) throw new Error("Toggle failed.");
      await loadTokens();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Toggle failed.");
    }
  }

  async function deleteToken(token: Token) {
    const confirmed = window.confirm(`Delete ${token.symbol}? This removes it from the approved list.`);
    if (!confirmed) return;

    setStatus(`Deleting ${token.symbol}...`);
    try {
      const response = await fetch(`/api/tokens/${token.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Delete failed.");
      await loadTokens();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Delete failed.");
    }
  }

  return (
    <main style={{ padding: 32, fontFamily: "Arial, sans-serif", maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ marginBottom: 8 }}>Token Selector</h1>
          <p style={{ marginTop: 0, color: "#555" }}>Add tokens the bot is allowed to watch. Keep inactive until you have verified the pool and contract.</p>
        </div>
        <a href="/settings" style={{ color: "#111", fontWeight: 700 }}>Settings</a>
      </div>

      <section style={{ border: "1px solid #ddd", borderRadius: 14, padding: 18, margin: "20px 0", background: "#f8fafc" }}>
        <strong>Status:</strong> {status}
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 14, padding: 18, marginBottom: 24 }}>
        <h2>Add or Update Token</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          <label>
            <strong>Name</strong>
            <input value={form.name} onChange={(e) => updateForm("name", e.target.value)} style={inputStyle} placeholder="Dyno Coin" />
          </label>
          <label>
            <strong>Symbol</strong>
            <input value={form.symbol} onChange={(e) => updateForm("symbol", e.target.value)} style={inputStyle} placeholder="DYN" />
          </label>
          <label>
            <strong>Contract Address</strong>
            <input value={form.contractAddress} onChange={(e) => updateForm("contractAddress", e.target.value)} style={inputStyle} placeholder="0x..." />
          </label>
          <label>
            <strong>Decimals</strong>
            <input type="number" value={form.decimals} onChange={(e) => updateForm("decimals", e.target.value)} style={inputStyle} />
          </label>
          <label>
            <strong>Pair or Pool Address</strong>
            <input value={form.pairAddress} onChange={(e) => updateForm("pairAddress", e.target.value)} style={inputStyle} placeholder="0x... optional" />
          </label>
          <label>
            <strong>Pool Type</strong>
            <select value={form.poolType} onChange={(e) => updateForm("poolType", e.target.value)} style={inputStyle}>
              <option value="KATANA_V2">KATANA_V2</option>
              <option value="KATANA_V3">KATANA_V3</option>
            </select>
          </label>
          <label>
            <strong>Base Token</strong>
            <input value={form.baseToken} onChange={(e) => updateForm("baseToken", e.target.value)} style={inputStyle} placeholder="RON" />
          </label>
          <label>
            <strong>Logo URL</strong>
            <input value={form.logoUrl} onChange={(e) => updateForm("logoUrl", e.target.value)} style={inputStyle} placeholder="optional" />
          </label>
        </div>

        <label style={{ display: "block", marginTop: 16 }}>
          <strong>Notes</strong>
          <textarea value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} style={{ ...inputStyle, minHeight: 80 }} placeholder="Why this token is allowed, pool notes, liquidity notes." />
        </label>

        <label style={{ display: "block", marginTop: 16 }}>
          <input type="checkbox" checked={form.isActive} onChange={(e) => updateForm("isActive", e.target.checked)} /> Active watch token
        </label>

        <button onClick={saveToken} disabled={saving} style={buttonStyle}>
          {saving ? "Saving..." : "Save Token"}
        </button>
      </section>

      <section>
        <h2>Approved Token List</h2>
        <div style={{ display: "grid", gap: 14 }}>
          {tokens.map((token) => (
            <article key={token.id} style={{ border: "1px solid #ddd", borderRadius: 14, padding: 16, background: token.isActive ? "#f0fff4" : "#fff7ed" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <h3 style={{ margin: 0 }}>{token.symbol} · {token.name}</h3>
                  <p style={{ margin: "8px 0", color: "#555" }}>{token.poolType} / Base: {token.baseToken} / Decimals: {token.decimals}</p>
                  <p style={{ margin: "8px 0", overflowWrap: "anywhere" }}><strong>Contract:</strong> {token.contractAddress}</p>
                  <p style={{ margin: "8px 0", overflowWrap: "anywhere" }}><strong>Pool:</strong> {token.pairAddress || "Not set"}</p>
                  {token.notes ? <p style={{ margin: "8px 0" }}><strong>Notes:</strong> {token.notes}</p> : null}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "start" }}>
                  <button onClick={() => toggleActive(token)} style={smallButtonStyle}>{token.isActive ? "Deactivate" : "Activate"}</button>
                  <button onClick={() => deleteToken(token)} style={dangerButtonStyle}>Delete</button>
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
  padding: "12px 18px",
  borderRadius: 10,
  border: "1px solid #111",
  cursor: "pointer",
  fontWeight: 700,
};

const smallButtonStyle: React.CSSProperties = {
  padding: "9px 12px",
  borderRadius: 10,
  border: "1px solid #111",
  cursor: "pointer",
};

const dangerButtonStyle: React.CSSProperties = {
  padding: "9px 12px",
  borderRadius: 10,
  border: "1px solid #991b1b",
  cursor: "pointer",
  color: "#991b1b",
};
