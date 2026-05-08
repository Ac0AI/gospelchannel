// Search page — Variant B "Push"
// Sticky filter rail left + spotlight result top + tight grid below.

const SearchPush = ({ data }) => {
  const [query, setQuery] = React.useState("worship");
  const [activeFilters, setActiveFilters] = React.useState({
    tradition: ["Pentecostal"],
    style: [],
    has: ["Music", "Service times"],
    language: [],
  });

  const spotlight = data.featured[0];
  const rest = data.featured.slice(1);

  const toggle = (group, val) => {
    setActiveFilters((f) => ({
      ...f,
      [group]: f[group].includes(val) ? f[group].filter((x) => x !== val) : [...f[group], val],
    }));
  };

  const totalActive = Object.values(activeFilters).flat().length;

  return (
    <div style={{ background: "var(--linen)", minHeight: "100%", fontFamily: "var(--font-sans)", color: "var(--espresso)" }}>
      {/* Sticky search bar */}
      <header style={{ position: "sticky", top: 0, zIndex: 10, background: "white", borderBottom: "1px solid rgba(176,106,80,0.14)", padding: "16px 40px", display: "flex", alignItems: "center", gap: 24 }}>
        <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", flexShrink: 0 }}>GospelChannel</div>
        <div style={{ flex: 1, maxWidth: 720 }}>
          <div style={{
            display: "flex", alignItems: "center",
            background: "var(--linen-deep)", borderRadius: 999, padding: "4px 4px 4px 18px",
            border: "1px solid transparent",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9e8075" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.5-4.5" /></svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search churches, cities, traditions…"
              style={{ flex: 1, border: "none", outline: "none", padding: "12px 14px", fontSize: 14, background: "transparent", color: "var(--espresso)", fontFamily: "var(--font-sans)" }}
            />
            <button style={{ padding: "10px 20px", borderRadius: 999, background: "var(--espresso)", color: "white", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Search</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 13, fontWeight: 500, color: "var(--warm-brown)", whiteSpace: "nowrap", flexShrink: 0 }}>
          <span>Prayer Wall</span>
          <span>Sign in</span>
        </div>
      </header>

      {/* Result strip */}
      <div style={{ padding: "20px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(176,106,80,0.1)" }}>
        <p style={{ margin: 0, fontSize: 14, color: "var(--warm-brown)" }}>
          <strong style={{ color: "var(--espresso)" }}>{(data.featured.length * 178).toLocaleString()}</strong> churches matching "<em>{query}</em>"{totalActive > 0 ? ` · ${totalActive} filters` : ""}
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={{ padding: "7px 14px", borderRadius: 999, background: "white", color: "var(--espresso)", border: "1px solid rgba(176,106,80,0.22)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Sort: Relevance ▾</button>
          <button style={{ padding: "7px 14px", borderRadius: 999, background: "white", color: "var(--espresso)", border: "1px solid rgba(176,106,80,0.22)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>📍 Near me</button>
        </div>
      </div>

      {/* 2-col layout */}
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 0, maxWidth: 1500, margin: "0 auto" }}>

        {/* Left: filter rail */}
        <aside style={{ padding: "32px 28px 32px 40px", borderRight: "1px solid rgba(176,106,80,0.1)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 24 }}>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600, color: "var(--espresso)", margin: 0, letterSpacing: "-0.01em" }}>Filters</h2>
            {totalActive > 0 && <button onClick={() => setActiveFilters({ tradition: [], style: [], has: [], language: [] })} style={{ background: "transparent", border: "none", fontSize: 12, color: "var(--rose-gold)", fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>Clear all</button>}
          </div>

          {[
            { key: "tradition", label: "Tradition", items: data.traditions.map((t) => ({ name: t.name, count: t.count })) },
            { key: "style", label: "Worship style", items: data.styles.map((s) => ({ name: s, count: Math.floor(Math.random() * 800 + 50) })) },
            { key: "has", label: "Page includes", items: [{ name: "Music", count: 2104 }, { name: "Service times", count: 3201 }, { name: "Kids program", count: 1245 }, { name: "Bilingual", count: 587 }] },
            { key: "language", label: "Language", items: [{ name: "English", count: 3120 }, { name: "Spanish", count: 412 }, { name: "Swedish", count: 89 }, { name: "German", count: 167 }] },
          ].map((group) => (
            <div key={group.key} style={{ marginBottom: 28 }}>
              <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--muted-warm)", margin: "0 0 12px" }}>{group.label}</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {group.items.slice(0, 6).map((item) => {
                  const active = activeFilters[group.key].includes(item.name);
                  return (
                    <label key={item.name} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: active ? "var(--espresso)" : "var(--warm-brown)", cursor: "pointer", padding: "5px 0", fontWeight: active ? 600 : 400 }}>
                      <span style={{
                        width: 16, height: 16, borderRadius: 5,
                        border: `1.5px solid ${active ? "var(--rose-gold)" : "rgba(176,106,80,0.3)"}`,
                        background: active ? "var(--rose-gold)" : "white",
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}>
                        {active && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5"><path d="M5 12l5 5L20 7" /></svg>}
                      </span>
                      <span style={{ flex: 1 }} onClick={() => toggle(group.key, item.name)}>{item.name}</span>
                      <span style={{ fontSize: 11, color: "var(--muted-warm)" }}>{item.count.toLocaleString()}</span>
                    </label>
                  );
                })}
                {group.items.length > 6 && <button style={{ background: "transparent", border: "none", color: "var(--rose-gold)", fontSize: 12, fontWeight: 600, cursor: "pointer", textAlign: "left", marginTop: 4, padding: 0 }}>+ Show all {group.items.length}</button>}
              </div>
            </div>
          ))}
        </aside>

        {/* Right: results */}
        <main style={{ padding: "32px 40px 32px 36px" }}>

          {/* Spotlight result */}
          <div style={{ marginBottom: 36 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", color: "var(--mauve)", textTransform: "uppercase", margin: "0 0 12px" }}>★ Top match</p>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 0, borderRadius: 22, overflow: "hidden", border: "1px solid rgba(176,106,80,0.14)", background: "white" }}>
              <div style={{ aspectRatio: "16/10", backgroundImage: `url(${spotlight.thumbnail})`, backgroundSize: "cover", backgroundPosition: "center" }} />
              <div style={{ padding: "32px 32px", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", color: "var(--muted-warm)", textTransform: "uppercase" }}>{spotlight.city} · {spotlight.country}</span>
                  {spotlight.verified && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 999, background: "rgba(176,106,80,0.1)", fontSize: 10, fontWeight: 700, color: "var(--rose-gold-deep)" }}>✓ Verified</span>}
                </div>
                <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 36, fontWeight: 600, color: "var(--espresso)", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.05 }}>{spotlight.name}</h3>
                <p style={{ fontSize: 14, color: "var(--warm-brown)", margin: "4px 0 16px" }}>{spotlight.style} · {spotlight.denomination}</p>
                <p style={{ fontSize: 14, color: "var(--warm-brown)", lineHeight: 1.55, margin: "0 0 18px", flex: 1 }}>{spotlight.blurb}</p>

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
                  {spotlight.hasMusic && <span style={spPill}>♪ Music</span>}
                  {spotlight.hasKids && <span style={spPill}>Kids</span>}
                  {spotlight.hasService && <span style={spPill}>3 Sunday services</span>}
                  <span style={spPill}>{(spotlight.followers / 1000000).toFixed(1)}M followers</span>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button style={{ padding: "11px 22px", borderRadius: 999, background: "var(--rose-gold)", color: "white", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Visit page →</button>
                  <button style={{ padding: "11px 18px", borderRadius: 999, background: "transparent", color: "var(--espresso)", border: "1px solid rgba(176,106,80,0.25)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>♡ Save</button>
                </div>
              </div>
            </div>
          </div>

          {/* Tight grid */}
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", color: "var(--mauve)", textTransform: "uppercase", margin: "0 0 16px" }}>Other matches</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
            {rest.map((c) => (
              <window.LandingChurchCard key={c.slug} church={c} />
            ))}
          </div>

          {/* Load more */}
          <div style={{ textAlign: "center", marginTop: 48 }}>
            <button style={{ padding: "14px 32px", borderRadius: 999, background: "white", color: "var(--espresso)", border: "1px solid rgba(176,106,80,0.25)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Load 20 more</button>
            <p style={{ fontSize: 12, color: "var(--muted-warm)", marginTop: 12 }}>Showing 8 of 762,544 results</p>
          </div>
        </main>
      </div>
    </div>
  );
};

const spPill = {
  display: "inline-flex", padding: "4px 10px", borderRadius: 999,
  background: "var(--linen-deep)", fontSize: 11, fontWeight: 600,
  color: "var(--warm-brown)", letterSpacing: "0.02em",
};

window.SearchPush = SearchPush;
