/* eslint-disable */
// Variant 1 — Polished Refinement (Safe)
// Approach: keep current architecture, push detail. Better hero crop with editorial
// eyebrow, layered typography, refined info grid with visual rhythm, dedicated
// "Sound" section with album-art treatment, testimonial slab, more thoughtful FAQ.

const { useState } = React;

const v1Styles = {
  page: {
    fontFamily: "'Nunito', system-ui, sans-serif",
    color: "var(--espresso)",
    background: "var(--linen)",
    backgroundImage:
      "radial-gradient(ellipse at 15% 0%, #fce9e580 0%, transparent 50%), radial-gradient(ellipse at 85% 5%, #e8dff070 0%, transparent 45%)",
    minHeight: "100%",
    paddingBottom: "120px",
  },
};

function V1Hero({ church }) {
  return (
    <section style={{ position: "relative", minHeight: 720, overflow: "hidden", background: "#1d0f0b" }}>
      {church.hero.primary && (
        <>
          <img
            src={church.hero.primary}
            alt=""
            style={{
              position: "absolute", inset: 0, width: "100%", height: "100%",
              objectFit: "cover", objectPosition: "center 30%",
            }}
          />
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to top, #1a0e09 0%, rgba(26,14,9,0.72) 35%, rgba(26,14,9,0.25) 65%, rgba(26,14,9,0.55) 100%)",
          }} />
          <div style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(ellipse at 25% 60%, rgba(176,106,80,0.22) 0%, transparent 55%)",
          }} />
        </>
      )}

      {/* nav row */}
      <nav style={{ position: "relative", zIndex: 2, padding: "32px 56px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <a style={{ color: "rgba(255,255,255,0.65)", fontSize: 14, fontWeight: 500, textDecoration: "none" }}>← Churches</a>
        <div style={{ display: "flex", gap: 12 }}>
          <button style={{ background: "rgba(255,255,255,0.1)", color: "white", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 999, padding: "8px 16px", fontSize: 13, fontWeight: 600, backdropFilter: "blur(8px)" }}>♡ Save</button>
          <button style={{ background: "rgba(255,255,255,0.1)", color: "white", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 999, padding: "8px 16px", fontSize: 13, fontWeight: 600, backdropFilter: "blur(8px)" }}>↗ Share</button>
        </div>
      </nav>

      {/* hero content */}
      <div style={{ position: "relative", zIndex: 2, padding: "0 56px 64px", marginTop: 280 }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          {/* eyebrow */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <span style={{ width: 32, height: 1, background: "rgba(244,201,192,0.7)" }} />
            <span style={{ color: "rgba(244,201,192,0.85)", fontSize: 11, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase" }}>
              {church.country} · Est. {church.founded} · {church.styles[0]}
            </span>
          </div>

          {/* name + verified */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 24, flexWrap: "wrap" }}>
            <h1 style={{
              fontFamily: "'Cormorant Garamond', serif", fontWeight: 600,
              fontSize: 96, lineHeight: 0.95, color: "white", letterSpacing: "-0.02em",
              margin: 0, textShadow: "0 2px 30px rgba(0,0,0,0.4)",
            }}>
              {church.name}
            </h1>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "rgba(96,165,250,0.18)", color: "#dbeafe",
              padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700,
              border: "1px solid rgba(96,165,250,0.25)", marginBottom: 14,
            }}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.4 12.65a3 3 0 010-5.3 3 3 0 00-3.75-3.75 3 3 0 00-5.3 0 3 3 0 00-3.75 3.75 3 3 0 000 5.3 3 3 0 003.75 3.75 3 3 0 005.3 0 3 3 0 003.75-3.75zm-2.55-4.46a.75.75 0 00-1.21-.88l-3.48 4.79-1.88-1.88a.75.75 0 10-1.06 1.06l2.5 2.5a.75.75 0 001.14-.09l4-5.5z" clipRule="evenodd"/></svg>
              Verified
            </span>
          </div>

          {/* tagline */}
          <p style={{
            fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic",
            color: "rgba(255,255,255,0.85)", fontSize: 24, lineHeight: 1.4,
            marginTop: 20, maxWidth: 680, fontWeight: 400,
          }}>
            "{church.tagline}"
          </p>

          {/* fact strip */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 0, marginTop: 36, borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 20 }}>
            {[
              ["Sundays", `${church.serviceTimes.length} services`],
              ["Where", church.city],
              ["Style", church.styles[0]],
              ["Community", church.size],
              ["Followers", "22M+"],
            ].map(([label, value], i) => (
              <div key={i} style={{
                flex: 1, minWidth: 140, paddingRight: 24,
                borderLeft: i === 0 ? "none" : "1px solid rgba(255,255,255,0.12)",
                paddingLeft: i === 0 ? 0 : 24,
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(244,201,192,0.6)" }}>{label}</div>
                <div style={{ color: "white", fontSize: 18, fontWeight: 600, marginTop: 4 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function V1Intro({ church }) {
  return (
    <section style={{ padding: "80px 56px 0", maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 64, alignItems: "start" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--mauve)", marginBottom: 16 }}>
            Welcome
          </div>
          <h2 style={{
            fontFamily: "'Cormorant Garamond', serif", fontSize: 44, lineHeight: 1.05,
            color: "var(--espresso)", margin: 0, fontWeight: 600, letterSpacing: "-0.015em",
          }}>
            There's a seat saved for you{" "}
            <span style={{ fontStyle: "italic", color: "var(--rose-gold)" }}>this Sunday</span>.
          </h2>
          <p style={{ marginTop: 24, fontSize: 18, lineHeight: 1.65, color: "var(--warm-brown)", maxWidth: 620 }}>
            {church.description}
          </p>

          <div style={{ marginTop: 32, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button style={{
              background: "var(--rose-gold)", color: "white", border: "none",
              padding: "14px 28px", borderRadius: 999, fontSize: 15, fontWeight: 700,
              cursor: "pointer", boxShadow: "0 8px 24px -8px rgba(176,106,80,0.4)",
            }}>
              Plan your first visit →
            </button>
            <button style={{
              background: "transparent", color: "var(--espresso)",
              border: "1px solid var(--rose-gold)", padding: "14px 28px",
              borderRadius: 999, fontSize: 15, fontWeight: 600, cursor: "pointer",
            }}>
              ▶ Watch online
            </button>
            <a href="#" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "14px 20px", color: "var(--warm-brown)", fontSize: 14, fontWeight: 600,
              textDecoration: "none",
            }}>
              ♡ Follow {church.name.split(" ")[0]}
            </a>
          </div>
        </div>

        {/* Quick visit card */}
        <aside style={{
          background: "white", borderRadius: 24,
          border: "1px solid rgba(244,201,192,0.4)",
          padding: 28, boxShadow: "0 1px 0 rgba(255,255,255,0.5) inset, 0 20px 40px -24px rgba(59,42,34,0.15)",
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--muted-warm)", marginBottom: 14 }}>
            Plan Your Visit
          </div>
          <div style={{ borderLeft: "3px solid var(--rose-gold)", paddingLeft: 14, marginBottom: 20 }}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 600, color: "var(--espresso)" }}>
              Next service
            </div>
            <div style={{ fontSize: 14, color: "var(--warm-brown)", marginTop: 2 }}>
              Sunday, 9:00 AM · 11:00 AM · 6:00 PM
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 14, color: "var(--espresso)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--rose-gold)" strokeWidth="1.5" style={{ marginTop: 2, flexShrink: 0 }}><path d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0115 0z"/></svg>
              <div>{church.streetAddress}</div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--rose-gold)" strokeWidth="1.5" style={{ marginTop: 2, flexShrink: 0 }}><path d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293a.75.75 0 01-.84.276 13.49 13.49 0 01-3.797-3.797.75.75 0 01.276-.84l1.293-.97c.362-.271.527-.733.417-1.173L8.05 4.71A1.125 1.125 0 006.96 3.86H5.587a2.25 2.25 0 00-2.25 2.25z"/></svg>
              <div>{church.contact.phone}</div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--rose-gold)" strokeWidth="1.5" style={{ marginTop: 2, flexShrink: 0 }}><path d="M12 21a9 9 0 100-18 9 9 0 000 18z"/><path d="M3.6 9h16.8M3.6 15h16.8M12 3a14.5 14.5 0 010 18M12 3a14.5 14.5 0 000 18"/></svg>
              <div>{church.contact.website}</div>
            </div>
          </div>
          <button style={{
            marginTop: 20, width: "100%", background: "var(--espresso)", color: "white",
            border: "none", padding: "12px", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}>
            Get directions
          </button>
        </aside>
      </div>
    </section>
  );
}

function V1Sunday({ church }) {
  const items = [
    { eyebrow: "Worship", title: "Live band, full sound", body: "Thirty minutes of contemporary worship led by the team behind Hillsong UNITED." },
    { eyebrow: "Teaching", title: "35 minutes, practical", body: "Bible-based, hopeful and applicable. Pastor Phil teaches most Sundays." },
    { eyebrow: "Kids & Youth", title: "Programs run in parallel", body: "Hillsong Kids (ages 0–12) and Youth meet during the service in their own spaces." },
    { eyebrow: "After service", title: "Free coffee, real conversation", body: "Stay for the foyer hangout. The Connect Desk has a welcome gift if it's your first time." },
  ];
  return (
    <section style={{ padding: "100px 56px 0", maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 40, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--mauve)", marginBottom: 12 }}>
            Your visit at a glance
          </div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 40, fontWeight: 600, color: "var(--espresso)", margin: 0, letterSpacing: "-0.015em" }}>
            What Sunday <span style={{ fontStyle: "italic", color: "var(--rose-gold)" }}>actually feels like</span>
          </h2>
        </div>
        <div style={{ fontSize: 13, color: "var(--muted-warm)", maxWidth: 280 }}>
          ~80 min · Casual dress · {church.parking.split(".")[0]}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: "rgba(244,201,192,0.4)", borderRadius: 24, overflow: "hidden", border: "1px solid rgba(244,201,192,0.4)" }}>
        {items.map((item, i) => (
          <div key={i} style={{ background: "rgba(255,255,255,0.92)", padding: "32px 28px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--rose-gold)", marginBottom: 14 }}>
              0{i + 1} · {item.eyebrow}
            </div>
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 600, color: "var(--espresso)", margin: 0, lineHeight: 1.2 }}>
              {item.title}
            </h3>
            <p style={{ marginTop: 12, fontSize: 14, color: "var(--warm-brown)", lineHeight: 1.55 }}>
              {item.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function V1Pastor({ church }) {
  return (
    <section style={{ padding: "100px 56px 0", maxWidth: 1280, margin: "0 auto" }}>
      <div style={{
        display: "grid", gridTemplateColumns: "320px 1fr", gap: 56, alignItems: "center",
        background: "linear-gradient(135deg, var(--linen-deep) 0%, var(--blush-light) 100%)",
        borderRadius: 32, padding: 56, border: "1px solid rgba(244,201,192,0.5)",
      }}>
        <div style={{ position: "relative" }}>
          <img src={church.pastor.photo} alt={church.pastor.name} style={{
            width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 24,
            boxShadow: "0 24px 48px -16px rgba(59,42,34,0.25)",
          }}/>
          <div style={{
            position: "absolute", bottom: -16, left: -16, background: "var(--rose-gold)",
            color: "white", padding: "10px 16px", borderRadius: 999, fontSize: 11,
            fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase",
          }}>
            Word from the team
          </div>
        </div>
        <div>
          <div style={{ fontSize: 64, lineHeight: 0.5, color: "var(--rose-gold)", fontFamily: "'Cormorant Garamond', serif", marginBottom: 12 }}>"</div>
          <p style={{
            fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic",
            fontSize: 30, lineHeight: 1.35, color: "var(--espresso)", margin: 0, fontWeight: 500,
          }}>
            {church.pastor.quote}
          </p>
          <div style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 36, height: 1, background: "var(--rose-gold)" }} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--espresso)" }}>{church.pastor.name}</div>
              <div style={{ fontSize: 13, color: "var(--muted-warm)" }}>{church.pastor.title}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function V1Sound({ church }) {
  return (
    <section style={{ padding: "100px 56px 0", maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--mauve)", marginBottom: 12 }}>
          Their worship
        </div>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 48, fontWeight: 600, color: "var(--espresso)", margin: 0, letterSpacing: "-0.015em" }}>
          The sound of <span style={{ fontStyle: "italic", color: "var(--rose-gold)" }}>{church.name}</span>
        </h2>
        <p style={{ marginTop: 12, fontSize: 16, color: "var(--warm-brown)", maxWidth: 600 }}>
          Hear what Sunday sounds like before you go.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 32 }}>
        {/* album-art player */}
        <div style={{
          background: "linear-gradient(135deg, #2a1612 0%, #4a2519 100%)",
          borderRadius: 24, padding: 32, color: "white", position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: -50, right: -50, width: 200, height: 200, background: "var(--rose-gold)", borderRadius: "50%", filter: "blur(80px)", opacity: 0.4 }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", gap: 20 }}>
              <div style={{
                width: 140, height: 140, background: "linear-gradient(135deg, var(--rose-gold) 0%, var(--mauve) 100%)",
                borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                boxShadow: "0 16px 32px -8px rgba(0,0,0,0.4)",
              }}>
                <svg width="60" height="60" viewBox="0 0 24 24" fill="white" opacity="0.95"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(244,201,192,0.7)" }}>
                  Start Here · Primary playlist
                </div>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 600, marginTop: 8, lineHeight: 1.15 }}>
                  {church.name}<br/>Worship Essentials
                </div>
                <div style={{ marginTop: 12, fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
                  6 of 142 songs · Updated weekly
                </div>
              </div>
            </div>

            {/* tracklist */}
            <div style={{ marginTop: 24, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
              {church.topSongs.slice(0, 5).map((song, i) => (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "20px 1fr auto auto",
                  gap: 16, padding: "12px 0", alignItems: "center",
                  borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 13,
                }}>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontVariantNumeric: "tabular-nums" }}>{i + 1}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{song.title}</div>
                    <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>{song.artist}</div>
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontVariantNumeric: "tabular-nums" }}>{song.plays}</div>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontVariantNumeric: "tabular-nums" }}>{song.duration}</div>
                </div>
              ))}
            </div>

            <button style={{
              marginTop: 20, width: "100%", background: "#1DB954", color: "white",
              border: "none", padding: "14px", borderRadius: 999, fontSize: 14,
              fontWeight: 700, cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: 8,
            }}>
              ▶ Tune in on Spotify
            </button>
          </div>
        </div>

        {/* sound character */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ background: "white", padding: 28, borderRadius: 20, border: "1px solid rgba(244,201,192,0.4)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--muted-warm)", marginBottom: 12 }}>Style</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {church.styles.map((s) => (
                <span key={s} style={{ background: "var(--blush-light)", color: "var(--rose-gold-deep)", padding: "8px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600 }}>
                  {s}
                </span>
              ))}
            </div>
          </div>
          <div style={{ background: "white", padding: 28, borderRadius: 20, border: "1px solid rgba(244,201,192,0.4)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--muted-warm)", marginBottom: 12 }}>Notable artists</div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
              {church.notableArtists.map((a) => (
                <li key={a} style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 600, color: "var(--espresso)", borderBottom: "1px dashed rgba(244,201,192,0.5)", paddingBottom: 8 }}>
                  {a}
                </li>
              ))}
            </ul>
          </div>
          <div style={{
            background: "linear-gradient(135deg, var(--mauve-light) 0%, var(--blush-light) 100%)",
            padding: 28, borderRadius: 20, display: "flex", alignItems: "center", gap: 20,
          }}>
            <div style={{ fontSize: 48, fontFamily: "'Cormorant Garamond', serif", color: "var(--rose-gold)", lineHeight: 1, fontWeight: 600 }}>
              22M+
            </div>
            <div style={{ fontSize: 13, color: "var(--warm-brown)", lineHeight: 1.5 }}>
              <strong style={{ color: "var(--espresso)" }}>Followers across platforms.</strong><br/>
              YouTube · Instagram · Facebook · Spotify
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function V1GoodFit({ church }) {
  return (
    <section style={{ padding: "100px 56px 0", maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 56, alignItems: "start" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--mauve)", marginBottom: 12 }}>
            Could be your church if…
          </div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 44, fontWeight: 600, color: "var(--espresso)", margin: 0, letterSpacing: "-0.015em", lineHeight: 1.05 }}>
            You'll feel at home if you're <span style={{ fontStyle: "italic", color: "var(--rose-gold)" }}>looking for…</span>
          </h2>
          <p style={{ marginTop: 20, fontSize: 16, color: "var(--warm-brown)", lineHeight: 1.6 }}>
            Every church has a personality. Here's a rough read on who tends to find a home here.
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {church.goodFitTags.map((tag, i) => (
            <span key={tag} style={{
              padding: "12px 20px", borderRadius: 999, fontSize: 15, fontWeight: 600,
              background: i % 3 === 0 ? "var(--rose-gold)" : i % 3 === 1 ? "var(--blush-light)" : "white",
              color: i % 3 === 0 ? "white" : "var(--espresso)",
              border: i % 3 === 0 ? "none" : "1px solid rgba(244,201,192,0.5)",
              boxShadow: i % 3 === 0 ? "0 8px 16px -8px rgba(176,106,80,0.4)" : "none",
            }}>
              {tag}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function V1Faq({ church }) {
  const [open, setOpen] = useState(0);
  return (
    <section style={{ padding: "100px 56px 0", maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 80, alignItems: "start" }}>
        <div style={{ position: "sticky", top: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--mauve)", marginBottom: 12 }}>
            Common questions
          </div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 40, fontWeight: 600, color: "var(--espresso)", margin: 0, letterSpacing: "-0.015em", lineHeight: 1.05 }}>
            Asked it. <span style={{ fontStyle: "italic", color: "var(--rose-gold)" }}>Answered.</span>
          </h2>
          <p style={{ marginTop: 20, fontSize: 14, color: "var(--warm-brown)", lineHeight: 1.6 }}>
            Real questions from real first-time visitors.
          </p>
          <button style={{
            marginTop: 24, background: "white", color: "var(--rose-gold)",
            border: "1px solid var(--rose-gold)", padding: "10px 20px", borderRadius: 999,
            fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>
            Ask another question →
          </button>
        </div>
        <div>
          {church.faq.map((item, i) => (
            <div key={i} onClick={() => setOpen(open === i ? -1 : i)} style={{
              padding: "24px 0", borderBottom: "1px solid rgba(244,201,192,0.4)",
              cursor: "pointer", display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 20, alignItems: "start",
            }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", color: "var(--rose-gold)", fontSize: 18, fontWeight: 600 }}>
                0{i + 1}
              </div>
              <div>
                <div style={{ fontSize: 19, fontWeight: 600, color: "var(--espresso)", lineHeight: 1.3 }}>{item.q}</div>
                {open === i && (
                  <p style={{ marginTop: 12, fontSize: 15, lineHeight: 1.65, color: "var(--warm-brown)", marginBottom: 0 }}>
                    {item.a}
                  </p>
                )}
              </div>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: open === i ? "var(--rose-gold)" : "transparent",
                border: "1px solid var(--rose-gold)", color: open === i ? "white" : "var(--rose-gold)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 300,
                transition: "all 0.2s",
              }}>
                {open === i ? "−" : "+"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function V1Testimonials({ church }) {
  return (
    <section style={{ padding: "100px 56px 0", maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--mauve)", marginBottom: 12 }}>
        From the community
      </div>
      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 40, fontWeight: 600, color: "var(--espresso)", margin: "0 0 36px", letterSpacing: "-0.015em" }}>
        What people are <span style={{ fontStyle: "italic", color: "var(--rose-gold)" }}>actually saying</span>
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 24 }}>
        {church.testimonials.map((t, i) => (
          <div key={i} style={{
            background: "white", padding: 36, borderRadius: 24,
            border: "1px solid rgba(244,201,192,0.4)",
          }}>
            <div style={{ fontSize: 60, fontFamily: "'Cormorant Garamond', serif", lineHeight: 0.5, color: "var(--rose-gold)", fontWeight: 600, marginBottom: 8 }}>"</div>
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 22, lineHeight: 1.4, color: "var(--espresso)", margin: 0 }}>
              {t.quote}
            </p>
            <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--blush-light)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "var(--rose-gold)" }}>
                {t.name[0]}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--espresso)" }}>{t.name}</div>
                <div style={{ fontSize: 12, color: "var(--muted-warm)" }}>{t.detail}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function V1FinalCta({ church }) {
  return (
    <section style={{ padding: "100px 56px 0", maxWidth: 1280, margin: "0 auto" }}>
      <div style={{
        position: "relative", overflow: "hidden", borderRadius: 32,
        background: "linear-gradient(135deg, #2a1612 0%, var(--rose-gold-deep) 100%)",
        padding: "80px 64px", color: "white",
      }}>
        <img src={church.hero.crowd} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.25 }} />
        <div style={{ position: "relative", maxWidth: 720 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", color: "rgba(244,201,192,0.7)", marginBottom: 20 }}>
            See you Sunday?
          </div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 64, fontWeight: 600, margin: 0, lineHeight: 1.05, letterSpacing: "-0.02em" }}>
            We've saved you a seat.<br/>
            <span style={{ fontStyle: "italic", color: "var(--blush)" }}>The coffee's already on.</span>
          </h2>
          <div style={{ marginTop: 32, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button style={{ background: "white", color: "var(--espresso)", border: "none", padding: "16px 32px", borderRadius: 999, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
              Plan my first visit →
            </button>
            <button style={{ background: "transparent", color: "white", border: "1px solid rgba(255,255,255,0.4)", padding: "16px 32px", borderRadius: 999, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
              Get directions
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function VariantOne({ church }) {
  return (
    <div style={v1Styles.page}>
      <V1Hero church={church} />
      <V1Intro church={church} />
      <V1Sunday church={church} />
      <V1Pastor church={church} />
      <V1Sound church={church} />
      <V1GoodFit church={church} />
      <V1Faq church={church} />
      <V1Testimonials church={church} />
      <V1FinalCta church={church} />
    </div>
  );
}

window.VariantOne = VariantOne;
