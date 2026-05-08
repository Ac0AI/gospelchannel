// Landing page — Variant A "Säker" (cinematic full-bleed hero with centered search)
// Polished refinement of current page.tsx — same DNA, more rhythm, magazine cards.

const LandingSafe = ({ data }) => {
  const [heroIdx, setHeroIdx] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setHeroIdx((i) => (i + 1) % data.heroRotator.length), 5000);
    return () => clearInterval(id);
  }, [data.heroRotator.length]);

  const hero = data.heroRotator[heroIdx];

  return (
    <div style={{ background: "var(--linen)", minHeight: "100%", fontFamily: "var(--font-sans)", color: "var(--espresso)" }}>
      {/* Header */}
      <header style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, padding: "24px 48px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "white" }}>
        <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em" }}>GospelChannel</div>
        <nav style={{ display: "flex", gap: 32, fontSize: 14, fontWeight: 500, whiteSpace: "nowrap" }}>
          <span style={{ opacity: 0.85 }}>Browse</span>
          <span style={{ opacity: 0.85 }}>Prayer Wall</span>
          <span style={{ opacity: 0.85 }}>For churches</span>
          <span style={{ opacity: 0.85 }}>About</span>
        </nav>
        <button style={{ padding: "8px 18px", borderRadius: 999, background: "rgba(255,255,255,0.15)", color: "white", border: "1px solid rgba(255,255,255,0.25)", backdropFilter: "blur(8px)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Sign in</button>
      </header>

      {/* Cinematic full-bleed hero */}
      <section style={{ position: "relative", height: 760, overflow: "hidden" }}>
        {data.heroRotator.map((h, i) => (
          <div key={i} style={{
            position: "absolute", inset: 0,
            backgroundImage: `url(${h.image})`,
            backgroundSize: "cover", backgroundPosition: "center",
            opacity: i === heroIdx ? 1 : 0,
            transition: "opacity 1.4s ease",
            transform: i === heroIdx ? "scale(1.02)" : "scale(1)",
            transitionProperty: "opacity, transform",
            transitionDuration: "1.4s, 7s",
          }} />
        ))}
        {/* Cinematic gradient */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(20,12,8,0.55) 0%, rgba(20,12,8,0.25) 35%, rgba(20,12,8,0.55) 75%, rgba(20,12,8,0.85) 100%)" }} />

        {/* Hero content */}
        <div style={{ position: "relative", zIndex: 2, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 48px", textAlign: "center" }}>
          <p style={{ color: "rgba(255,255,255,0.7)", fontStyle: "italic", fontSize: 17, marginBottom: 12, fontFamily: "var(--font-serif)" }}>People find God in different ways.</p>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 88, fontWeight: 600, color: "white", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.08, textShadow: "0 2px 30px rgba(0,0,0,0.3)", whiteSpace: "nowrap" }}>
            Find <em style={{ fontStyle: "italic", color: "#f4c9c0" }}>yours</em>.
          </h1>
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 19, marginTop: 18, marginBottom: 36, maxWidth: 520, lineHeight: 1.5 }}>
            Listen to worship. Watch sermons. Find where you belong — before Sunday.
          </p>

          {/* Premium search */}
          <div style={{ width: "100%", maxWidth: 620, position: "relative" }}>
            <div style={{
              display: "flex", alignItems: "center",
              background: "rgba(255,255,255,0.97)",
              borderRadius: 999,
              padding: "8px 8px 8px 24px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.1)",
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9e8075" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.5-4.5" /></svg>
              <input
                placeholder={`Search ${data.stats.label} churches by name, city, or country`}
                style={{ flex: 1, border: "none", outline: "none", padding: "16px 16px", fontSize: 16, background: "transparent", color: "var(--espresso)", fontFamily: "var(--font-sans)" }}
              />
              <button style={{ padding: "12px 28px", borderRadius: 999, background: "var(--rose-gold)", color: "white", border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer", letterSpacing: "0.01em" }}>Find a church</button>
            </div>

            {/* Quick filter chips */}
            <div style={{ display: "flex", gap: 8, marginTop: 18, justifyContent: "center", flexWrap: "wrap" }}>
              {["Near me", "English", "Worship music", "Kids program", "Sunday morning"].map((c) => (
                <button key={c} style={{
                  padding: "6px 14px", borderRadius: 999,
                  background: "rgba(255,255,255,0.12)", color: "white",
                  border: "1px solid rgba(255,255,255,0.25)",
                  fontSize: 13, fontWeight: 500, cursor: "pointer", backdropFilter: "blur(8px)",
                }}>{c}</button>
              ))}
              <button style={{ padding: "6px 14px", borderRadius: 999, background: "transparent", color: "#f4c9c0", border: "1px solid rgba(244,201,192,0.4)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Surprise me ✨</button>
            </div>
          </div>

          {/* Hero attribution */}
          <div style={{ position: "absolute", bottom: 32, left: 48, color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Now showing · <span style={{ color: "white" }}>{hero.caption}</span> · {hero.city}
          </div>
          <div style={{ position: "absolute", bottom: 32, right: 48, display: "flex", gap: 6 }}>
            {data.heroRotator.map((_, i) => (
              <div key={i} style={{ width: i === heroIdx ? 24 : 6, height: 6, borderRadius: 999, background: i === heroIdx ? "white" : "rgba(255,255,255,0.4)", transition: "all 0.4s" }} />
            ))}
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <div style={{ background: "var(--linen-deep)", borderTop: "1px solid rgba(176,106,80,0.12)", borderBottom: "1px solid rgba(176,106,80,0.12)", padding: "20px 48px", textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 14, color: "var(--warm-brown)", letterSpacing: "0.04em" }}>
          <strong style={{ color: "var(--espresso)", fontWeight: 700 }}>{data.stats.label}</strong> churches
          <span style={{ margin: "0 14px", opacity: 0.4 }}>·</span>
          <strong style={{ color: "var(--espresso)", fontWeight: 700 }}>{data.stats.countryCount}</strong> countries
          <span style={{ margin: "0 14px", opacity: 0.4 }}>·</span>
          Free, no ads, no tracking
        </p>
      </div>

      {/* Featured churches — magazine grid */}
      <section style={{ maxWidth: 1280, margin: "0 auto", padding: "80px 48px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 36 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", color: "var(--mauve)", textTransform: "uppercase", margin: 0 }}>This week's editorial picks</p>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 44, fontWeight: 600, color: "var(--espresso)", margin: "8px 0 0", letterSpacing: "-0.01em" }}>Featured churches</h2>
          </div>
          <button style={{ padding: "10px 20px", borderRadius: 999, background: "transparent", color: "var(--rose-gold)", border: "1px solid rgba(176,106,80,0.3)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Browse all {data.stats.label} →</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
          {data.featured.slice(0, 8).map((c) => (
            <ChurchCard key={c.slug} church={c} />
          ))}
        </div>
      </section>

      {/* Browse by tradition — magazine cards with color-takeover + example church */}
      <section style={{ maxWidth: 1280, margin: "0 auto", padding: "80px 48px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 36 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", color: "var(--mauve)", textTransform: "uppercase", margin: 0 }}>Or browse by</p>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 44, fontWeight: 600, color: "var(--espresso)", margin: "8px 0 0", letterSpacing: "-0.01em" }}>Tradition</h2>
            <p style={{ fontSize: 15, color: "var(--warm-brown)", marginTop: 10, maxWidth: 460 }}>Eight ways the same gospel sounds. Pick the one that already feels like home.</p>
          </div>
          <span style={{ fontSize: 13, color: "var(--rose-gold)", fontWeight: 600 }}>See all 12 traditions →</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {data.traditions.map((t, i) => {
            // Each tradition gets a tone of voice + an example church
            const meta = {
              "Pentecostal": { vibe: "Anthemic · raised hands", example: "Hillsong, Bethel" },
              "Anglican": { vibe: "Choral · liturgical", example: "Holy Trinity Brompton" },
              "Baptist": { vibe: "Sermon-led · gospel choir", example: "Saddleback" },
              "Lutheran": { vibe: "Hymns · stillness", example: "Sankta Maria, Malmö" },
              "Catholic": { vibe: "Mass · incense · stone", example: "Notre-Dame de Paris" },
              "Orthodox": { vibe: "Iconography · chant", example: "St. Sophia, Istanbul" },
              "Non-denom": { vibe: "Modern · no labels", example: "Elevation, Passion" },
              "Charismatic": { vibe: "Spirit-led · spontaneous", example: "Bethel · Jesus Culture" },
            }[t.name] || { vibe: "", example: "" };
            return (
              <div key={t.name} style={{
                borderRadius: 20, overflow: "hidden",
                border: "1px solid rgba(176,106,80,0.12)",
                cursor: "pointer", display: "flex", flexDirection: "column",
                background: "white",
                transition: "transform .2s, box-shadow .2s",
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 16px 40px rgba(59,42,34,0.10)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
              >
                {/* Big color block with giant initial */}
                <div style={{
                  height: 140, background: t.swatch, position: "relative", overflow: "hidden",
                  display: "flex", alignItems: "flex-end", padding: "0 20px 12px",
                }}>
                  <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 75% 30%, rgba(255,255,255,0.18), transparent 55%)` }} />
                  <span style={{
                    position: "absolute", top: -28, right: -12,
                    fontFamily: "var(--font-serif)", fontSize: 200, fontWeight: 600,
                    color: "rgba(255,255,255,0.18)", letterSpacing: "-0.04em", lineHeight: 1, fontStyle: "italic",
                  }}>{t.name[0]}</span>
                  <span style={{ position: "relative", fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", color: "rgba(255,255,255,0.95)", textTransform: "uppercase" }}>
                    No. {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                {/* Body */}
                <div style={{ padding: "18px 20px 20px", flex: 1, display: "flex", flexDirection: "column" }}>
                  <div style={{ fontFamily: "var(--font-serif)", fontSize: 24, fontWeight: 600, color: "var(--espresso)", letterSpacing: "-0.01em", lineHeight: 1.1 }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: "var(--warm-brown)", marginTop: 6, fontStyle: "italic", fontFamily: "var(--font-serif)", fontSize: 14 }}>{meta.vibe}</div>
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(176,106,80,0.10)", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontSize: 11, color: "var(--muted-warm)", letterSpacing: "0.06em" }}>e.g. {meta.example}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--espresso)" }}>{t.count.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Prayer wall preview + Cities side-by-side */}
      <section style={{ maxWidth: 1280, margin: "0 auto", padding: "80px 48px 0", display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 48 }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 36, fontWeight: 600, color: "var(--espresso)", margin: 0, letterSpacing: "-0.01em" }}>Prayer Wall</h2>
            <span style={{ fontSize: 13, color: "var(--rose-gold)", fontWeight: 600 }}>See all →</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {data.prayers.map((p) => (
              <div key={p.id} style={{ background: "white", border: "1px solid rgba(176,106,80,0.14)", borderRadius: 18, padding: "20px 24px" }}>
                <p style={{ fontFamily: "var(--font-serif)", fontSize: 17, lineHeight: 1.5, color: "var(--espresso)", margin: 0, fontStyle: "italic" }}>"{p.excerpt}"</p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, fontSize: 12, color: "var(--muted-warm)" }}>
                  <span>{p.church} · {p.hours}h ago</span>
                  <span style={{ color: "var(--rose-gold)", fontWeight: 600 }}>♡ {p.hearts}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 36, fontWeight: 600, color: "var(--espresso)", margin: "0 0 24px", letterSpacing: "-0.01em" }}>By city</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {data.cities.map((c) => (
              <div key={c.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "16px 0", borderBottom: "1px solid rgba(176,106,80,0.12)" }}>
                <div>
                  <span style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600, color: "var(--espresso)" }}>{c.name}</span>
                  <span style={{ fontSize: 12, color: "var(--muted-warm)", marginLeft: 8, letterSpacing: "0.06em" }}>{c.country}</span>
                </div>
                <span style={{ fontSize: 14, color: "var(--warm-brown)" }}>{c.count}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Suggest CTA */}
      <section style={{ maxWidth: 1280, margin: "80px auto 0", padding: "0 48px" }}>
        <div style={{
          borderRadius: 28, padding: "56px 48px",
          background: "linear-gradient(135deg, rgba(252,233,229,0.7) 0%, white 60%)",
          border: "1px solid rgba(176,106,80,0.18)",
          display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 48, alignItems: "center",
        }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", color: "var(--mauve)", textTransform: "uppercase", margin: 0 }}>For pastors & church leaders</p>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 44, fontWeight: 600, color: "var(--espresso)", margin: "10px 0 14px", letterSpacing: "-0.01em" }}>Your church should be here.</h2>
            <p style={{ fontSize: 16, color: "var(--warm-brown)", lineHeight: 1.55, margin: "0 0 24px", maxWidth: 480 }}>
              People are already searching for a church like yours. Add it so the next first-time visitor finds the right info before they walk through your doors.
            </p>
            <div style={{ display: "flex", gap: 12 }}>
              <button style={{ padding: "14px 26px", borderRadius: 999, background: "var(--rose-gold)", color: "white", border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Add a church</button>
              <button style={{ padding: "14px 26px", borderRadius: 999, background: "transparent", color: "var(--espresso)", border: "1px solid rgba(176,106,80,0.3)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Claim existing</button>
            </div>
          </div>

          <div style={{ background: "white", borderRadius: 18, padding: 28, border: "1px solid rgba(176,106,80,0.15)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", color: "var(--muted-warm)", textTransform: "uppercase" }}>What you get</div>
            <ul style={{ margin: "14px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                "A premium church page (like the ones you see featured)",
                "Spotify, YouTube & service times in one place",
                "Verified badge once claimed",
                "Free forever — no ads, no tracking",
              ].map((b) => (
                <li key={b} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "var(--espresso)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b06a50" strokeWidth="2.5"><path d="M5 12l5 5L20 7" /></svg>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div style={{ height: 80 }} />
    </div>
  );
};

// Reusable church card — magazine style
const ChurchCard = ({ church }) => {
  return (
    <div style={{
      background: "white", borderRadius: 18, overflow: "hidden",
      border: "1px solid rgba(176,106,80,0.12)",
      cursor: "pointer", display: "flex", flexDirection: "column",
    }}>
      {church.thumbnail ? (
        <div style={{ aspectRatio: "4/3", overflow: "hidden", position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${church.thumbnail})`, backgroundSize: "cover", backgroundPosition: "center" }} />
          {church.verified && (
            <div style={{ position: "absolute", top: 12, right: 12, padding: "5px 10px", borderRadius: 999, background: "rgba(255,255,255,0.95)", fontSize: 11, fontWeight: 700, color: "var(--rose-gold-deep)", display: "flex", alignItems: "center", gap: 4 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="#b06a50"><path d="M12 2l2.5 2.5L18 4l1 3.5L22 9l-1.5 3.5L22 16l-3 1.5L18 21l-3.5-1L12 22l-2.5-2L6 21l-1-3.5L2 16l1.5-3.5L2 9l3-1.5L6 4l3.5.5z" /></svg>
              Verified
            </div>
          )}
        </div>
      ) : (
        <div style={{ aspectRatio: "4/3", background: church.palette.bg, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 30% 40%, ${church.palette.accent}33, transparent 60%)` }} />
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 120, color: church.palette.accent, opacity: 0.85, fontWeight: 600, letterSpacing: "-0.04em" }}>{church.initial}</div>
        </div>
      )}

      <div style={{ padding: "18px 20px", flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", color: "var(--muted-warm)", textTransform: "uppercase" }}>
          {church.city} · {church.country}
        </div>
        <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600, color: "var(--espresso)", margin: "6px 0 6px", letterSpacing: "-0.01em", lineHeight: 1.2 }}>{church.name}</h3>
        <div style={{ fontSize: 13, color: "var(--warm-brown)", marginTop: 0 }}>{church.style}</div>

        <p style={{ fontSize: 13, color: "var(--warm-brown)", lineHeight: 1.5, margin: "12px 0 14px", flex: 1 }}>{church.blurb}</p>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {church.hasMusic && <span style={pill}>♪ Music</span>}
          {church.hasKids && <span style={pill}>Kids</span>}
          {church.hasService && <span style={pill}>Times</span>}
          {church.languages.length > 1 && <span style={pill}>{church.languages.length} langs</span>}
        </div>
      </div>
    </div>
  );
};

const pill = {
  display: "inline-flex", padding: "3px 10px", borderRadius: 999,
  background: "var(--linen-deep)", fontSize: 11, fontWeight: 600,
  color: "var(--warm-brown)", letterSpacing: "0.02em",
};

window.LandingSafe = LandingSafe;
window.LandingChurchCard = ChurchCard;
