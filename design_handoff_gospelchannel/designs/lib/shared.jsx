// GospelChannel — shared header, footer, church-card components.
// Loaded as text/babel; exposes window.GCHeader, GCFooter, GCChurchCard, GCTraditionPalettes.

const GCHeader = ({ active, dark = false }) => {
  const links = [
    { href: "search.html", label: "Browse" },
    { href: "prayer-wall.html", label: "Prayer Wall" },
    { href: "for-churches.html", label: "For churches" },
    { href: "about.html", label: "About" },
  ];
  return (
    <header className="gc-header" style={dark ? { background: "rgba(20,12,8,0.6)", borderBottomColor: "rgba(255,255,255,0.1)" } : {}}>
      <div className="gc-header-inner">
        <a className="gc-logo" href="index.html" style={dark ? { color: "white" } : {}}>GospelChannel</a>
        <nav className="gc-nav">
          {links.map(l => (
            <a key={l.href} href={l.href} style={{
              color: dark ? "rgba(255,255,255,0.85)" : (active === l.label ? "var(--rose-gold)" : undefined),
              fontWeight: active === l.label ? 700 : 500,
            }}>{l.label}</a>
          ))}
        </nav>
        <div className="gc-header-cta">
          <button className="gc-btn gc-btn-ghost gc-btn-sm" style={dark ? { color: "white", borderColor: "rgba(255,255,255,0.25)" } : {}}>Sign in</button>
          <button className="gc-btn gc-btn-primary gc-btn-sm">Add a church</button>
        </div>
      </div>
    </header>
  );
};

const GCFooter = () => {
  const cols = [
    { title: "Discover", links: ["Browse all churches", "Featured this week", "Prayer Wall", "Worship music", "Sermons"] },
    { title: "By tradition", links: ["Pentecostal", "Anglican", "Baptist", "Lutheran", "Catholic"] },
    { title: "For churches", links: ["Add your church", "Claim a page", "Why list with us", "Pastor stories", "Contact"] },
    { title: "Company", links: ["About", "Manifesto", "Press", "Privacy", "Terms"] },
  ];
  return (
    <footer className="gc-footer">
      <div className="gc-footer-inner">
        <div className="gc-footer-grid">
          <div>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 600, color: "var(--linen)", letterSpacing: "-0.01em" }}>GospelChannel</div>
            <p style={{ marginTop: 14, fontSize: 14, lineHeight: 1.6, maxWidth: 320 }}>
              A directory for the world's churches. Free, no ads, no tracking. Built for the people who haven't found a church yet — and the ones already serving one.
            </p>
            <p style={{ marginTop: 18, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(253,248,244,0.45)" }}>
              4,287 churches · 67 countries
            </p>
          </div>
          {cols.map(c => (
            <div key={c.title}>
              <h4>{c.title}</h4>
              <ul>{c.links.map(l => <li key={l}><a href="#">{l}</a></li>)}</ul>
            </div>
          ))}
        </div>
        <div className="gc-footer-bottom">
          <span>© 2025 GospelChannel — made with love.</span>
          <span style={{ display: "flex", gap: 18 }}>
            <a href="#">English</a>
            <a href="#">Svenska</a>
            <a href="#">Español</a>
          </span>
        </div>
      </div>
    </footer>
  );
};

// Tradition palettes for fallback (no-photo) church cards.
const GCTraditionPalettes = {
  pentecostal: { bg: "#1a1814", accent: "#b06a50", deep: "#3b2a22" },
  charismatic: { bg: "#1f1a14", accent: "#c08a4f", deep: "#3a2e22" },
  baptist: { bg: "#162018", accent: "#7a9d83", deep: "#243528" },
  presbyterian: { bg: "#0f1419", accent: "#3a6fb0", deep: "#1a2332" },
  anglican: { bg: "#1d1a24", accent: "#9b7fa0", deep: "#2d2540" },
  lutheran: { bg: "#1f1c18", accent: "#c89b58", deep: "#3a3022" },
  catholic: { bg: "#1a1620", accent: "#7a5fa8", deep: "#2d2540" },
  orthodox: { bg: "#1a1410", accent: "#c8731f", deep: "#3a2418" },
  methodist: { bg: "#181d1a", accent: "#5d8a6f", deep: "#243228" },
  nondenominational: { bg: "#1a1814", accent: "#b06a50", deep: "#3b2a22" },
};

const paletteFor = (denom = "") => {
  const k = (denom || "").toLowerCase().replace(/[^a-z]/g, "");
  return GCTraditionPalettes[k] || GCTraditionPalettes.nondenominational;
};

const GCChurchCard = ({ church, size = "md" }) => {
  const palette = church.palette || paletteFor(church.denomination);
  const initial = church.initial || (church.name || "?")[0];
  const ar = size === "sm" ? "16/10" : "4/3";
  return (
    <a href={`church.html`} style={{
      background: "white", borderRadius: 18, overflow: "hidden",
      border: "var(--border-soft)", boxShadow: "var(--shadow-sm)",
      cursor: "pointer", display: "flex", flexDirection: "column",
      textDecoration: "none", color: "inherit",
      transition: "transform .2s, box-shadow .2s",
    }}
       onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "var(--shadow)"; }}
       onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "var(--shadow-sm)"; }}
    >
      {church.thumbnail ? (
        <div style={{ aspectRatio: ar, position: "relative", backgroundImage: `url(${church.thumbnail})`, backgroundSize: "cover", backgroundPosition: "center" }}>
          {church.verified && (
            <div style={{ position: "absolute", top: 12, right: 12, padding: "5px 10px", borderRadius: 999, background: "rgba(255,255,255,0.95)", fontSize: 11, fontWeight: 700, color: "var(--rose-gold-deep)" }}>✓ Verified</div>
          )}
        </div>
      ) : (
        <div style={{ aspectRatio: ar, background: palette.bg, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 30% 40%, ${palette.accent}33, transparent 60%)` }} />
          <div style={{ fontFamily: "var(--font-serif)", fontSize: size === "sm" ? 90 : 130, color: palette.accent, opacity: 0.85, fontWeight: 600, letterSpacing: "-0.04em" }}>{initial}</div>
        </div>
      )}
      <div style={{ padding: "18px 20px", flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", color: "var(--muted-warm)", textTransform: "uppercase" }}>
          {church.city}{church.country ? ` · ${church.country}` : ""}
        </div>
        <h3 style={{ fontFamily: "var(--font-serif)", fontSize: size === "sm" ? 19 : 22, fontWeight: 600, color: "var(--espresso)", margin: "6px 0 4px", letterSpacing: "-0.01em", lineHeight: 1.2 }}>{church.name}</h3>
        {church.style && <div style={{ fontSize: 13, color: "var(--warm-brown)" }}>{church.style}</div>}
        {church.blurb && size !== "sm" && <p style={{ fontSize: 13, color: "var(--warm-brown)", lineHeight: 1.5, margin: "12px 0 14px", flex: 1 }}>{church.blurb}</p>}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: size === "sm" ? 10 : 0 }}>
          {church.hasMusic && <span className="gc-pill">♪ Music</span>}
          {church.hasKids && <span className="gc-pill">Kids</span>}
          {church.hasService && <span className="gc-pill">Times</span>}
        </div>
      </div>
    </a>
  );
};

window.GCHeader = GCHeader;
window.GCFooter = GCFooter;
window.GCChurchCard = GCChurchCard;
window.GCTraditionPalettes = GCTraditionPalettes;
window.GCPaletteFor = paletteFor;
