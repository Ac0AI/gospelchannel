/* eslint-disable */
// Variant 5 — Color + Giant Initial hero, expanded.
// Shows the chosen fallback strategy across multiple denominations &
// variations on how the initial is treated.

const { useState: useS5 } = React;

// Palette by denomination — each evokes the tradition without being literal
const V5_PALETTES = {
  pentecostal: { bg: "#1d0f0b", accent: "#f4c9c0", deep: "#b06a50", name: "Pentecostal" },
  baptist:     { bg: "#13192a", accent: "#9bb5e8", deep: "#5670a8", name: "Baptist" },
  anglican:    { bg: "#0f1f1d", accent: "#c5e0d8", deep: "#4a8b7f", name: "Anglican" },
  catholic:    { bg: "#2a1d0f", accent: "#e8d5a8", deep: "#a88550", name: "Catholic" },
  lutheran:    { bg: "#1a1a26", accent: "#d4ccdf", deep: "#7a6b96", name: "Lutheran" },
  orthodox:    { bg: "#1d0f1a", accent: "#e8c5d8", deep: "#a85585", name: "Orthodox" },
  nondenom:    { bg: "#1d0f0b", accent: "#f4c9c0", deep: "#b06a50", name: "Non-denominational" },
};

function v5Palette(denom) {
  const k = (denom || "").toLowerCase().replace(/[^a-z]/g, "");
  return V5_PALETTES[k] || V5_PALETTES.nondenom;
}

// — Variation 1: italic giant centered behind the name —
function V5HeroCentered({ church, palette }) {
  const p = palette || v5Palette(church.denomination);
  const initial = church.name[0];
  return (
    <section style={{ minHeight: 720, position: "relative", overflow: "hidden", background: p.bg, color: "white" }}>
      <div style={{
        position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)",
        fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 500,
        fontSize: 920, lineHeight: 1, color: p.deep, opacity: 0.4, letterSpacing: "-0.05em",
        pointerEvents: "none", userSelect: "none",
      }}>{initial}</div>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at center, transparent 30%, ${p.bg} 75%)` }}/>

      <nav style={{ position: "relative", padding: "32px 56px", display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" }}>← Churches</span>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.32em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>GospelChannel</span>
      </nav>
      <div style={{ position: "relative", padding: "120px 56px", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          <span style={{ width: 28, height: 1, background: p.accent }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.32em", textTransform: "uppercase", color: p.accent }}>
            {[church.country, church.city, church.denomination].filter(Boolean).join(" · ")}
          </span>
          <span style={{ width: 28, height: 1, background: p.accent }} />
        </div>
        <div style={{ marginTop: 36 }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: 132, lineHeight: 0.85, letterSpacing: "-0.03em" }}>
            {church.name.split(" ")[0]}
          </div>
          {church.name.split(" ").slice(1).join(" ") && (
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 500, fontSize: 92, lineHeight: 0.85, color: p.accent, marginTop: 6, letterSpacing: "-0.025em" }}>
              {church.name.split(" ").slice(1).join(" ").toLowerCase()}
            </div>
          )}
        </div>
        {church.tagline && (
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 24, color: "rgba(255,255,255,0.82)", marginTop: 36, maxWidth: 640, margin: "36px auto 0" }}>
            "{church.tagline}"
          </p>
        )}
      </div>
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, padding: "20px 56px",
        borderTop: `1px solid ${p.accent}22`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: `${p.accent}cc` }}>
          {church.streetAddress || `${church.city}, ${church.country}`}
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 999, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" }}>
          <span style={{ width: 6, height: 6, background: "#10b981", borderRadius: "50%", boxShadow: "0 0 8px #10b981" }}/>
          Service Sunday 11:00
        </div>
      </div>
    </section>
  );
}

// — Variation 2: initial bleeding off the right edge, name on left —
function V5HeroBleed({ church, palette }) {
  const p = palette || v5Palette(church.denomination);
  const initial = church.name[0];
  return (
    <section style={{ minHeight: 720, position: "relative", overflow: "hidden", background: p.bg, color: "white" }}>
      <div style={{
        position: "absolute", right: -120, top: -80,
        fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 500,
        fontSize: 1000, lineHeight: 0.85, color: p.deep, opacity: 0.5, letterSpacing: "-0.05em",
        pointerEvents: "none", userSelect: "none",
      }}>{initial}</div>
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to right, ${p.bg} 30%, transparent 70%)` }}/>

      <nav style={{ position: "relative", padding: "32px 56px", display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" }}>← Churches</span>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.32em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>GospelChannel</span>
      </nav>
      <div style={{ position: "relative", padding: "100px 56px", maxWidth: 800 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.32em", textTransform: "uppercase", color: p.accent, marginBottom: 24 }}>
          {[church.country, church.city, church.denomination].filter(Boolean).join(" · ")}
        </div>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: 124, lineHeight: 0.85, letterSpacing: "-0.03em" }}>
          {church.name.split(" ")[0]}
        </div>
        {church.name.split(" ").slice(1).join(" ") && (
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 500, fontSize: 84, lineHeight: 0.85, color: p.accent, marginTop: 6, letterSpacing: "-0.025em" }}>
            {church.name.split(" ").slice(1).join(" ").toLowerCase()}
          </div>
        )}
        {church.tagline && (
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 24, color: "rgba(255,255,255,0.8)", marginTop: 32, maxWidth: 540 }}>
            "{church.tagline}"
          </p>
        )}
        <div style={{ marginTop: 40, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button style={{ background: p.accent, color: p.bg, border: "none", padding: "14px 24px", borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: "pointer", letterSpacing: "0.05em" }}>
            Plan a visit →
          </button>
          <button style={{ background: "transparent", color: "white", border: "1px solid rgba(255,255,255,0.3)", padding: "14px 24px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            ▶ Watch online
          </button>
        </div>
      </div>
    </section>
  );
}

// — Variation 3: initial as a window/aperture (the name is INSIDE the letter) —
function V5HeroAperture({ church, palette }) {
  const p = palette || v5Palette(church.denomination);
  const initial = church.name[0];
  return (
    <section style={{ minHeight: 720, position: "relative", overflow: "hidden", background: p.bg, color: "white" }}>
      {/* hairline grid */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.06, pointerEvents: "none" }}>
        {[...Array(8)].map((_, i) => (
          <div key={i} style={{ position: "absolute", left: `${(i + 1) * 12.5}%`, top: 0, bottom: 0, width: 1, background: p.accent }}/>
        ))}
      </div>
      <nav style={{ position: "relative", padding: "32px 56px", display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" }}>← Churches</span>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.32em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>GospelChannel</span>
      </nav>
      <div style={{ position: "relative", padding: "60px 56px", display: "grid", gridTemplateColumns: "auto 1fr", gap: 60, alignItems: "center", minHeight: 600 }}>
        {/* the giant initial sits as a graphic element, not background */}
        <div style={{
          fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 500,
          fontSize: 560, lineHeight: 0.78, color: p.accent, letterSpacing: "-0.06em",
          textShadow: `0 0 80px ${p.deep}66`,
        }}>{initial}</div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.32em", textTransform: "uppercase", color: p.accent, marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 28, height: 1, background: p.accent }}/>
            {[church.country, church.city].filter(Boolean).join(" · ")}
          </div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: 88, lineHeight: 0.95, letterSpacing: "-0.025em" }}>
            {church.name}
          </div>
          {church.tagline && (
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 22, color: "rgba(255,255,255,0.75)", marginTop: 24, maxWidth: 460 }}>
              "{church.tagline}"
            </p>
          )}
          {church.denomination && (
            <div style={{ marginTop: 24, fontSize: 12, fontWeight: 600, color: `${p.accent}cc`, letterSpacing: "0.18em", textTransform: "uppercase" }}>
              {church.denomination} · Est. {church.founded || "—"}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// Sample churches across denominations
const V5_SAMPLES = [
  {
    name: "Hope Community", city: "Linköping", country: "Sweden", founded: "2008",
    denomination: "Pentecostal",
    tagline: "A small room. A big welcome. Same Jesus.",
    streetAddress: "Storgatan 14, Linköping",
  },
  {
    name: "St. Andrew's", city: "Edinburgh", country: "Scotland", founded: "1843",
    denomination: "Anglican",
    tagline: "Liturgy and silence, since the year of grace 1843.",
    streetAddress: "George Street, Edinburgh",
  },
  {
    name: "Grace Baptist Fellowship", city: "Austin", country: "USA", founded: "1976",
    denomination: "Baptist",
    tagline: "A place where the word is taught and the door stays open.",
    streetAddress: "1421 Lavaca St, Austin",
  },
  {
    name: "Maria Magdalena", city: "Stockholm", country: "Sweden", founded: "1634",
    denomination: "Lutheran",
    tagline: "Four centuries of bells over Södermalm.",
    streetAddress: "Bellmansgatan 13, Stockholm",
  },
];

function GiantInitialShowcase() {
  const [variation, setVariation] = useS5(0);
  const [sampleIdx, setSampleIdx] = useS5(0);
  const variations = [
    { id: "centered", label: "Centered behind name", Comp: V5HeroCentered, note: "Initial sits behind text as ambient ornament. Most editorial. Use as default." },
    { id: "bleed", label: "Bleeds off right edge", Comp: V5HeroBleed, note: "Initial cropped — implies scale beyond frame. Strong identity, asymmetric." },
    { id: "aperture", label: "Initial as graphic", Comp: V5HeroAperture, note: "Initial is a discrete graphic element next to the name. More 'monogram', more grounded." },
  ];
  const V = variations[variation];
  const sample = V5_SAMPLES[sampleIdx];

  return (
    <div style={{ background: "var(--linen)" }}>
      <div style={{ padding: "56px 56px 40px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.32em", textTransform: "uppercase", color: "var(--rose-gold)", marginBottom: 16 }}>
          The chosen direction · expanded
        </div>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 56, fontWeight: 600, color: "var(--espresso)", letterSpacing: "-0.025em", margin: 0, lineHeight: 1.0 }}>
          Color + giant initial.<br/>
          <span style={{ fontStyle: "italic", color: "var(--rose-gold)" }}>Three takes, every denomination.</span>
        </h2>
        <p style={{ fontSize: 16, lineHeight: 1.65, color: "var(--warm-brown)", marginTop: 16, maxWidth: 720 }}>
          Palette derives from the church's tradition, the giant Cormorant initial does the visual heavy lifting. Below: pick a layout variation, then cycle through sample churches to feel how it adapts.
        </p>

        {/* controls */}
        <div style={{ marginTop: 32, display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--muted-warm)", marginBottom: 10 }}>Layout</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {variations.map((v, i) => (
                <button key={v.id} onClick={() => setVariation(i)} style={{
                  padding: "10px 16px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                  background: variation === i ? "var(--espresso)" : "white",
                  color: variation === i ? "white" : "var(--espresso)",
                  border: "1px solid " + (variation === i ? "var(--espresso)" : "rgba(176,106,80,0.25)"),
                  cursor: "pointer",
                }}>{v.label}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--muted-warm)", marginBottom: 10 }}>Sample church</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {V5_SAMPLES.map((s, i) => (
                <button key={i} onClick={() => setSampleIdx(i)} style={{
                  padding: "10px 16px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                  background: sampleIdx === i ? "var(--rose-gold)" : "white",
                  color: sampleIdx === i ? "white" : "var(--espresso)",
                  border: "1px solid " + (sampleIdx === i ? "var(--rose-gold)" : "rgba(176,106,80,0.25)"),
                  cursor: "pointer",
                }}>{s.denomination}</button>
              ))}
            </div>
          </div>
        </div>

        <p style={{ marginTop: 24, fontSize: 14, lineHeight: 1.6, color: "var(--muted-warm)", fontStyle: "italic", maxWidth: 720 }}>
          {V.note}
        </p>
      </div>

      {/* live hero */}
      <V.Comp church={sample} />

      {/* gallery: same variation × all denominations */}
      <div style={{ padding: "80px 56px 0", maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.32em", textTransform: "uppercase", color: "var(--rose-gold)", marginBottom: 16 }}>
          Same layout · every tradition
        </div>
        <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 600, color: "var(--espresso)", letterSpacing: "-0.02em", margin: 0 }}>
          Notice how the palette shifts but the structure holds.
        </h3>
      </div>
      <div style={{ display: "grid", gap: 24, padding: "32px 56px 56px" }}>
        {V5_SAMPLES.map((s, i) => (
          <div key={i} style={{
            transform: "scale(0.62)", transformOrigin: "top left",
            width: "161%", marginBottom: -280,
            boxShadow: "0 24px 60px -32px rgba(59,42,34,0.4)",
            borderRadius: 12, overflow: "hidden",
          }}>
            <V.Comp church={s} />
          </div>
        ))}
      </div>

      {/* palette tokens */}
      <div style={{ padding: "60px 56px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.32em", textTransform: "uppercase", color: "var(--rose-gold)", marginBottom: 16 }}>
          Palette tokens
        </div>
        <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 600, color: "var(--espresso)", letterSpacing: "-0.02em", margin: "0 0 24px" }}>
          One token set per tradition. Three colors each.
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          {Object.entries(V5_PALETTES).map(([k, p]) => (
            <div key={k} style={{ background: "white", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(176,106,80,0.15)" }}>
              <div style={{ height: 80, background: p.bg, display: "flex", alignItems: "center", justifyContent: "center", color: p.accent, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 64, lineHeight: 1, fontWeight: 500 }}>
                Aa
              </div>
              <div style={{ display: "flex" }}>
                <div style={{ flex: 1, height: 28, background: p.deep }}/>
                <div style={{ flex: 1, height: 28, background: p.accent }}/>
              </div>
              <div style={{ padding: "12px 14px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--espresso)" }}>{p.name}</div>
                <div style={{ marginTop: 6, fontFamily: "ui-monospace, monospace", fontSize: 10, color: "var(--muted-warm)", lineHeight: 1.5 }}>
                  {p.bg}<br/>{p.deep}<br/>{p.accent}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

window.GiantInitialShowcase = GiantInitialShowcase;
