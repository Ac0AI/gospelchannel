/* eslint-disable */
// Variant 3 — Bold Remix
// Approach: cinematic, gallery-driven, sacred atmosphere. Full-bleed dark hero
// with arch motif, oversized typography, asymmetric scroll-driven sections,
// gallery grids, immersive music section as a full-bleed "now playing" panel.

const { useState: useStateV3 } = React;

const v3Styles = {
  page: {
    fontFamily: "'Nunito', system-ui, sans-serif",
    color: "var(--espresso)",
    background: "var(--linen)",
    minHeight: "100%",
    paddingBottom: 0,
  },
};

function V3Hero({ church }) {
  return (
    <section style={{
      position: "relative", minHeight: 920, overflow: "hidden",
      background: "#120906", color: "white",
    }}>
      {/* primary image */}
      <img src={church.hero.primary} alt="" style={{
        position: "absolute", inset: 0, width: "100%", height: "100%",
        objectFit: "cover", objectPosition: "center 35%",
        filter: "saturate(0.85) contrast(1.05)",
      }} />

      {/* arch mask overlay */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} viewBox="0 0 1400 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <mask id="archMask">
            <rect width="1400" height="900" fill="white" />
            <path d="M 700 180 Q 540 180 540 380 L 540 720 L 860 720 L 860 380 Q 860 180 700 180 Z" fill="black" opacity="0.0"/>
          </mask>
        </defs>
        {/* central arch outline */}
        <path d="M 700 200 Q 530 200 530 400 L 530 760 L 870 760 L 870 400 Q 870 200 700 200 Z"
          fill="none" stroke="rgba(244,201,192,0.18)" strokeWidth="1" />
        <path d="M 700 240 Q 560 240 560 420 L 560 760 L 840 760 L 840 420 Q 840 240 700 240 Z"
          fill="none" stroke="rgba(244,201,192,0.10)" strokeWidth="1" />
      </svg>

      {/* gradients */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to bottom, rgba(18,9,6,0.65) 0%, rgba(18,9,6,0.2) 30%, rgba(18,9,6,0.5) 70%, rgba(18,9,6,0.95) 100%)",
      }} />
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at 50% 30%, rgba(176,106,80,0.25) 0%, transparent 50%)",
      }} />
      {/* subtle grain */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.4, mixBlendMode: "overlay",
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")",
      }} />

      {/* top nav */}
      <nav style={{ position: "relative", zIndex: 2, padding: "32px 56px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <a style={{ color: "rgba(244,201,192,0.7)", fontSize: 12, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", textDecoration: "none" }}>← All churches</a>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.32em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>
          GospelChannel · A Pilgrim's Index
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 12, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(244,201,192,0.7)" }}>
          <span>♡ Save</span>
          <span>↗ Share</span>
        </div>
      </nav>

      {/* center title */}
      <div style={{ position: "relative", zIndex: 2, padding: "120px 56px 200px", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
          <span style={{ width: 32, height: 1, background: "var(--blush)" }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.36em", textTransform: "uppercase", color: "var(--blush)" }}>
            Volume Forty Seven · {church.country}
          </span>
          <span style={{ width: 32, height: 1, background: "var(--blush)" }} />
        </div>

        <h1 style={{
          fontFamily: "'Cormorant Garamond', serif", fontWeight: 600,
          fontSize: 200, lineHeight: 0.85, color: "white",
          letterSpacing: "-0.04em", margin: 0,
          textShadow: "0 2px 60px rgba(0,0,0,0.5)",
        }}>
          {church.name.split(" ")[0]}
        </h1>
        <h1 style={{
          fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 500,
          fontSize: 140, lineHeight: 0.85, color: "var(--blush)",
          letterSpacing: "-0.03em", margin: "12px 0 0",
        }}>
          {church.name.split(" ").slice(1).join(" ").toLowerCase()}
        </h1>

        <p style={{
          fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic",
          fontSize: 26, lineHeight: 1.4, color: "rgba(255,255,255,0.85)",
          marginTop: 56, maxWidth: 720, marginLeft: "auto", marginRight: "auto", fontWeight: 400,
        }}>
          "{church.tagline}"
        </p>
      </div>

      {/* bottom strip */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 2,
        padding: "24px 56px",
        borderTop: "1px solid rgba(244,201,192,0.18)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: "linear-gradient(to top, rgba(18,9,6,1) 0%, rgba(18,9,6,0) 100%)",
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(244,201,192,0.7)" }}>
          {church.country.toUpperCase()} · {church.city.toUpperCase()} · EST. {church.founded}
        </div>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          fontSize: 11, fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", color: "white",
          padding: "10px 20px", borderRadius: 999, background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.15)", backdropFilter: "blur(8px)",
        }}>
          <span style={{ width: 6, height: 6, background: "#10b981", borderRadius: "50%", boxShadow: "0 0 8px #10b981" }}/>
          Service Sunday 11:00
        </div>
        <div style={{ fontSize: 12, color: "rgba(244,201,192,0.5)", letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 600 }}>
          ↓ Scroll to enter
        </div>
      </div>
    </section>
  );
}

function V3Quote({ church }) {
  return (
    <section style={{
      background: "linear-gradient(180deg, #120906 0%, #1d0f0b 100%)", color: "white",
      padding: "180px 56px",
    }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.4em", textTransform: "uppercase", color: "var(--blush)", marginBottom: 48 }}>
          A Word from the Team
        </div>
        <p style={{
          fontFamily: "'Cormorant Garamond', serif", fontWeight: 500, fontStyle: "italic",
          fontSize: 64, lineHeight: 1.15, color: "white", letterSpacing: "-0.02em", margin: 0,
        }}>
          "{church.pastor.quote}"
        </p>
        <div style={{ marginTop: 64, display: "inline-flex", alignItems: "center", gap: 20 }}>
          <img src={church.pastor.photo} alt="" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--blush)" }} />
          <div style={{ textAlign: "left" }}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 600, color: "white" }}>{church.pastor.name}</div>
            <div style={{ fontSize: 12, color: "var(--blush)", letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 700, marginTop: 4 }}>
              {church.pastor.title}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function V3Welcome({ church }) {
  return (
    <section style={{ padding: "160px 56px 0" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 80 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.36em", textTransform: "uppercase", color: "var(--rose-gold)", marginBottom: 24 }}>
            About this place
          </div>
          <h2 style={{
            fontFamily: "'Cormorant Garamond', serif", fontSize: 88, lineHeight: 0.95,
            fontWeight: 600, color: "var(--espresso)", letterSpacing: "-0.025em", margin: 0,
            maxWidth: 1100, marginLeft: "auto", marginRight: "auto",
          }}>
            More than a building.<br/>
            <span style={{ fontStyle: "italic", color: "var(--rose-gold)" }}>A people, on Sundays.</span>
          </h2>
        </div>

        {/* gallery row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 1fr", gap: 16, marginBottom: 80 }}>
          <div style={{ aspectRatio: "3/4", borderRadius: 8, overflow: "hidden", marginTop: 60 }}>
            <img src={church.hero.crowd} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
          </div>
          <div style={{ aspectRatio: "16/11", borderRadius: 8, overflow: "hidden" }}>
            <img src={church.hero.primary} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
          </div>
          <div style={{ aspectRatio: "3/4", borderRadius: 8, overflow: "hidden", marginTop: 100 }}>
            <img src={church.hero.interior} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
          </div>
        </div>

        <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: 22, lineHeight: 1.6, color: "var(--warm-brown)", margin: 0, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 400 }}>
            {church.description}
          </p>
        </div>
      </div>
    </section>
  );
}

function V3Sunday({ church }) {
  return (
    <section style={{ padding: "160px 56px 0" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.36em", textTransform: "uppercase", color: "var(--rose-gold)", marginBottom: 24 }}>
              Your first Sunday
            </div>
            <h2 style={{
              fontFamily: "'Cormorant Garamond', serif", fontSize: 80, lineHeight: 0.95,
              fontWeight: 600, color: "var(--espresso)", letterSpacing: "-0.025em", margin: 0,
            }}>
              You'll know<br/>
              <span style={{ fontStyle: "italic", color: "var(--rose-gold)" }}>what to expect</span><br/>
              before you arrive.
            </h2>

            <div style={{ marginTop: 48, display: "flex", flexDirection: "column", gap: 4 }}>
              {[
                ["Doors open", "10:30"],
                ["Worship begins", "11:00"],
                ["Teaching", "11:35"],
                ["Coffee in the foyer", "12:20"],
              ].map(([k, v], i) => (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "1fr auto",
                  alignItems: "baseline", gap: 24,
                  padding: "20px 0", borderTop: "1px solid rgba(176,106,80,0.25)",
                }}>
                  <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 500, color: "var(--espresso)", letterSpacing: "-0.01em" }}>
                    {k}
                  </span>
                  <span style={{
                    fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic",
                    fontSize: 32, fontWeight: 600, color: "var(--rose-gold)", fontVariantNumeric: "tabular-nums",
                  }}>
                    {v}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{
              position: "relative", aspectRatio: "4/5", borderRadius: 12, overflow: "hidden",
              boxShadow: "0 32px 80px -24px rgba(59,42,34,0.4)",
            }}>
              <img src={church.hero.interior} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                padding: 32, color: "white",
                background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)",
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: "var(--blush)", marginBottom: 12 }}>
                  What to expect
                </div>
                <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, lineHeight: 1.4, fontWeight: 500, margin: 0, fontStyle: "italic" }}>
                  {church.whatToExpect}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function V3Sound({ church }) {
  return (
    <section style={{
      marginTop: 160,
      background: "radial-gradient(ellipse at 30% 20%, #4a2519 0%, #1d0f0b 70%)",
      color: "white", padding: "140px 56px", overflow: "hidden", position: "relative",
    }}>
      {/* decorative arches background */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.06 }} aria-hidden viewBox="0 0 1400 800" preserveAspectRatio="xMidYMid slice">
        <g stroke="var(--blush)" strokeWidth="1" fill="none">
          <path d="M 200 800 L 200 300 Q 200 100 350 100 Q 500 100 500 300 L 500 800" />
          <path d="M 600 800 L 600 250 Q 600 50 750 50 Q 900 50 900 250 L 900 800" />
          <path d="M 1000 800 L 1000 300 Q 1000 100 1150 100 Q 1300 100 1300 300 L 1300 800" />
        </g>
      </svg>

      <div style={{ maxWidth: 1400, margin: "0 auto", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 48 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "8px 14px", background: "rgba(29,185,84,0.15)", border: "1px solid rgba(29,185,84,0.4)",
            borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase",
            color: "#1ed760",
          }}>
            <span style={{ width: 6, height: 6, background: "#1ed760", borderRadius: "50%", boxShadow: "0 0 8px #1ed760", animation: "pulse 2s infinite" }}/>
            Now playing
          </div>
          <span style={{ fontSize: 11, color: "rgba(244,201,192,0.5)", letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 700 }}>
            The {church.name.split(" ")[0]} Sound
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 80, alignItems: "center" }}>
          {/* big album art */}
          <div style={{ position: "relative" }}>
            <div style={{
              aspectRatio: "1", borderRadius: 16,
              background: "linear-gradient(135deg, var(--rose-gold) 0%, var(--mauve) 50%, #4a2519 100%)",
              display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
              boxShadow: "0 40px 80px -20px rgba(0,0,0,0.6), 0 0 100px -20px rgba(176,106,80,0.4)",
              position: "relative", overflow: "hidden",
            }}>
              {/* subtle pattern */}
              <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.15 }} viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">
                <g fill="none" stroke="white" strokeWidth="1">
                  <circle cx="200" cy="200" r="80"/>
                  <circle cx="200" cy="200" r="120"/>
                  <circle cx="200" cy="200" r="160"/>
                  <path d="M 200 80 L 200 320 M 80 200 L 320 200"/>
                </g>
              </svg>
              <div style={{ position: "relative", textAlign: "center", padding: 40, color: "white" }}>
                <svg width="60" height="60" viewBox="0 0 24 24" fill="white" opacity="0.95" style={{ marginBottom: 20 }}><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.32em", textTransform: "uppercase", opacity: 0.8 }}>
                  Worship Essentials
                </div>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 56, fontWeight: 600, lineHeight: 0.95, marginTop: 16, letterSpacing: "-0.02em" }}>
                  The {church.name.split(" ")[0]} Sound
                </div>
                <div style={{ marginTop: 12, fontSize: 13, opacity: 0.75, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600 }}>
                  142 songs · 8h 47m
                </div>
              </div>
            </div>
            {/* play button */}
            <button style={{
              position: "absolute", right: -28, bottom: 48,
              width: 96, height: 96, borderRadius: "50%",
              background: "#1DB954", color: "white", border: "none",
              fontSize: 36, cursor: "pointer",
              boxShadow: "0 16px 40px -8px rgba(29,185,84,0.5)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              ▶
            </button>
          </div>

          {/* tracklist */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: "var(--blush)", marginBottom: 20 }}>
              Most-played anthems
            </div>
            <div>
              {church.topSongs.slice(0, 5).map((song, i) => (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 20, alignItems: "center",
                  padding: "16px 0", borderBottom: i === 4 ? "none" : "1px solid rgba(244,201,192,0.12)",
                  cursor: "pointer",
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 4, background: "rgba(244,201,192,0.1)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic",
                    fontSize: 18, color: "var(--blush)", fontWeight: 600,
                  }}>
                    {i + 1}
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 600, lineHeight: 1.2, letterSpacing: "-0.01em" }}>
                      {song.title}
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(244,201,192,0.6)", marginTop: 2 }}>{song.plays} plays · {song.duration}</div>
                  </div>
                  <div style={{ color: "var(--blush)", opacity: 0.6, fontSize: 14 }}>↗</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {church.styles.map(s => (
                  <span key={s} style={{
                    padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                    background: "rgba(244,201,192,0.12)", color: "var(--blush)",
                    border: "1px solid rgba(244,201,192,0.2)",
                  }}>{s}</span>
                ))}
              </div>
              <div style={{ fontSize: 13, color: "rgba(244,201,192,0.6)", marginTop: 8 }}>
                Featured artists: <span style={{ color: "var(--blush)", fontWeight: 600 }}>{church.notableArtists.slice(0, 3).join(" · ")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function V3GoodFit({ church }) {
  return (
    <section style={{ padding: "160px 56px 0" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.36em", textTransform: "uppercase", color: "var(--rose-gold)", marginBottom: 28 }}>
          Could be your church if…
        </div>
        <h2 style={{
          fontFamily: "'Cormorant Garamond', serif", fontSize: 96, lineHeight: 0.92,
          fontWeight: 600, color: "var(--espresso)", letterSpacing: "-0.03em", margin: 0,
          maxWidth: 1200, marginLeft: "auto", marginRight: "auto",
        }}>
          You're <span style={{ fontStyle: "italic", color: "var(--rose-gold)" }}>looking for</span>…
        </h2>

        <div style={{
          marginTop: 80,
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24,
        }}>
          {church.goodFitTags.map((tag, i) => {
            const variants = [
              { bg: "var(--linen-deep)", color: "var(--espresso)", accent: "var(--rose-gold)" },
              { bg: "var(--rose-gold)", color: "white", accent: "var(--blush)" },
              { bg: "var(--blush-light)", color: "var(--espresso)", accent: "var(--rose-gold)" },
              { bg: "var(--espresso)", color: "white", accent: "var(--blush)" },
              { bg: "var(--mauve-light)", color: "var(--espresso)", accent: "var(--mauve)" },
              { bg: "white", color: "var(--espresso)", accent: "var(--rose-gold)" },
            ];
            const v = variants[i % variants.length];
            return (
              <div key={tag} style={{
                background: v.bg, color: v.color, borderRadius: 16,
                padding: "48px 32px", textAlign: "left",
                aspectRatio: "5/4",
                display: "flex", flexDirection: "column", justifyContent: "space-between",
                border: v.bg === "white" ? "1px solid rgba(244,201,192,0.4)" : "none",
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: v.accent }}>
                  No. 0{i + 1}
                </div>
                <div style={{
                  fontFamily: "'Cormorant Garamond', serif", fontSize: 44, lineHeight: 1.0,
                  fontWeight: 600, letterSpacing: "-0.02em",
                }}>
                  {tag}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function V3Faq({ church }) {
  const [open, setOpen] = useStateV3(0);
  return (
    <section style={{ padding: "160px 56px 0" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 80 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.36em", textTransform: "uppercase", color: "var(--rose-gold)", marginBottom: 28 }}>
            Things you're wondering
          </div>
          <h2 style={{
            fontFamily: "'Cormorant Garamond', serif", fontSize: 96, lineHeight: 0.92,
            fontWeight: 600, color: "var(--espresso)", letterSpacing: "-0.03em", margin: 0,
          }}>
            We've been<br/>
            <span style={{ fontStyle: "italic", color: "var(--rose-gold)" }}>asked them all.</span>
          </h2>
        </div>

        <div>
          {church.faq.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={i}
                onClick={() => setOpen(isOpen ? -1 : i)}
                style={{
                  padding: "32px 0", borderBottom: "1px solid rgba(176,106,80,0.25)",
                  cursor: "pointer", display: "grid", gridTemplateColumns: "60px 1fr 60px",
                  gap: 24, alignItems: "start",
                }}>
                <div style={{
                  fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic",
                  fontSize: 28, fontWeight: 600, color: "var(--rose-gold)",
                }}>
                  /0{i + 1}
                </div>
                <div>
                  <div style={{
                    fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 600,
                    color: "var(--espresso)", lineHeight: 1.25, letterSpacing: "-0.015em",
                  }}>
                    {item.q}
                  </div>
                  <div style={{
                    overflow: "hidden", maxHeight: isOpen ? 200 : 0,
                    transition: "max-height 0.3s ease",
                  }}>
                    <p style={{ marginTop: 16, fontSize: 17, lineHeight: 1.65, color: "var(--warm-brown)", margin: "16px 0 0" }}>
                      {item.a}
                    </p>
                  </div>
                </div>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%",
                  border: "1px solid var(--rose-gold)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: isOpen ? "var(--rose-gold)" : "transparent",
                  color: isOpen ? "white" : "var(--rose-gold)",
                  fontSize: 22, fontWeight: 300, transition: "all 0.2s",
                  justifySelf: "end",
                }}>
                  {isOpen ? "−" : "+"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function V3FinalCta({ church }) {
  return (
    <section style={{
      marginTop: 160,
      position: "relative", overflow: "hidden",
      background: "#1d0f0b", color: "white", minHeight: 720,
    }}>
      <img src={church.hero.crowd} alt="" style={{
        position: "absolute", inset: 0, width: "100%", height: "100%",
        objectFit: "cover", opacity: 0.4,
      }}/>
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(135deg, rgba(29,15,11,0.85) 0%, rgba(176,106,80,0.6) 100%)",
      }}/>
      {/* arch decoration */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.15 }} aria-hidden viewBox="0 0 1400 720" preserveAspectRatio="xMidYMid slice">
        <path d="M 700 200 Q 530 200 530 400 L 530 720 L 870 720 L 870 400 Q 870 200 700 200 Z"
          fill="none" stroke="var(--blush)" strokeWidth="1" />
      </svg>

      <div style={{
        position: "relative", maxWidth: 1100, margin: "0 auto", padding: "140px 56px",
        textAlign: "center",
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.4em", textTransform: "uppercase", color: "var(--blush)", marginBottom: 32 }}>
          See you Sunday?
        </div>
        <h2 style={{
          fontFamily: "'Cormorant Garamond', serif", fontSize: 124, lineHeight: 0.92,
          fontWeight: 600, margin: 0, letterSpacing: "-0.03em",
        }}>
          We've saved<br/>
          <span style={{ fontStyle: "italic", color: "var(--blush)" }}>you a seat.</span>
        </h2>
        <p style={{
          fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic",
          fontSize: 24, color: "rgba(255,255,255,0.8)", margin: "32px 0 0",
        }}>
          The coffee's already on. There'll be someone at the door looking for you.
        </p>
        <div style={{ marginTop: 56, display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <button style={{
            background: "white", color: "var(--espresso)", border: "none",
            padding: "20px 40px", borderRadius: 999, fontSize: 15, fontWeight: 700, cursor: "pointer",
            letterSpacing: "0.02em",
          }}>
            Plan my first visit  →
          </button>
          <button style={{
            background: "transparent", color: "white",
            border: "1px solid rgba(255,255,255,0.5)",
            padding: "20px 40px", borderRadius: 999, fontSize: 15, fontWeight: 600, cursor: "pointer",
          }}>
            Watch this Sunday's service
          </button>
        </div>

        {/* contact strip */}
        <div style={{
          marginTop: 80, paddingTop: 32, borderTop: "1px solid rgba(244,201,192,0.2)",
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32, fontSize: 13,
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(244,201,192,0.6)", marginBottom: 8 }}>Address</div>
            <div style={{ color: "white", fontFamily: "'Cormorant Garamond', serif", fontSize: 17 }}>{church.streetAddress}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(244,201,192,0.6)", marginBottom: 8 }}>Phone</div>
            <div style={{ color: "white", fontFamily: "'Cormorant Garamond', serif", fontSize: 17 }}>{church.contact.phone}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(244,201,192,0.6)", marginBottom: 8 }}>Email</div>
            <div style={{ color: "white", fontFamily: "'Cormorant Garamond', serif", fontSize: 17 }}>{church.contact.email}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function VariantThree({ church }) {
  return (
    <div style={v3Styles.page}>
      <V3Hero church={church} />
      <V3Quote church={church} />
      <V3Welcome church={church} />
      <V3Sunday church={church} />
      <V3Sound church={church} />
      <V3GoodFit church={church} />
      <V3Faq church={church} />
      <V3FinalCta church={church} />
    </div>
  );
}

window.VariantThree = VariantThree;
