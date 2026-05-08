/* eslint-disable */
// Variant 4 — Hero fallbacks for churches without a good cover image.
// Five strategies, each preserving the "Bold" DNA so a small church still
// looks premium. All accept just (church) — same data shape — and gracefully
// degrade when fields are missing.

const { useState: useS4 } = React;

// shared label strip used across fallbacks
function V4Eyebrow({ city, country, founded }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
      <span style={{ width: 28, height: 1, background: "var(--blush)" }} />
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.32em", textTransform: "uppercase", color: "var(--blush)" }}>
        {[country, city, founded && `EST. ${founded}`].filter(Boolean).join(" · ")}
      </span>
      <span style={{ width: 28, height: 1, background: "var(--blush)" }} />
    </div>
  );
}

function V4Name({ name, color = "white", accent = "var(--blush)", size = 140 }) {
  const parts = name.split(" ");
  const first = parts[0];
  const rest = parts.slice(1).join(" ");
  return (
    <div>
      <div style={{
        fontFamily: "'Cormorant Garamond', serif", fontWeight: 600,
        fontSize: size, lineHeight: 0.85, color, letterSpacing: "-0.03em",
      }}>{first}</div>
      {rest && (
        <div style={{
          fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 500,
          fontSize: size * 0.7, lineHeight: 0.85, color: accent, letterSpacing: "-0.025em", marginTop: 8,
        }}>{rest.toLowerCase()}</div>
      )}
    </div>
  );
}

// ── Fallback A — Typographic-only hero (no image at all) ──
function V4FallbackTypographic({ church }) {
  return (
    <section style={{
      minHeight: 720, position: "relative", overflow: "hidden",
      background: "linear-gradient(135deg, #2a1612 0%, #1d0f0b 100%)", color: "white",
    }}>
      {/* hairlines as visual structure */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.08, pointerEvents: "none" }}>
        {[...Array(12)].map((_, i) => (
          <div key={i} style={{
            position: "absolute", left: `${(i + 1) * 8.33}%`, top: 0, bottom: 0,
            width: 1, background: "var(--blush)",
          }}/>
        ))}
      </div>
      <nav style={{ position: "relative", padding: "32px 56px", display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "rgba(244,201,192,0.7)", fontSize: 12, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" }}>← Churches</span>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.32em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>
          GospelChannel · A Pilgrim's Index
        </span>
      </nav>
      <div style={{ position: "relative", padding: "120px 56px 80px", textAlign: "center" }}>
        <V4Eyebrow city={church.city} country={church.country} founded={church.founded} />
        <div style={{ marginTop: 40 }}>
          <V4Name name={church.name} size={172} />
        </div>
        <p style={{
          fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic",
          fontSize: 28, lineHeight: 1.4, color: "rgba(255,255,255,0.85)",
          marginTop: 48, maxWidth: 720, margin: "48px auto 0", fontWeight: 400,
        }}>
          "{church.tagline}"
        </p>
      </div>
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        padding: "24px 56px", borderTop: "1px solid rgba(244,201,192,0.18)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(244,201,192,0.7)" }}>
          {(church.streetAddress || `${church.city}, ${church.country}`).toUpperCase()}
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 999, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" }}>
          <span style={{ width: 6, height: 6, background: "#10b981", borderRadius: "50%", boxShadow: "0 0 8px #10b981" }}/>
          Service Sunday 11:00
        </div>
      </div>
    </section>
  );
}

// ── Fallback B — Stained-glass / arch motif (drawn in SVG) ──
function V4FallbackArch({ church }) {
  return (
    <section style={{ minHeight: 720, position: "relative", overflow: "hidden", background: "#1d0f0b", color: "white" }}>
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} viewBox="0 0 1440 720" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <radialGradient id="archGlow" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#b06a50" stopOpacity="0.6"/>
            <stop offset="60%" stopColor="#3b2016" stopOpacity="0"/>
          </radialGradient>
          <linearGradient id="archFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f4c9c0" stopOpacity="0.18"/>
            <stop offset="100%" stopColor="#b06a50" stopOpacity="0.05"/>
          </linearGradient>
        </defs>
        <rect width="1440" height="720" fill="url(#archGlow)"/>
        {/* central arch w/ inner panes */}
        <g transform="translate(720 0)">
          <path d="M 0 80 L -260 80 Q -260 -120 0 -120 Q 260 -120 260 80 L 260 720 L -260 720 Z" transform="translate(0 240)" fill="url(#archFill)" stroke="rgba(244,201,192,0.5)" strokeWidth="1"/>
          {/* mullions */}
          <line x1="0" y1="240" x2="0" y2="720" stroke="rgba(244,201,192,0.35)" strokeWidth="1"/>
          <line x1="-130" y1="320" x2="130" y2="320" stroke="rgba(244,201,192,0.25)" strokeWidth="1"/>
          <line x1="-130" y1="500" x2="130" y2="500" stroke="rgba(244,201,192,0.25)" strokeWidth="1"/>
          {/* flanking arches */}
          <path d="M -360 360 Q -360 220 -480 220 Q -600 220 -600 360 L -600 720 L -360 720 Z" fill="rgba(244,201,192,0.04)" stroke="rgba(244,201,192,0.18)" strokeWidth="1"/>
          <path d="M 360 360 Q 360 220 480 220 Q 600 220 600 360 L 600 720 L 360 720 Z" fill="rgba(244,201,192,0.04)" stroke="rgba(244,201,192,0.18)" strokeWidth="1"/>
        </g>
      </svg>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 0%, rgba(29,15,11,0.4) 60%, rgba(29,15,11,0.95) 100%)" }}/>

      <nav style={{ position: "relative", padding: "32px 56px", display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "rgba(244,201,192,0.7)", fontSize: 12, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" }}>← Churches</span>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.32em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>GospelChannel</span>
      </nav>
      <div style={{ position: "relative", padding: "100px 56px", textAlign: "center" }}>
        <V4Eyebrow city={church.city} country={church.country} founded={church.founded} />
        <div style={{ marginTop: 40 }}><V4Name name={church.name} size={150} /></div>
        <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 26, color: "rgba(255,255,255,0.82)", marginTop: 40, maxWidth: 680, margin: "40px auto 0" }}>
          "{church.tagline}"
        </p>
      </div>
    </section>
  );
}

// ── Fallback C — Logo-as-hero with halo ──
function V4FallbackLogo({ church }) {
  const logo = church.logo || `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(church.name)}&backgroundType=solid&backgroundColor=b06a50&fontFamily=serif`;
  return (
    <section style={{
      minHeight: 720, position: "relative", overflow: "hidden",
      background: "radial-gradient(ellipse at 50% 30%, #4a2519 0%, #1d0f0b 70%)", color: "white",
    }}>
      <nav style={{ position: "relative", padding: "32px 56px", display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "rgba(244,201,192,0.7)", fontSize: 12, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" }}>← Churches</span>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.32em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>GospelChannel</span>
      </nav>
      <div style={{ position: "relative", padding: "60px 56px 80px", textAlign: "center" }}>
        {/* logo halo */}
        <div style={{ position: "relative", width: 220, height: 220, margin: "0 auto 40px" }}>
          {[0,1,2].map(i => (
            <div key={i} style={{
              position: "absolute", inset: -30 - i*30, borderRadius: "50%",
              border: "1px solid rgba(244,201,192,0.18)",
            }}/>
          ))}
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            background: "linear-gradient(135deg, #f4c9c0 0%, #b06a50 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 80px -10px rgba(244,201,192,0.4)",
            overflow: "hidden",
          }}>
            <img src={logo} alt="" style={{ width: "70%", height: "70%", objectFit: "contain" }} onError={(e) => { e.target.style.display = "none"; }} />
            <div style={{
              position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'Cormorant Garamond', serif", fontSize: 96, fontWeight: 600, color: "white",
              letterSpacing: "-0.02em", zIndex: -1,
            }}>
              {church.name.split(" ").slice(0, 2).map(w => w[0]).join("")}
            </div>
          </div>
        </div>
        <V4Eyebrow city={church.city} country={church.country} founded={church.founded} />
        <div style={{ marginTop: 32 }}><V4Name name={church.name} size={120} /></div>
        <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 24, color: "rgba(255,255,255,0.8)", marginTop: 32, maxWidth: 640, margin: "32px auto 0" }}>
          "{church.tagline}"
        </p>
      </div>
    </section>
  );
}

// ── Fallback D — Map-as-hero (place identity instead of building photo) ──
function V4FallbackMap({ church }) {
  // Stylized faux-map drawn with SVG so no API key needed in mock
  return (
    <section style={{ minHeight: 720, position: "relative", overflow: "hidden", background: "#1d0f0b", color: "white" }}>
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} viewBox="0 0 1440 720" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <pattern id="mapGrid" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M 80 0 L 0 0 0 80" fill="none" stroke="rgba(244,201,192,0.08)" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width="1440" height="720" fill="#2a1612"/>
        <rect width="1440" height="720" fill="url(#mapGrid)"/>
        {/* faux roads */}
        <g stroke="rgba(244,201,192,0.18)" fill="none" strokeWidth="2">
          <path d="M 0 320 Q 400 280 720 360 T 1440 380"/>
          <path d="M 200 0 Q 280 240 360 480 T 480 720"/>
          <path d="M 1100 0 Q 1080 200 1180 400 T 1240 720"/>
          <path d="M 0 540 L 1440 520"/>
        </g>
        {/* river */}
        <path d="M 0 200 Q 360 320 720 280 T 1440 240 L 1440 280 Q 720 320 360 360 T 0 240 Z" fill="rgba(155,127,160,0.2)"/>
        {/* pin */}
        <g transform="translate(720 360)">
          <circle r="80" fill="rgba(176,106,80,0.15)"/>
          <circle r="50" fill="rgba(176,106,80,0.3)"/>
          <circle r="20" fill="#b06a50"/>
          <circle r="6" fill="#fdf8f4"/>
        </g>
      </svg>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(29,15,11,0.3) 0%, rgba(29,15,11,0.9) 100%)" }}/>

      <nav style={{ position: "relative", padding: "32px 56px", display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "rgba(244,201,192,0.7)", fontSize: 12, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" }}>← Churches</span>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.32em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>GospelChannel</span>
      </nav>
      <div style={{ position: "absolute", left: 56, right: 56, bottom: 80 }}>
        <V4Eyebrow city={church.city} country={church.country} founded={church.founded} />
        <div style={{ marginTop: 28 }}><V4Name name={church.name} size={120} /></div>
        <div style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 22, color: "rgba(255,255,255,0.85)" }}>
            {church.streetAddress || `${church.city}, ${church.country}`}
          </div>
          <button style={{ padding: "10px 20px", borderRadius: 999, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.3)", color: "white", fontSize: 12, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", cursor: "pointer" }}>
            Get directions →
          </button>
        </div>
      </div>
    </section>
  );
}

// ── Fallback E — Color-from-style + giant Cormorant initial ──
function V4FallbackInitial({ church }) {
  // pick palette from church's first style or denomination — deterministic
  const palettes = {
    pentecostal: { bg: "#1d0f0b", accent: "#f4c9c0", deep: "#b06a50" },
    baptist: { bg: "#1a1d2e", accent: "#9bb5e8", deep: "#5670a8" },
    anglican: { bg: "#0f1f1d", accent: "#c5e0d8", deep: "#4a8b7f" },
    catholic: { bg: "#2a1d0f", accent: "#e8d5a8", deep: "#a88550" },
    nondenominational: { bg: "#1d0f0b", accent: "#f4c9c0", deep: "#b06a50" },
  };
  const key = (church.denomination || "pentecostal").toLowerCase().replace(/[^a-z]/g, "");
  const p = palettes[key] || palettes.pentecostal;
  const initial = church.name[0];

  return (
    <section style={{ minHeight: 720, position: "relative", overflow: "hidden", background: p.bg, color: "white" }}>
      {/* giant initial */}
      <div style={{
        position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)",
        fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 500,
        fontSize: 920, lineHeight: 1, color: p.deep, opacity: 0.35, letterSpacing: "-0.05em",
        pointerEvents: "none", userSelect: "none",
      }}>
        {initial}
      </div>
      {/* edge halo */}
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at center, transparent 30%, ${p.bg} 75%)` }}/>

      <nav style={{ position: "relative", padding: "32px 56px", display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" }}>← Churches</span>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.32em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>GospelChannel</span>
      </nav>
      <div style={{ position: "relative", padding: "140px 56px", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          <span style={{ width: 28, height: 1, background: p.accent }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.32em", textTransform: "uppercase", color: p.accent }}>
            {[church.country, church.city, church.denomination].filter(Boolean).join(" · ")}
          </span>
          <span style={{ width: 28, height: 1, background: p.accent }} />
        </div>
        <div style={{ marginTop: 40 }}>
          <V4Name name={church.name} size={140} accent={p.accent} />
        </div>
        <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 26, color: "rgba(255,255,255,0.82)", marginTop: 40, maxWidth: 700, margin: "40px auto 0" }}>
          "{church.tagline}"
        </p>
      </div>
    </section>
  );
}

// Demo data — sparse small church
const SMALL_CHURCH = {
  name: "Hope Community",
  city: "Linköping",
  country: "Sweden",
  founded: "2008",
  tagline: "A small room. A big welcome. Same Jesus.",
  streetAddress: "Storgatan 14, Linköping",
  denomination: "Pentecostal",
  logo: null,
};

function FallbackHeroVariants() {
  return (
    <div style={{ background: "var(--linen)", padding: "48px 0" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto 48px", padding: "0 56px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.32em", textTransform: "uppercase", color: "var(--rose-gold)", marginBottom: 16 }}>
          The fallback problem
        </div>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 56, fontWeight: 600, color: "var(--espresso)", letterSpacing: "-0.025em", margin: 0, lineHeight: 1.0 }}>
          Most churches don't have a great hero image.<br/>
          <span style={{ fontStyle: "italic", color: "var(--rose-gold)" }}>That can't be a downgrade.</span>
        </h2>
        <p style={{ fontSize: 17, lineHeight: 1.65, color: "var(--warm-brown)", marginTop: 20, maxWidth: 760 }}>
          Today's site swaps to a brown gradient when <code style={{ background: "var(--linen-deep)", padding: "2px 6px", borderRadius: 4, fontSize: 14 }}>coverImageUrl</code> is missing — every empty church then looks identical and forgettable. Below: five strategies that let a small church still feel premium and unique. Pick one (or layer them as a priority chain).
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {[
          { title: "A · Typographic-only", note: "No image needed. Massive serif name + hairline grid carries the weight. Works for everyone.", Comp: V4FallbackTypographic },
          { title: "B · Sacred arch motif", note: "Drawn-in-SVG stained-glass arches. Universally readable as 'church' without a photo.", Comp: V4FallbackArch },
          { title: "C · Logo-as-hero with halo", note: "If church has a logo (most do, even small), elevate it with concentric rings & gradient halo. Falls back to monogram.", Comp: V4FallbackLogo },
          { title: "D · Map-as-hero", note: "Stylized neighborhood map with location pin. 'Place' identity instead of 'building' identity. Strong for local discovery.", Comp: V4FallbackMap },
          { title: "E · Color + giant Cormorant initial", note: "Palette derived from denomination/style. Massive italic initial as background motif. Editorial, mystical.", Comp: V4FallbackInitial },
        ].map((row, i) => (
          <div key={i} style={{ borderTop: "1px solid rgba(176,106,80,0.2)" }}>
            <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 56px 16px", display: "flex", alignItems: "baseline", gap: 24, flexWrap: "wrap" }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 32, fontWeight: 600, color: "var(--rose-gold)" }}>
                {row.title}
              </div>
              <div style={{ fontSize: 14, color: "var(--warm-brown)", maxWidth: 720 }}>{row.note}</div>
            </div>
            <row.Comp church={SMALL_CHURCH} />
          </div>
        ))}
      </div>

      {/* Priority chain recommendation */}
      <div style={{ maxWidth: 1100, margin: "80px auto 0", padding: "0 56px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.32em", textTransform: "uppercase", color: "var(--rose-gold)", marginBottom: 16 }}>
          Recommended priority chain
        </div>
        <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 600, color: "var(--espresso)", letterSpacing: "-0.02em", margin: 0 }}>
          One picker, in order of fallback.
        </h3>
        <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "auto 1fr auto", gap: "16px 24px", alignItems: "center" }}>
          {[
            ["1", "coverImageUrl exists", "Use cinematic photo (current Bold hero)"],
            ["2", "Video thumbnail available", "Use w/ heavier overlay & blur — current behavior"],
            ["3", "Logo present", "Strategy C (halo) — feels owned, branded"],
            ["4", "Has street address", "Strategy D (map) — converts on local intent"],
            ["5", "Otherwise", "Strategy A (typographic) — never feels broken"],
          ].map(([n, when, then], i) => (
            <React.Fragment key={i}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--rose-gold)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 20, fontWeight: 600 }}>{n}</div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 600, color: "var(--espresso)" }}>{when}</div>
              <div style={{ fontSize: 14, color: "var(--warm-brown)", textAlign: "right" }}>{then}</div>
            </React.Fragment>
          ))}
        </div>
        <p style={{ marginTop: 32, fontSize: 14, lineHeight: 1.65, color: "var(--muted-warm)", maxWidth: 720 }}>
          Strategy B (arch) is best as a deliberate choice (e.g. for liturgical / traditional churches who'd opt-in via denomination tag). Strategy E shines when you have a denomination but no other media — could be the default for newly-imported churches before claim.
        </p>
      </div>
    </div>
  );
}

window.FallbackHeroVariants = FallbackHeroVariants;
