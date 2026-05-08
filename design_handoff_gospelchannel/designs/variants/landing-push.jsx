// Landing page — Variant B "Push" (editorial split — manifesto + church-in-focus)
// Bigger swing: large-type editorial hero, sök ändå primär men inbäddad i layout.

const LandingPush = ({ data }) => {
  const [focusIdx, setFocusIdx] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setFocusIdx((i) => (i + 1) % data.heroRotator.length), 6000);
    return () => clearInterval(id);
  }, [data.heroRotator.length]);

  const focus = data.heroRotator[focusIdx];
  const focusChurch = data.featured[focusIdx % data.featured.length];

  return (
    <div style={{ background: "var(--linen)", minHeight: "100%", fontFamily: "var(--font-sans)", color: "var(--espresso)" }}>
      {/* Header — solid */}
      <header style={{ padding: "24px 56px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(176,106,80,0.1)" }}>
        <div style={{ fontFamily: "var(--font-serif)", fontSize: 24, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--espresso)" }}>GospelChannel</div>
        <nav style={{ display: "flex", gap: 36, fontSize: 14, fontWeight: 500, color: "var(--warm-brown)", whiteSpace: "nowrap" }}>
          <span>Browse</span>
          <span>Prayer Wall</span>
          <span>For churches</span>
          <span>About</span>
        </nav>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={{ padding: "9px 18px", borderRadius: 999, background: "transparent", color: "var(--espresso)", border: "1px solid rgba(176,106,80,0.25)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Sign in</button>
        </div>
      </header>

      {/* Editorial split hero */}
      <section style={{ padding: "72px 56px 48px", display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 64, alignItems: "center", maxWidth: 1440, margin: "0 auto" }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.28em", color: "var(--mauve)", textTransform: "uppercase", margin: 0 }}>
            Vol. 04 · Spring 2026
          </p>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 92, fontWeight: 500, color: "var(--espresso)", margin: "20px 0 0", letterSpacing: "-0.035em", lineHeight: 1 }}>
            People find God<br />
            <em style={{ fontStyle: "italic", color: "var(--rose-gold)" }}>differently.</em>
          </h1>
          <p style={{ fontFamily: "var(--font-serif)", fontSize: 26, fontStyle: "italic", color: "var(--warm-brown)", lineHeight: 1.4, margin: "28px 0 0", fontWeight: 400, maxWidth: 520 }}>
            A free directory of {data.stats.label} churches across {data.stats.countryCount} countries. Compare worship, tradition, and welcome — before Sunday.
          </p>

          {/* Search inline */}
          <div style={{ marginTop: 44, maxWidth: 580 }}>
            <div style={{
              display: "flex", alignItems: "center",
              background: "white", borderRadius: 999, padding: "6px 6px 6px 22px",
              boxShadow: "0 8px 32px rgba(59,42,34,0.08)", border: "1px solid rgba(176,106,80,0.15)",
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9e8075" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.5-4.5" /></svg>
              <input
                placeholder="Try 'Brooklyn', 'Anglican', or 'gospel choir'…"
                style={{ flex: 1, border: "none", outline: "none", padding: "16px 16px", fontSize: 15, background: "transparent", color: "var(--espresso)", fontFamily: "var(--font-sans)" }}
              />
              <button style={{ padding: "12px 24px", borderRadius: 999, background: "var(--espresso)", color: "white", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", letterSpacing: "0.02em" }}>Search</button>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "var(--muted-warm)", fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", marginRight: 6 }}>Or</span>
              {["Near me", "This Sunday", "Bilingual", "With kids program"].map((c) => (
                <button key={c} style={{
                  padding: "6px 12px", borderRadius: 999,
                  background: "var(--linen-deep)", color: "var(--warm-brown)",
                  border: "1px solid rgba(176,106,80,0.18)",
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>{c}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Church in focus card */}
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", top: -16, left: -16, fontFamily: "var(--font-serif)", fontSize: 14, fontWeight: 600, color: "var(--rose-gold)", letterSpacing: "0.18em", textTransform: "uppercase" }}>
            ✦ Church in focus
          </div>
          <div style={{ position: "relative", borderRadius: 20, overflow: "hidden", aspectRatio: "4/5", boxShadow: "0 30px 80px rgba(59,42,34,0.18)" }}>
            {data.heroRotator.map((h, i) => (
              <div key={i} style={{
                position: "absolute", inset: 0,
                backgroundImage: `url(${h.image})`, backgroundSize: "cover", backgroundPosition: "center",
                opacity: i === focusIdx ? 1 : 0,
                transition: "opacity 1.2s ease",
              }} />
            ))}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 30%, rgba(20,12,8,0.85) 100%)" }} />
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 32, color: "white" }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>
                {focusChurch.city} · {focusChurch.country}
              </div>
              <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 42, fontWeight: 600, margin: 0, letterSpacing: "-0.02em", lineHeight: 1 }}>{focusChurch.name}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.5, margin: "12px 0 16px", color: "rgba(255,255,255,0.85)" }}>{focusChurch.blurb}</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span style={{ ...lpPill, background: "rgba(255,255,255,0.18)", color: "white", border: "1px solid rgba(255,255,255,0.3)" }}>{focusChurch.style}</span>
                <span style={{ ...lpPill, background: "rgba(255,255,255,0.18)", color: "white", border: "1px solid rgba(255,255,255,0.3)" }}>{focusChurch.denomination}</span>
              </div>
              <button style={{ marginTop: 22, padding: "12px 24px", borderRadius: 999, background: "white", color: "var(--espresso)", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Visit page →</button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "center" }}>
            {data.heroRotator.map((_, i) => (
              <div key={i} style={{ width: i === focusIdx ? 28 : 8, height: 4, borderRadius: 999, background: i === focusIdx ? "var(--rose-gold)" : "rgba(176,106,80,0.25)", transition: "all 0.4s" }} />
            ))}
          </div>
        </div>
      </section>

      {/* Stats ribbon */}
      <div style={{ padding: "0 56px", maxWidth: 1440, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderTop: "1px solid rgba(176,106,80,0.18)", borderBottom: "1px solid rgba(176,106,80,0.18)" }}>
          {[
            { n: data.stats.label, l: "Churches" },
            { n: data.stats.countryCount, l: "Countries" },
            { n: "Free", l: "Always" },
            { n: "0", l: "Ads · Tracking" },
          ].map((s, i) => (
            <div key={i} style={{ padding: "28px 24px", borderRight: i < 3 ? "1px solid rgba(176,106,80,0.18)" : "none" }}>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 44, fontWeight: 600, color: "var(--espresso)", letterSpacing: "-0.02em", lineHeight: 1 }}>{s.n}</div>
              <div style={{ fontSize: 12, color: "var(--muted-warm)", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 600, marginTop: 8 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Featured — magazine grid with feature row */}
      <section style={{ maxWidth: 1440, margin: "0 auto", padding: "88px 56px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 36 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", color: "var(--mauve)", textTransform: "uppercase", margin: 0 }}>§ 01 · Featured</p>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 54, fontWeight: 500, color: "var(--espresso)", margin: "8px 0 0", letterSpacing: "-0.02em" }}>This week's eight.</h2>
          </div>
          <button style={{ padding: "12px 22px", borderRadius: 999, background: "var(--espresso)", color: "white", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Browse all →</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }}>
          {data.featured.slice(0, 8).map((c) => (
            <window.LandingChurchCard key={c.slug} church={c} />
          ))}
        </div>
      </section>

      {/* Tradition strip — horizontal */}
      <section style={{ maxWidth: 1440, margin: "0 auto", padding: "88px 56px 0" }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", color: "var(--mauve)", textTransform: "uppercase", margin: 0 }}>§ 02 · By tradition</p>
        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 54, fontWeight: 500, color: "var(--espresso)", margin: "8px 0 32px", letterSpacing: "-0.02em" }}>However you worship.</h2>

        <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 8 }}>
          {data.traditions.map((t) => (
            <div key={t.name} style={{
              flex: "0 0 220px", padding: "28px 24px",
              background: t.swatch, borderRadius: 18, color: "white",
              cursor: "pointer", position: "relative", overflow: "hidden",
            }}>
              <div style={{ position: "absolute", top: -20, right: -20, fontFamily: "var(--font-serif)", fontSize: 140, fontWeight: 600, opacity: 0.18, letterSpacing: "-0.04em" }}>{t.name[0]}</div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 600, letterSpacing: "-0.01em", position: "relative" }}>{t.name}</div>
              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6, position: "relative" }}>{t.count.toLocaleString()} churches</div>
            </div>
          ))}
        </div>
      </section>

      {/* Prayer + cities */}
      <section style={{ maxWidth: 1440, margin: "0 auto", padding: "88px 56px 0", display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 56 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", color: "var(--mauve)", textTransform: "uppercase", margin: 0 }}>§ 03 · Live</p>
          <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 54, fontWeight: 500, color: "var(--espresso)", margin: "8px 0 28px", letterSpacing: "-0.02em" }}>Prayer Wall.</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 0, borderTop: "1px solid rgba(176,106,80,0.18)" }}>
            {data.prayers.map((p) => (
              <div key={p.id} style={{ padding: "20px 0", borderBottom: "1px solid rgba(176,106,80,0.18)" }}>
                <p style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontStyle: "italic", lineHeight: 1.4, color: "var(--espresso)", margin: 0 }}>"{p.excerpt}"</p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, fontSize: 12, color: "var(--muted-warm)", letterSpacing: "0.04em" }}>
                  <span style={{ textTransform: "uppercase", fontWeight: 600 }}>{p.church} · {p.hours}h ago</span>
                  <span style={{ color: "var(--rose-gold)", fontWeight: 700 }}>♡ {p.hearts}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", color: "var(--mauve)", textTransform: "uppercase", margin: 0 }}>§ 04 · Geography</p>
          <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 54, fontWeight: 500, color: "var(--espresso)", margin: "8px 0 28px", letterSpacing: "-0.02em" }}>By city.</h2>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {data.cities.map((c, i) => (
              <div key={c.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 0", borderTop: i === 0 ? "1px solid rgba(176,106,80,0.18)" : "none", borderBottom: "1px solid rgba(176,106,80,0.18)" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
                  <span style={{ fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 500, color: "var(--espresso)", letterSpacing: "-0.01em" }}>{c.name}</span>
                  <span style={{ fontSize: 11, color: "var(--muted-warm)", fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase" }}>{c.country}</span>
                </div>
                <span style={{ fontSize: 14, color: "var(--warm-brown)", fontWeight: 600 }}>{c.count}</span>
              </div>
            ))}
          </div>

          <button style={{ marginTop: 20, padding: "10px 18px", borderRadius: 999, background: "transparent", color: "var(--rose-gold)", border: "1px solid rgba(176,106,80,0.3)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>See all cities →</button>
        </div>
      </section>

      {/* Suggest CTA */}
      <section style={{ maxWidth: 1440, margin: "88px auto 0", padding: "0 56px" }}>
        <div style={{
          padding: "72px 56px", borderRadius: 24,
          background: "var(--espresso)", color: "white",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: -80, right: -80, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(176,106,80,0.4), transparent 70%)" }} />
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.28em", color: "rgba(244,201,192,0.9)", textTransform: "uppercase", margin: 0, position: "relative" }}>For pastors</p>
          <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 72, fontWeight: 500, margin: "16px 0 18px", letterSpacing: "-0.02em", lineHeight: 1, maxWidth: 800, position: "relative" }}>
            <em style={{ fontStyle: "italic", color: "#f4c9c0" }}>Your</em> church should be here.
          </h2>
          <p style={{ fontSize: 17, lineHeight: 1.55, margin: "0 0 28px", maxWidth: 600, color: "rgba(255,255,255,0.8)", position: "relative" }}>
            Add or claim a page. People are searching for a church like yours right now — give them a reason to walk through the door.
          </p>
          <div style={{ display: "flex", gap: 12, position: "relative" }}>
            <button style={{ padding: "16px 30px", borderRadius: 999, background: "white", color: "var(--espresso)", border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Add a church</button>
            <button style={{ padding: "16px 30px", borderRadius: 999, background: "transparent", color: "white", border: "1px solid rgba(255,255,255,0.3)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Claim existing</button>
          </div>
        </div>
      </section>

      <div style={{ height: 80 }} />
    </div>
  );
};

const lpPill = {
  display: "inline-flex", padding: "5px 12px", borderRadius: 999,
  fontSize: 11, fontWeight: 600, letterSpacing: "0.02em",
};

window.LandingPush = LandingPush;
