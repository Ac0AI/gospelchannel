/* eslint-disable */
// Variant 3 — Bold Mobile + Practical
// Mobile-first responsive version with: sticky bottom CTA, mobile hero
// reflow, "Plan my visit" widget high in the page, service-time picker,
// quick-action grid, breadcrumbs, claim/contact CTA in footer.

const { useState: useS3M, useEffect: useE3M } = React;

function useV3MIsMobile() {
  const [m, setM] = useS3M(false);
  useE3M(() => {
    const check = () => setM(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return m;
}

function V3MHero({ church, isMobile }) {
  return (
    <section style={{
      position: "relative",
      minHeight: isMobile ? 480 : 920,
      overflow: "hidden", background: "#120906", color: "white",
    }}>
      <img src={church.hero.primary} alt="" style={{
        position: "absolute", inset: 0, width: "100%", height: "100%",
        objectFit: "cover", objectPosition: "center 35%",
        filter: "saturate(0.85) contrast(1.05)",
      }} />
      {!isMobile && (
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} viewBox="0 0 1400 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
          <path d="M 700 200 Q 530 200 530 400 L 530 760 L 870 760 L 870 400 Q 870 200 700 200 Z" fill="none" stroke="rgba(244,201,192,0.18)" strokeWidth="1" />
          <path d="M 700 240 Q 560 240 560 420 L 560 760 L 840 760 L 840 420 Q 840 240 700 240 Z" fill="none" stroke="rgba(244,201,192,0.10)" strokeWidth="1" />
        </svg>
      )}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(18,9,6,0.55) 0%, rgba(18,9,6,0.15) 35%, rgba(18,9,6,0.6) 75%, rgba(18,9,6,0.95) 100%)" }} />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 35%, rgba(176,106,80,0.25) 0%, transparent 60%)" }} />

      {/* nav */}
      <nav style={{
        position: "relative", zIndex: 2,
        padding: isMobile ? "16px 20px" : "32px 56px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <a style={{ color: "rgba(244,201,192,0.8)", fontSize: isMobile ? 12 : 12, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", textDecoration: "none" }}>← Churches</a>
        {!isMobile && (
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.32em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>
            GospelChannel · A Pilgrim's Index
          </div>
        )}
        <div style={{ display: "flex", gap: isMobile ? 12 : 16, fontSize: isMobile ? 18 : 12, fontWeight: 700, color: "rgba(244,201,192,0.8)" }}>
          <span>♡</span>
          <span>↗</span>
        </div>
      </nav>

      {/* center title */}
      <div style={{
        position: "relative", zIndex: 2,
        padding: isMobile ? "32px 20px 100px" : "120px 56px 200px",
        textAlign: "center",
      }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: isMobile ? 10 : 16, marginBottom: isMobile ? 20 : 32, flexWrap: "wrap", justifyContent: "center" }}>
          <span style={{ width: isMobile ? 20 : 32, height: 1, background: "var(--blush)" }} />
          <span style={{ fontSize: isMobile ? 9 : 11, fontWeight: 700, letterSpacing: "0.32em", textTransform: "uppercase", color: "var(--blush)" }}>
            {isMobile ? `${church.country}` : `Volume Forty Seven · ${church.country}`}
          </span>
          <span style={{ width: isMobile ? 20 : 32, height: 1, background: "var(--blush)" }} />
        </div>

        <h1 style={{
          fontFamily: "'Cormorant Garamond', serif", fontWeight: 600,
          fontSize: isMobile ? 52 : 200, lineHeight: 0.85, color: "white",
          letterSpacing: "-0.03em", margin: 0,
          textShadow: "0 2px 60px rgba(0,0,0,0.5)",
        }}>
          {church.name.split(" ")[0]}
        </h1>
        <h1 style={{
          fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 500,
          fontSize: isMobile ? 36 : 140, lineHeight: 0.85, color: "var(--blush)",
          letterSpacing: "-0.025em", margin: isMobile ? "8px 0 0" : "12px 0 0",
        }}>
          {church.name.split(" ").slice(1).join(" ").toLowerCase()}
        </h1>

        <p style={{
          fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic",
          fontSize: isMobile ? 18 : 26, lineHeight: 1.4, color: "rgba(255,255,255,0.85)",
          marginTop: isMobile ? 28 : 56, maxWidth: 720, marginLeft: "auto", marginRight: "auto", fontWeight: 400,
        }}>
          "{church.tagline}"
        </p>

        {/* primary action — visible already in hero on mobile too */}
        <div style={{ marginTop: isMobile ? 22 : 48, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button style={{
            background: "white", color: "var(--espresso)", border: "none",
            padding: isMobile ? "14px 22px" : "16px 28px",
            borderRadius: 999, fontSize: isMobile ? 14 : 14, fontWeight: 700, cursor: "pointer",
          }}>
            Plan a visit →
          </button>
          <button style={{
            background: "rgba(255,255,255,0.12)", color: "white", border: "1px solid rgba(255,255,255,0.3)",
            padding: isMobile ? "14px 22px" : "16px 28px",
            borderRadius: 999, fontSize: isMobile ? 14 : 14, fontWeight: 600, cursor: "pointer",
            backdropFilter: "blur(10px)",
          }}>
            ▶ Watch online
          </button>
        </div>
      </div>

      {/* bottom strip */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 2,
        padding: isMobile ? "16px 20px" : "24px 56px",
        borderTop: "1px solid rgba(244,201,192,0.18)",
        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
        background: "linear-gradient(to top, rgba(18,9,6,1) 0%, rgba(18,9,6,0) 100%)",
      }}>
        {!isMobile && (
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(244,201,192,0.7)" }}>
            {church.country.toUpperCase()} · {church.city.toUpperCase()} · EST. {church.founded}
          </div>
        )}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          fontSize: isMobile ? 10 : 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "white",
          padding: isMobile ? "8px 14px" : "10px 20px",
          borderRadius: 999, background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.15)", backdropFilter: "blur(8px)",
          margin: isMobile ? "0 auto" : 0,
        }}>
          <span style={{ width: 6, height: 6, background: "#10b981", borderRadius: "50%", boxShadow: "0 0 8px #10b981" }}/>
          Service Sunday 11:00
        </div>
        {!isMobile && (
          <div style={{ fontSize: 12, color: "rgba(244,201,192,0.5)", letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 600 }}>
            ↓ Scroll to enter
          </div>
        )}
      </div>
    </section>
  );
}

// Practical "Plan your visit" panel — high in the page so visitors see it immediately
function V3MPlanCard({ church, isMobile }) {
  const [picked, setPicked] = useS3M(0);
  return (
    <section style={{ padding: isMobile ? "24px 16px" : "80px 56px 0" }}>
      <div style={{
        maxWidth: 1100, margin: "0 auto",
        background: "white", borderRadius: isMobile ? 16 : 24,
        border: "1px solid rgba(244,201,192,0.5)",
        boxShadow: "0 24px 60px -32px rgba(59,42,34,0.25)",
        padding: isMobile ? 20 : 40,
        marginTop: isMobile ? -32 : -80, position: "relative", zIndex: 3,
      }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1.2fr", gap: isMobile ? 20 : 40, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: "var(--rose-gold)", marginBottom: 12 }}>
              Plan your first visit
            </div>
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: isMobile ? 32 : 40, fontWeight: 600, color: "var(--espresso)", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.05 }}>
              Pick a service.<br/>
              <span style={{ fontStyle: "italic", color: "var(--rose-gold)" }}>We'll save you a seat.</span>
            </h3>
            <p style={{ marginTop: 14, fontSize: 14, lineHeight: 1.6, color: "var(--warm-brown)", margin: "14px 0 0" }}>
              Tell us you're coming and someone will be at the door looking for you. No pressure — just a friendly face.
            </p>
          </div>

          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--muted-warm)", marginBottom: 10 }}>
              Choose a service
            </div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${church.serviceTimes.length}, 1fr)`, gap: 8, marginBottom: 16 }}>
              {church.serviceTimes.map((t, i) => (
                <button key={i} onClick={() => setPicked(i)} style={{
                  padding: isMobile ? "12px 8px" : "14px 12px",
                  borderRadius: 12,
                  background: picked === i ? "var(--espresso)" : "var(--linen-deep)",
                  color: picked === i ? "white" : "var(--espresso)",
                  border: "none", cursor: "pointer", textAlign: "center",
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.7 }}>{t.day}</div>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 600, marginTop: 4 }}>{t.time}</div>
                </button>
              ))}
            </div>
            <button style={{
              width: "100%", background: "var(--rose-gold)", color: "white", border: "none",
              padding: "16px", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer",
              boxShadow: "0 12px 28px -10px rgba(176,106,80,0.5)",
            }}>
              Save my seat for {church.serviceTimes[picked].day} {church.serviceTimes[picked].time} →
            </button>
            <div style={{ marginTop: 12, display: "flex", gap: 8, fontSize: 12, color: "var(--muted-warm)", justifyContent: "center", flexWrap: "wrap" }}>
              <span>✓ No login</span>
              <span>·</span>
              <span>✓ No spam</span>
              <span>·</span>
              <span>✓ 30 sec</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Quick-action grid — practical row of common actions
function V3MQuickActions({ church, isMobile }) {
  const items = [
    { icon: "📍", label: "Directions", sub: "Open in maps" },
    { icon: "▶", label: "Watch live", sub: "Sundays 11 AM" },
    { icon: "✉", label: "Contact", sub: "We reply same-day" },
    { icon: "♡", label: "Follow", sub: "Get updates" },
  ];
  return (
    <section style={{ padding: isMobile ? "20px 16px 0" : "40px 56px 0" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
          gap: isMobile ? 8 : 12,
        }}>
          {items.map((it, i) => (
            <button key={i} style={{
              padding: isMobile ? "16px 12px" : "20px 16px",
              borderRadius: 12,
              background: "var(--linen-deep)", border: "1px solid rgba(244,201,192,0.4)",
              cursor: "pointer", textAlign: "left",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, background: "white",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
                flexShrink: 0,
              }}>{it.icon}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--espresso)" }}>{it.label}</div>
                <div style={{ fontSize: 11, color: "var(--muted-warm)" }}>{it.sub}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function V3MQuote({ church, isMobile }) {
  return (
    <section style={{
      background: "linear-gradient(180deg, #1d0f0b 0%, #2a1612 100%)", color: "white",
      padding: isMobile ? "56px 20px" : "180px 56px",
      marginTop: isMobile ? 24 : 80,
    }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: isMobile ? 9 : 11, fontWeight: 700, letterSpacing: "0.36em", textTransform: "uppercase", color: "var(--blush)", marginBottom: isMobile ? 28 : 48 }}>
          A Word from the Team
        </div>
        <p style={{
          fontFamily: "'Cormorant Garamond', serif", fontWeight: 500, fontStyle: "italic",
          fontSize: isMobile ? 28 : 64, lineHeight: 1.2, color: "white", letterSpacing: "-0.015em", margin: 0,
        }}>
          "{church.pastor.quote}"
        </p>
        <div style={{ marginTop: isMobile ? 36 : 64, display: "inline-flex", alignItems: "center", gap: 16 }}>
          <img src={church.pastor.photo} alt="" style={{ width: isMobile ? 56 : 72, height: isMobile ? 56 : 72, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--blush)" }} />
          <div style={{ textAlign: "left" }}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: isMobile ? 20 : 26, fontWeight: 600, color: "white" }}>{church.pastor.name}</div>
            <div style={{ fontSize: isMobile ? 10 : 12, color: "var(--blush)", letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 700, marginTop: 4 }}>
              {church.pastor.title}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function V3MWelcome({ church, isMobile }) {
  return (
    <section style={{ padding: isMobile ? "40px 16px 0" : "160px 56px 0" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: isMobile ? 24 : 80 }}>
          <div style={{ fontSize: isMobile ? 9 : 11, fontWeight: 700, letterSpacing: "0.32em", textTransform: "uppercase", color: "var(--rose-gold)", marginBottom: isMobile ? 16 : 24 }}>
            About this place
          </div>
          <h2 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: isMobile ? 40 : 88, lineHeight: 0.95,
            fontWeight: 600, color: "var(--espresso)", letterSpacing: "-0.025em", margin: 0,
            maxWidth: 1100, marginLeft: "auto", marginRight: "auto",
          }}>
            More than a building.<br/>
            <span style={{ fontStyle: "italic", color: "var(--rose-gold)" }}>A people, on Sundays.</span>
          </h2>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1.5fr 1fr",
          gap: isMobile ? 8 : 16, marginBottom: isMobile ? 24 : 80,
        }}>
          {!isMobile && (
            <div style={{ aspectRatio: "3/4", borderRadius: 8, overflow: "hidden", marginTop: 60 }}>
              <img src={church.hero.crowd} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
            </div>
          )}
          <div style={{ aspectRatio: isMobile ? "16/10" : "16/11", borderRadius: 8, overflow: "hidden" }}>
            <img src={church.hero.primary} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
          </div>
          {!isMobile && (
            <div style={{ aspectRatio: "3/4", borderRadius: 8, overflow: "hidden", marginTop: 100 }}>
              <img src={church.hero.interior} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
            </div>
          )}

        </div>

        <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center", padding: isMobile ? "0 4px" : 0 }}>
          <p style={{
            fontSize: isMobile ? 17 : 22, lineHeight: 1.6, color: "var(--warm-brown)", margin: 0,
            fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 400,
          }}>
            {church.description}
          </p>
        </div>
      </div>
    </section>
  );
}

function V3MSunday({ church, isMobile }) {
  return (
    <section style={{ padding: isMobile ? "40px 16px 0" : "160px 56px 0" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 28 : 80, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: isMobile ? 9 : 11, fontWeight: 700, letterSpacing: "0.32em", textTransform: "uppercase", color: "var(--rose-gold)", marginBottom: isMobile ? 14 : 24 }}>
              Your first Sunday
            </div>
            <h2 style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: isMobile ? 36 : 80, lineHeight: 0.95,
              fontWeight: 600, color: "var(--espresso)", letterSpacing: "-0.025em", margin: 0,
            }}>
              You'll know<br/>
              <span style={{ fontStyle: "italic", color: "var(--rose-gold)" }}>what to expect</span><br/>
              before you arrive.
            </h2>

            <div style={{ marginTop: isMobile ? 24 : 48, display: "flex", flexDirection: "column" }}>
              {[
                ["Doors open", "10:30"],
                ["Worship begins", "11:00"],
                ["Teaching", "11:35"],
                ["Coffee in the foyer", "12:20"],
              ].map(([k, v], i) => (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "1fr auto",
                  alignItems: "baseline", gap: 16,
                  padding: isMobile ? "14px 0" : "20px 0",
                  borderTop: "1px solid rgba(176,106,80,0.25)",
                }}>
                  <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: isMobile ? 19 : 26, fontWeight: 500, color: "var(--espresso)", letterSpacing: "-0.01em" }}>
                    {k}
                  </span>
                  <span style={{
                    fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic",
                    fontSize: isMobile ? 24 : 32, fontWeight: 600, color: "var(--rose-gold)", fontVariantNumeric: "tabular-nums",
                  }}>
                    {v}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{
              position: "relative", aspectRatio: isMobile ? "4/3" : "4/5",
              borderRadius: 12, overflow: "hidden",
              boxShadow: "0 24px 60px -24px rgba(59,42,34,0.4)",
            }}>
              <img src={church.hero.interior} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                padding: isMobile ? 20 : 32, color: "white",
                background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)",
              }}>
                <div style={{ fontSize: isMobile ? 9 : 11, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: "var(--blush)", marginBottom: isMobile ? 8 : 12 }}>
                  What to expect
                </div>
                <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: isMobile ? 16 : 22, lineHeight: 1.4, fontWeight: 500, margin: 0, fontStyle: "italic" }}>
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

function V3MSound({ church, isMobile }) {
  return (
    <section style={{
      marginTop: isMobile ? 40 : 160,
      background: "radial-gradient(ellipse at 30% 20%, #4a2519 0%, #1d0f0b 70%)",
      color: "white",
      padding: isMobile ? "48px 16px" : "140px 56px",
      overflow: "hidden", position: "relative",
    }}>
      {!isMobile && (
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.06 }} aria-hidden viewBox="0 0 1400 800" preserveAspectRatio="xMidYMid slice">
          <g stroke="var(--blush)" strokeWidth="1" fill="none">
            <path d="M 200 800 L 200 300 Q 200 100 350 100 Q 500 100 500 300 L 500 800" />
            <path d="M 600 800 L 600 250 Q 600 50 750 50 Q 900 50 900 250 L 900 800" />
            <path d="M 1000 800 L 1000 300 Q 1000 100 1150 100 Q 1300 100 1300 300 L 1300 800" />
          </g>
        </svg>
      )}

      <div style={{ maxWidth: 1400, margin: "0 auto", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: isMobile ? 24 : 48, flexWrap: "wrap" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "8px 14px", background: "rgba(29,185,84,0.15)", border: "1px solid rgba(29,185,84,0.4)",
            borderRadius: 999, fontSize: isMobile ? 9 : 11, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase",
            color: "#1ed760",
          }}>
            <span style={{ width: 6, height: 6, background: "#1ed760", borderRadius: "50%", boxShadow: "0 0 8px #1ed760", animation: "pulse 2s infinite" }}/>
            Now playing
          </div>
          <span style={{ fontSize: isMobile ? 9 : 11, color: "rgba(244,201,192,0.5)", letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 700 }}>
            The {church.name.split(" ")[0]} Sound
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr", gap: isMobile ? 32 : 80, alignItems: "center" }}>
          <div style={{ position: "relative", maxWidth: isMobile ? 340 : "none", margin: isMobile ? "0 auto" : 0 }}>
            <div style={{
              aspectRatio: "1", borderRadius: 16,
              background: "linear-gradient(135deg, var(--rose-gold) 0%, var(--mauve) 50%, #4a2519 100%)",
              display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
              boxShadow: "0 40px 80px -20px rgba(0,0,0,0.6), 0 0 100px -20px rgba(176,106,80,0.4)",
              position: "relative", overflow: "hidden",
            }}>
              <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.15 }} viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">
                <g fill="none" stroke="white" strokeWidth="1">
                  <circle cx="200" cy="200" r="80"/>
                  <circle cx="200" cy="200" r="120"/>
                  <circle cx="200" cy="200" r="160"/>
                  <path d="M 200 80 L 200 320 M 80 200 L 320 200"/>
                </g>
              </svg>
              <div style={{ position: "relative", textAlign: "center", padding: isMobile ? 24 : 40, color: "white" }}>
                <svg width={isMobile ? 44 : 60} height={isMobile ? 44 : 60} viewBox="0 0 24 24" fill="white" opacity="0.95" style={{ marginBottom: isMobile ? 14 : 20 }}><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                <div style={{ fontSize: isMobile ? 9 : 11, fontWeight: 700, letterSpacing: "0.32em", textTransform: "uppercase", opacity: 0.8 }}>
                  Worship Essentials
                </div>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: isMobile ? 26 : 56, fontWeight: 600, lineHeight: 0.95, marginTop: isMobile ? 10 : 16, letterSpacing: "-0.02em" }}>
                  The {church.name.split(" ")[0]} Sound
                </div>
                <div style={{ marginTop: 10, fontSize: isMobile ? 10 : 13, opacity: 0.75, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600 }}>
                  142 songs · 8h 47m
                </div>
              </div>
            </div>
            <button style={{
              position: "absolute",
              right: isMobile ? -10 : -28, bottom: isMobile ? 20 : 48,
              width: isMobile ? 64 : 96, height: isMobile ? 64 : 96, borderRadius: "50%",
              background: "#1DB954", color: "white", border: "none",
              fontSize: isMobile ? 24 : 36, cursor: "pointer",
              boxShadow: "0 16px 40px -8px rgba(29,185,84,0.5)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              ▶
            </button>
          </div>

          <div>
            <div style={{ fontSize: isMobile ? 9 : 11, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: "var(--blush)", marginBottom: 16 }}>
              Most-played anthems
            </div>
            <div>
              {church.topSongs.slice(0, isMobile ? 4 : 5).map((song, i) => (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 16, alignItems: "center",
                  padding: isMobile ? "12px 0" : "16px 0",
                  borderBottom: i === (isMobile ? 3 : 4) ? "none" : "1px solid rgba(244,201,192,0.12)",
                  cursor: "pointer",
                }}>
                  <div style={{
                    width: isMobile ? 32 : 40, height: isMobile ? 32 : 40, borderRadius: 4, background: "rgba(244,201,192,0.1)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic",
                    fontSize: isMobile ? 14 : 18, color: "var(--blush)", fontWeight: 600,
                  }}>{i + 1}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: isMobile ? 17 : 22, fontWeight: 600, lineHeight: 1.2, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {song.title}
                    </div>
                    <div style={{ fontSize: isMobile ? 11 : 12, color: "rgba(244,201,192,0.6)", marginTop: 2 }}>{song.plays} · {song.duration}</div>
                  </div>
                  <div style={{ color: "var(--blush)", opacity: 0.6, fontSize: 14 }}>↗</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 20, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {church.styles.map(s => (
                <span key={s} style={{
                  padding: "6px 12px", borderRadius: 999, fontSize: isMobile ? 11 : 12, fontWeight: 600,
                  background: "rgba(244,201,192,0.12)", color: "var(--blush)",
                  border: "1px solid rgba(244,201,192,0.2)",
                }}>{s}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function V3MGoodFit({ church, isMobile }) {
  return (
    <section style={{ padding: isMobile ? "40px 16px 0" : "160px 56px 0" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: isMobile ? 9 : 11, fontWeight: 700, letterSpacing: "0.32em", textTransform: "uppercase", color: "var(--rose-gold)", marginBottom: isMobile ? 16 : 28 }}>
          Could be your church if…
        </div>
        <h2 style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: isMobile ? 44 : 96, lineHeight: 0.92,
          fontWeight: 600, color: "var(--espresso)", letterSpacing: "-0.03em", margin: 0,
          maxWidth: 1200, marginLeft: "auto", marginRight: "auto",
        }}>
          You're <span style={{ fontStyle: "italic", color: "var(--rose-gold)" }}>looking for</span>…
        </h2>

        <div style={{
          marginTop: isMobile ? 32 : 80,
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)",
          gap: isMobile ? 10 : 24,
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
                background: v.bg, color: v.color, borderRadius: isMobile ? 12 : 16,
                padding: isMobile ? "20px 16px" : "48px 32px",
                textAlign: "left",
                aspectRatio: isMobile ? "1" : "5/4",
                display: "flex", flexDirection: "column", justifyContent: "space-between",
                border: v.bg === "white" ? "1px solid rgba(244,201,192,0.4)" : "none",
              }}>
                <div style={{ fontSize: isMobile ? 9 : 11, fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", color: v.accent }}>
                  No. 0{i + 1}
                </div>
                <div style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: isMobile ? 22 : 44, lineHeight: 1.0,
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

function V3MFaq({ church, isMobile }) {
  const [open, setOpen] = useS3M(0);
  return (
    <section style={{ padding: isMobile ? "40px 16px 0" : "160px 56px 0" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: isMobile ? 32 : 80 }}>
          <div style={{ fontSize: isMobile ? 9 : 11, fontWeight: 700, letterSpacing: "0.32em", textTransform: "uppercase", color: "var(--rose-gold)", marginBottom: isMobile ? 14 : 28 }}>
            Things you're wondering
          </div>
          <h2 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: isMobile ? 44 : 96, lineHeight: 0.92,
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
                  padding: isMobile ? "20px 0" : "32px 0", borderBottom: "1px solid rgba(176,106,80,0.25)",
                  cursor: "pointer",
                  display: "grid",
                  gridTemplateColumns: isMobile ? "auto 1fr 32px" : "60px 1fr 60px",
                  gap: isMobile ? 12 : 24, alignItems: "start",
                }}>
                <div style={{
                  fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic",
                  fontSize: isMobile ? 16 : 28, fontWeight: 600, color: "var(--rose-gold)",
                }}>
                  /0{i + 1}
                </div>
                <div>
                  <div style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: isMobile ? 19 : 32, fontWeight: 600,
                    color: "var(--espresso)", lineHeight: 1.25, letterSpacing: "-0.015em",
                  }}>
                    {item.q}
                  </div>
                  <div style={{ overflow: "hidden", maxHeight: isOpen ? 400 : 0, transition: "max-height 0.3s ease" }}>
                    <p style={{ marginTop: 12, fontSize: isMobile ? 14 : 17, lineHeight: 1.65, color: "var(--warm-brown)", margin: "12px 0 0" }}>
                      {item.a}
                    </p>
                  </div>
                </div>
                <div style={{
                  width: isMobile ? 32 : 44, height: isMobile ? 32 : 44, borderRadius: "50%",
                  border: "1px solid var(--rose-gold)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: isOpen ? "var(--rose-gold)" : "transparent",
                  color: isOpen ? "white" : "var(--rose-gold)",
                  fontSize: isMobile ? 18 : 22, fontWeight: 300, transition: "all 0.2s",
                  justifySelf: "end", flexShrink: 0,
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

function V3MFinalCta({ church, isMobile }) {
  return (
    <section style={{
      marginTop: isMobile ? 40 : 160,
      position: "relative", overflow: "hidden",
      background: "#1d0f0b", color: "white",
      minHeight: isMobile ? 460 : 720,
    }}>
      <img src={church.hero.crowd} alt="" style={{
        position: "absolute", inset: 0, width: "100%", height: "100%",
        objectFit: "cover", opacity: 0.4,
      }}/>
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(135deg, rgba(29,15,11,0.85) 0%, rgba(176,106,80,0.6) 100%)",
      }}/>
      {!isMobile && (
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.15 }} aria-hidden viewBox="0 0 1400 720" preserveAspectRatio="xMidYMid slice">
          <path d="M 700 200 Q 530 200 530 400 L 530 720 L 870 720 L 870 400 Q 870 200 700 200 Z" fill="none" stroke="var(--blush)" strokeWidth="1" />
        </svg>
      )}

      <div style={{
        position: "relative", maxWidth: 1100, margin: "0 auto",
        padding: isMobile ? "80px 20px" : "140px 56px",
        textAlign: "center",
      }}>
        <div style={{ fontSize: isMobile ? 9 : 11, fontWeight: 700, letterSpacing: "0.36em", textTransform: "uppercase", color: "var(--blush)", marginBottom: isMobile ? 20 : 32 }}>
          See you Sunday?
        </div>
        <h2 style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: isMobile ? 56 : 124, lineHeight: 0.92,
          fontWeight: 600, margin: 0, letterSpacing: "-0.03em",
        }}>
          We've saved<br/>
          <span style={{ fontStyle: "italic", color: "var(--blush)" }}>you a seat.</span>
        </h2>
        <p style={{
          fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic",
          fontSize: isMobile ? 17 : 24, color: "rgba(255,255,255,0.8)", margin: isMobile ? "20px 0 0" : "32px 0 0",
        }}>
          The coffee's already on. There'll be someone at the door looking for you.
        </p>
        <div style={{ marginTop: isMobile ? 32 : 56, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button style={{
            background: "white", color: "var(--espresso)", border: "none",
            padding: isMobile ? "14px 28px" : "20px 40px",
            borderRadius: 999, fontSize: isMobile ? 14 : 15, fontWeight: 700, cursor: "pointer",
          }}>
            Plan my first visit  →
          </button>
          {!isMobile && (
            <button style={{
              background: "transparent", color: "white",
              border: "1px solid rgba(255,255,255,0.5)",
              padding: "20px 40px", borderRadius: 999, fontSize: 15, fontWeight: 600, cursor: "pointer",
            }}>
              Watch this Sunday's service
            </button>
          )}
        </div>

        <div style={{
          marginTop: isMobile ? 40 : 80,
          paddingTop: isMobile ? 24 : 32,
          borderTop: "1px solid rgba(244,201,192,0.2)",
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
          gap: isMobile ? 16 : 32, fontSize: 13, textAlign: isMobile ? "center" : "left",
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(244,201,192,0.6)", marginBottom: 6 }}>Address</div>
            <div style={{ color: "white", fontFamily: "'Cormorant Garamond', serif", fontSize: isMobile ? 15 : 17 }}>{church.streetAddress}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(244,201,192,0.6)", marginBottom: 6 }}>Phone</div>
            <div style={{ color: "white", fontFamily: "'Cormorant Garamond', serif", fontSize: isMobile ? 15 : 17 }}>{church.contact.phone}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(244,201,192,0.6)", marginBottom: 6 }}>Email</div>
            <div style={{ color: "white", fontFamily: "'Cormorant Garamond', serif", fontSize: isMobile ? 15 : 17 }}>{church.contact.email}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Sticky bottom action bar (mobile-only) — practical conversion driver
function V3MStickyBar({ church, isMobile }) {
  if (!isMobile) return null;
  return (
    <div style={{
      position: "sticky", bottom: 0, left: 0, right: 0, zIndex: 50,
      background: "rgba(255,255,255,0.96)", backdropFilter: "blur(12px)",
      borderTop: "1px solid rgba(244,201,192,0.5)",
      padding: "12px 16px",
      boxShadow: "0 -8px 24px -8px rgba(59,42,34,0.15)",
      display: "grid", gridTemplateColumns: "auto 1fr", gap: 12, alignItems: "center",
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--muted-warm)" }}>
          Next service
        </div>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, fontWeight: 600, color: "var(--espresso)", letterSpacing: "-0.01em" }}>
          Sun 11:00 — {church.city}
        </div>
      </div>
      <button style={{
        background: "var(--rose-gold)", color: "white", border: "none",
        padding: "12px 18px", borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: "pointer",
        boxShadow: "0 8px 20px -6px rgba(176,106,80,0.5)",
      }}>
        Save my seat →
      </button>
    </div>
  );
}

function VariantThreeMobile({ church }) {
  const isMobile = useV3MIsMobile();
  return (
    <div style={{
      fontFamily: "'Nunito', system-ui, sans-serif",
      color: "var(--espresso)", background: "var(--linen)", minHeight: "100%",
    }}>
      <V3MHero church={church} isMobile={isMobile} />
      <V3MPlanCard church={church} isMobile={isMobile} />
      <V3MQuickActions church={church} isMobile={isMobile} />
      <V3MQuote church={church} isMobile={isMobile} />
      <V3MWelcome church={church} isMobile={isMobile} />
      <V3MSunday church={church} isMobile={isMobile} />
      <V3MSound church={church} isMobile={isMobile} />
      <V3MGoodFit church={church} isMobile={isMobile} />
      <V3MFaq church={church} isMobile={isMobile} />
      <V3MFinalCta church={church} isMobile={isMobile} />
      <V3MStickyBar church={church} isMobile={isMobile} />
    </div>
  );
}

window.VariantThreeMobile = VariantThreeMobile;
