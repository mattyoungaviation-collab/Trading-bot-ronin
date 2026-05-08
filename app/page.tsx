const sections = [
  {
    title: "Control Center",
    description: "Main status, logs, and bot overview.",
    links: [
      { href: "/dashboard", label: "Dashboard", note: "Full system overview" },
      { href: "/settings", label: "Settings", note: "Mode and risk controls" },
      { href: "/watch", label: "Watch", note: "Read only status" },
    ],
  },
  {
    title: "Token And Quote Pipeline",
    description: "Add tokens, quote live pools, and score decisions.",
    links: [
      { href: "/tokens", label: "Tokens", note: "Manage token watchlist" },
      { href: "/quotes", label: "Quotes", note: "Live V2/V3 quote scans" },
      { href: "/decisions", label: "Decisions", note: "Trade scoring and rejection reasons" },
    ],
  },
  {
    title: "Paper Trading",
    description: "Safe simulated trading loop before live execution.",
    links: [
      { href: "/paper", label: "Paper Manager", note: "Open/close/reset fake trades" },
      { href: "/cycle", label: "Cycle Runner", note: "One click quote → decide → paper" },
    ],
  },
  {
    title: "Live Safety Gate",
    description: "Live readiness and preview only. No blind execution.",
    links: [
      { href: "/live", label: "Live Readiness", note: "Wallet, router, and blocker checks" },
      { href: "/live-preview", label: "Live Preview", note: "Exact proposed swap preview" },
      { href: "/live-execute", label: "Live Execute", note: "Guarded manual execution gate" },
    ],
  },
];

export default function HomePage() {
  return (
    <main style={{ padding: 32, fontFamily: "Arial, sans-serif", maxWidth: 1180, margin: "0 auto" }}>
      <section style={{ marginBottom: 28 }}>
        <h1 style={{ marginBottom: 8 }}>Ronin Katana Trading Bot</h1>
        <p style={{ marginTop: 0, color: "#555", maxWidth: 780 }}>
          One home base for the bot build: token watchlist, live quotes, decision scoring, paper trading, live readiness, and guarded execution.
        </p>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>
        {sections.map((section) => (
          <article key={section.title} style={{ border: "1px solid #ddd", borderRadius: 16, padding: 18, background: "#fff" }}>
            <h2 style={{ marginTop: 0 }}>{section.title}</h2>
            <p style={{ color: "#555" }}>{section.description}</p>
            <div style={{ display: "grid", gap: 10 }}>
              {section.links.map((link) => (
                <a key={link.href} href={link.href} style={linkStyle}>
                  <strong>{link.label}</strong>
                  <span style={{ color: "#555", fontSize: 14 }}>{link.note}</span>
                </a>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 16, padding: 18, marginTop: 24, background: "#fff7ed" }}>
        <h2 style={{ marginTop: 0 }}>Live Trading Warning</h2>
        <p style={{ marginBottom: 0 }}>
          Use a tiny dedicated test wallet only. Keep Emergency Stop ON unless intentionally testing paper or live readiness. Live execution should stay disabled until every preview field is verified.
        </p>
      </section>
    </main>
  );
}

const linkStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  padding: 12,
  border: "1px solid #eee",
  borderRadius: 12,
  color: "#111",
  textDecoration: "none",
  background: "#f8fafc",
};
