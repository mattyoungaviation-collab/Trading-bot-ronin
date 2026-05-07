"use client";

import { useEffect, useMemo, useState } from "react";

type Settings = {
  id: number;
  botMode: string;
  maxTradeSizeUsd: number;
  minExpectedProfitPct: number;
  takeProfitPct: number;
  stopLossPct: number;
  trailingStopPct: number;
  cooldownSec: number;
  maxOpenPositionsPerToken: number;
  maxDailyTrades: number;
  maxBuyImpactPct: number;
  maxSellImpactPct: number;
  maxRoundTripImpactPct: number;
  minPoolLiquidityUsd: number;
  minExitLiquidityUsd: number;
  minRecentVolumeUsd: number;
  maxSlippagePct: number;
  minQuoteConfidence: number;
  minTradeScore: number;
  maxDailyLossUsd: number;
  maxWalletExposurePct: number;
  maxTokenExposurePct: number;
  emergencyStopLossPct: number;
  whitelistOnly: boolean;
  requireManualApproval: boolean;
  allowUnlimitedApproval: boolean;
  emergencyStop: boolean;
};

const numberFields: Array<{ key: keyof Settings; label: string; help: string }> = [
  { key: "maxTradeSizeUsd", label: "Max trade size USD", help: "Caps each trade before impact checks." },
  { key: "minExpectedProfitPct", label: "Minimum expected profit %", help: "Trade must clear this before costs." },
  { key: "takeProfitPct", label: "Take profit %", help: "Paper or live exit target." },
  { key: "stopLossPct", label: "Stop loss %", help: "Paper or live loss exit." },
  { key: "trailingStopPct", label: "Trailing stop %", help: "Locks profit after price moves up." },
  { key: "cooldownSec", label: "Cooldown seconds", help: "Wait time between trades." },
  { key: "maxOpenPositionsPerToken", label: "Max positions per token", help: "Prevents over stacking one token." },
  { key: "maxDailyTrades", label: "Max daily trades", help: "Hard daily trade count cap." },
  { key: "maxBuyImpactPct", label: "Max buy impact %", help: "Rejects buys that move the pool too much." },
  { key: "maxSellImpactPct", label: "Max sell impact %", help: "Rejects trades that cannot exit cleanly." },
  { key: "maxRoundTripImpactPct", label: "Max round trip impact %", help: "Buy plus sell impact limit." },
  { key: "minPoolLiquidityUsd", label: "Minimum pool liquidity USD", help: "Rejects thin pools." },
  { key: "minExitLiquidityUsd", label: "Minimum exit liquidity USD", help: "Requires room to sell back out." },
  { key: "minRecentVolumeUsd", label: "Minimum recent volume USD", help: "Avoids dead pools." },
  { key: "maxSlippagePct", label: "Max slippage %", help: "Swap protection limit." },
  { key: "minQuoteConfidence", label: "Minimum quote confidence", help: "Rejects weak or stale quotes." },
  { key: "minTradeScore", label: "Minimum trade score", help: "Bot only accepts trades above this score." },
  { key: "maxDailyLossUsd", label: "Max daily loss USD", help: "Emergency daily loss cap." },
  { key: "maxWalletExposurePct", label: "Max wallet exposure %", help: "Caps total wallet risk." },
  { key: "maxTokenExposurePct", label: "Max token exposure %", help: "Caps risk in one token." },
  { key: "emergencyStopLossPct", label: "Emergency stop loss %", help: "Global panic loss threshold." },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [status, setStatus] = useState("Loading settings...");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        setSettings(data);
        setStatus("Settings loaded.");
      })
      .catch((error) => setStatus(`Failed to load settings: ${error.message}`));
  }, []);

  const dangerMessage = useMemo(() => {
    if (!settings) return "";
    if (settings.botMode === "LIVE" && !settings.emergencyStop) {
      return "LIVE mode is selected and Emergency Stop is OFF. Do not connect a private key until watch and paper modes are proven.";
    }
    if (!settings.emergencyStop) {
      return "Emergency Stop is OFF. The future worker will be allowed to act according to bot mode.";
    }
    return "Emergency Stop is ON. This is the safest state while building.";
  }, [settings]);

  function updateField(key: keyof Settings, value: string | boolean) {
    if (!settings) return;
    setSettings({
      ...settings,
      [key]: typeof value === "boolean" ? value : value,
    });
  }

  async function saveSettings() {
    if (!settings) return;
    setSaving(true);
    setStatus("Saving settings...");
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!response.ok) throw new Error(`Save failed with ${response.status}`);
      const saved = await response.json();
      setSettings(saved);
      setStatus("Settings saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unknown save error");
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return (
      <main style={{ padding: 32, fontFamily: "Arial, sans-serif" }}>
        <h1>Ronin Bot Settings</h1>
        <p>{status}</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 32, fontFamily: "Arial, sans-serif", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ marginBottom: 8 }}>Ronin Bot Settings</h1>
          <p style={{ marginTop: 0, color: "#555" }}>Control panel for bot mode, emergency stop, liquidity rules, and risk limits.</p>
        </div>
        <button
          onClick={saveSettings}
          disabled={saving}
          style={{ padding: "12px 18px", borderRadius: 10, border: "1px solid #111", cursor: "pointer", fontWeight: 700 }}
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      <section style={{ border: "1px solid #ddd", borderRadius: 14, padding: 18, margin: "20px 0", background: settings.emergencyStop ? "#f0fff4" : "#fff7ed" }}>
        <strong>Status:</strong> {status}
        <p style={{ marginBottom: 0 }}>{dangerMessage}</p>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 24 }}>
        <label style={{ border: "1px solid #ddd", borderRadius: 14, padding: 16 }}>
          <strong>Bot Mode</strong>
          <select
            value={settings.botMode}
            onChange={(event) => updateField("botMode", event.target.value)}
            style={{ display: "block", marginTop: 10, width: "100%", padding: 10 }}
          >
            <option value="OFF">OFF</option>
            <option value="WATCH">WATCH</option>
            <option value="PAPER">PAPER</option>
            <option value="LIVE">LIVE</option>
          </select>
        </label>

        <label style={{ border: "1px solid #ddd", borderRadius: 14, padding: 16 }}>
          <strong>Emergency Stop</strong>
          <p style={{ color: "#555" }}>Keep ON while building.</p>
          <input
            type="checkbox"
            checked={settings.emergencyStop}
            onChange={(event) => updateField("emergencyStop", event.target.checked)}
          />{" "}
          Emergency Stop ON
        </label>

        <label style={{ border: "1px solid #ddd", borderRadius: 14, padding: 16 }}>
          <strong>Manual Approval Required</strong>
          <p style={{ color: "#555" }}>Recommended for live mode.</p>
          <input
            type="checkbox"
            checked={settings.requireManualApproval}
            onChange={(event) => updateField("requireManualApproval", event.target.checked)}
          />{" "}
          Require approval
        </label>

        <label style={{ border: "1px solid #ddd", borderRadius: 14, padding: 16 }}>
          <strong>Whitelist Only</strong>
          <p style={{ color: "#555" }}>Only trade approved tokens.</p>
          <input
            type="checkbox"
            checked={settings.whitelistOnly}
            onChange={(event) => updateField("whitelistOnly", event.target.checked)}
          />{" "}
          Enforce whitelist
        </label>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        {numberFields.map((field) => (
          <label key={String(field.key)} style={{ border: "1px solid #ddd", borderRadius: 14, padding: 16 }}>
            <strong>{field.label}</strong>
            <p style={{ color: "#555", minHeight: 38 }}>{field.help}</p>
            <input
              type="number"
              step="0.01"
              value={String(settings[field.key])}
              onChange={(event) => updateField(field.key, event.target.value)}
              style={{ width: "100%", padding: 10, boxSizing: "border-box" }}
            />
          </label>
        ))}
      </section>
    </main>
  );
}
