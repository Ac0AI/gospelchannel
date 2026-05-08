// Search page — Variant A "Säker"
// Search-first, filter chips appear, magazine cards in a 3-col grid.

const SearchSafe = ({ data }) => {
  const [query, setQuery] = React.useState("worship");
  const [activeChips, setActiveChips] = React.useState(["English", "Worship music"]);

  const filtered = data.featured;

  return (
    <div style={{ background: "var(--linen)", minHeight: "100%", fontFamily: "var(--font-sans)", color: "var(--espresso)" }}>
      {/* Header */}
      <header style={{ padding: "20px 48px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(176,106,80,0.1)", background: "white" }}>
        <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em" }}>GospelChannel</div>
        <nav style={{ display: "flex", gap: 32, fontSize: 14, fontWeight: 500, color: "var(--warm-brown)", whiteSpace: "nowrap" }}>
          <span style={{ color: "var(--espresso)", fontWeight: 600 }}>Browse</span>
          <span>Prayer Wall</span>
          <span>For churches</span>
          <span>About</span>
        </nav>
        <button style={{ padding: "9px 18px", borderRadius: 999, background: "transparent", color: "var(--espresso)", border: "1px solid rgba(176,106,80,0.25)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Sign in</button>
      </header>

      {/* Search header — search-first hero */}
      <section style={{
        background: "linear-gradient(135deg, var(--linen-deep) 0%, var(--linen) 60%)",
        padding: "56px 48px 40px",
        borderBottom: "1px solid rgba(176,106,80,0.12)",
      }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", color: "var(--mauve)", textTransform: "uppercase", margin: 0 }}>Church Directory</p>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 56, fontWeight: 600, color: "var(--espresso)", margin: "12px 0 28px", letterSpacing: "-0.02em", lineHeight: 1 }}>
            Find your <em style={{ fontStyle: "italic", color: "var(--rose-gold)" }}>church</em>.
          </h1>

          {/* Big search */}
          <div style={{ maxWidth: 760 }}>
            <div style={{
              display: "flex", alignItems: "center",
              background: "white", borderRadius: 999, padding: "8px 8px 8px 24px",
              boxShadow: "0 12px 40px rgba(59,42,34,0.08)", border: "1px solid rgba(176,106,80,0.18)",
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b06a50" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.5-4.5" /></svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${data.stats.label} churches by name, city, or country`}
                style={{ flex: 1, border: "none", outline: "none", padding: "16px 16px", fontSize: 16, background: "transparent", color: "var(--espresso)", fontFamily: "var(--font-sans)" }}
              />
              <button style={{ padding: "13px 28px", borderRadius: 999, background: "var(--rose-gold)", color: "white", border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Search</button>
            </div>

            {/* Filter chips appear under search */}
            <div style={{ marginTop: 18, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "var(--muted-warm)", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", marginRight: 4 }}>Refine:</span>
              {[
                { group: "Tradition", items: ["Pentecostal", "Anglican", "Baptist", "Lutheran", "Catholic"] },
                { group: "Style", items: ["Contemporary", "Hymns", "Gospel", "Liturgical"] },
                { group: "Has", items: ["♪ Music", "Kids program", "Service times", "Bilingual"] },
              ].map((g, gi) => (
                <React.Fragment key={g.group}>
                  {gi > 0 && <span style={{ color: "rgba(176,106,80,0.3)", margin: "0 4px" }}>·</span>}
                  {g.items.map((c) => {
                    const active = activeChips.includes(c.replace("♪ ", ""));
                    return (
                      <button key={c} onClick={() => {
                        const k = c.replace("♪ ", "");
                        setActiveChips(active ? activeChips.filter((x) => x !== k) : [...activeChips, k]);
                      }} style={{
                        padding: "7px 13px", borderRadius: 999,
                        background: active ? "var(--rose-gold)" : "white",
                        color: active ? "white" : "var(--warm-brown)",
                        border: `1px solid ${active ? "var(--rose-gold)" : "rgba(176,106,80,0.22)"}`,
                        fontSize: 12, fontWeight: 600, cursor: "pointer",
                      }}>{c}</button>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>

            {activeChips.length > 0 && (
              <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "var(--warm-brown)" }}>{activeChips.length} active filters</span>
                <button onClick={() => setActiveChips([])} style={{ padding: "4px 10px", borderRadius: 999, background: "transparent", border: "none", color: "var(--rose-gold)", fontSize: 12, fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>Clear all</button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Results */}
      <section style={{ maxWidth: 1280, margin: "0 auto", padding: "48px 48px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28 }}>
          <div>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 32, fontWeight: 600, color: "var(--espresso)", margin: 0, letterSpacing: "-0.01em" }}>
              {filtered.length.toLocaleString()} churches found
            </h2>
            <p style={{ fontSize: 14, color: "var(--muted-warm)", margin: "4px 0 0" }}>
              Matching "{query}" · sorted by relevance
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--muted-warm)", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>Sort:</span>
            <button style={{ padding: "8px 14px", borderRadius: 999, background: "white", color: "var(--espresso)", border: "1px solid rgba(176,106,80,0.22)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Relevance ▾</button>
            <button style={{ padding: "8px 14px", borderRadius: 999, background: "white", color: "var(--warm-brown)", border: "1px solid rgba(176,106,80,0.22)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Grid ⊞</button>
          </div>
        </div>

        {/* Magazine card grid 3-col */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 22 }}>
          {filtered.map((c) => (
            <window.LandingChurchCard key={c.slug} church={c} />
          ))}
        </div>

        {/* Pagination */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 56, padding: "24px 0", borderTop: "1px solid rgba(176,106,80,0.15)" }}>
          <button style={{ padding: "10px 20px", borderRadius: 999, background: "white", color: "var(--muted-warm)", border: "1px solid rgba(176,106,80,0.2)", fontSize: 13, fontWeight: 600, cursor: "not-allowed" }}>← Previous</button>
          <span style={{ fontSize: 14, color: "var(--warm-brown)", padding: "0 12px" }}>Page <strong style={{ color: "var(--espresso)" }}>1</strong> of 286</span>
          <button style={{ padding: "10px 20px", borderRadius: 999, background: "var(--rose-gold)", color: "white", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Next →</button>
        </div>
      </section>

      <div style={{ height: 80 }} />
    </div>
  );
};

window.SearchSafe = SearchSafe;
