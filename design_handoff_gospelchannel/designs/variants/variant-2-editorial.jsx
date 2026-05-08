/* eslint-disable */
// Variant 2 — Editorial Push
// Approach: magazine/editorial layout. Asymmetric grid hero with split image,
// stacked typographic emphasis, "issue-style" running header, drop caps,
// pull-quotes, tabular detail blocks. Pushes the visual vocabulary while
// staying within the warm rose-gold/cream palette.

const { useState: useStateV2 } = React;

const v2Styles = {
  page: {
    fontFamily: "'Nunito', system-ui, sans-serif",
    color: "var(--espresso)",
    background: "var(--linen)",
    minHeight: "100%",
    paddingBottom: "120px",
  },
};

function V2RunningHeader({ church }) {
  return (
    <div style={{
      borderBottom: "1px solid rgba(59,42,34,0.15)",
      padding: "20px 56px", display: "flex", justifyContent: "space-between", alignItems: "center",
      fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--espresso)",
      background: "var(--linen)",
    }}>
      <div style={{ display: "flex", gap: 32 }}>
        <span>← Churches</span>
        <span style={{ color: "var(--muted-warm)" }}>Vol. 14 · {church.country}</span>
      </div>
      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 600, letterSpacing: "0.01em", textTransform: "none" }}>
        gospel<span style={{ color: "var(--rose-gold)", fontStyle: "italic" }}>channel</span>
      </div>
      <div style={{ display: "flex", gap: 24 }}>
        <span>♡ Save</span>
        <span>↗ Share</span>
      </div>
    </div>
  );
}

function V2Hero({ church }) {
  return (
    <section style={{ padding: "60px 56px 0" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        {/* eyebrow */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
          <span style={{ width: 48, height: 1, background: "var(--rose-gold)" }} />
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.32em", textTransform: "uppercase", color: "var(--rose-gold)" }}>
            Profile · Issue No. 047
          </span>
          <span style={{ flex: 1, height: 1, background: "rgba(59,42,34,0.1)" }} />
          <span style={{ fontSize: 12, color: "var(--muted-warm)" }}>05 / 06</span>
        </div>

        {/* split title */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 40, alignItems: "end", marginBottom: 24 }}>
          <div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 14, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--mauve)", marginBottom: 16 }}>
              The Sunday Profile
            </div>
            <h1 style={{
              fontFamily: "'Cormorant Garamond', serif", fontWeight: 600,
              fontSize: 124, lineHeight: 0.92, color: "var(--espresso)",
              letterSpacing: "-0.025em", margin: 0,
            }}>
              {church.name.split(" ")[0]}<br/>
              <span style={{ fontStyle: "italic", color: "var(--rose-gold)" }}>{church.name.split(" ").slice(1).join(" ")}</span>
            </h1>
          </div>
          <div style={{ paddingBottom: 12 }}>
            <p style={{
              fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic",
              fontSize: 22, lineHeight: 1.4, color: "var(--warm-brown)", margin: 0,
            }}>
              "{church.tagline}"
            </p>
            <div style={{ marginTop: 16, fontSize: 12, color: "var(--muted-warm)", letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600 }}>
              {church.streetAddress.split(",").pop().trim()} · Est. {church.founded}
            </div>
          </div>
        </div>

        {/* image strip */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, marginTop: 32 }}>
          <div style={{ position: "relative", aspectRatio: "16/10", borderRadius: 4, overflow: "hidden" }}>
            <img src={church.hero.primary} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <div style={{ position: "absolute", bottom: 16, left: 16, right: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <span style={{ background: "var(--linen)", color: "var(--espresso)", padding: "6px 12px", fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase" }}>
                Sunday morning
              </span>
              <span style={{ color: "white", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600, textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>
                Fig. 01
              </span>
            </div>
          </div>
          <div style={{ position: "relative", aspectRatio: "4/5", borderRadius: 4, overflow: "hidden" }}>
            <img src={church.hero.crowd} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <span style={{ position: "absolute", bottom: 12, left: 12, color: "white", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600, textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>
              Fig. 02
            </span>
          </div>
          <div style={{ position: "relative", aspectRatio: "4/5", borderRadius: 4, overflow: "hidden" }}>
            <img src={church.hero.interior} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <span style={{ position: "absolute", bottom: 12, left: 12, color: "white", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600, textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>
              Fig. 03
            </span>
          </div>
        </div>

        {/* fact tabular bar */}
        <div style={{
          marginTop: 32, padding: "24px 0", borderTop: "2px solid var(--espresso)", borderBottom: "1px solid rgba(59,42,34,0.15)",
          display: "grid", gridTemplateColumns: "repeat(6, 1fr)",
        }}>
          {[
            ["Founded", church.founded],
            ["Tradition", church.denomination],
            ["Size", church.size],
            ["Services", `${church.serviceTimes.length}/Sun`],
            ["Languages", church.languages[0]],
            ["Reach", "22M"],
          ].map(([label, value], i) => (
            <div key={i} style={{ borderLeft: i === 0 ? "none" : "1px solid rgba(59,42,34,0.15)", paddingLeft: i === 0 ? 0 : 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--muted-warm)" }}>{label}</div>
              <div style={{ marginTop: 6, fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 600, color: "var(--espresso)" }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function V2Story({ church }) {
  const description = church.description;
  const firstChar = description[0];
  const rest = description.slice(1);
  return (
    <section style={{ padding: "120px 56px 0" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr 1fr", gap: 56 }}>
          {/* margin notes */}
          <aside>
            <div style={{ position: "sticky", top: 32 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: "var(--rose-gold)", marginBottom: 24 }}>
                §1 — Welcome
              </div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 18, color: "var(--warm-brown)", lineHeight: 1.5, paddingRight: 20 }}>
                If first impressions are the longest, this is what {church.name.split(" ")[0]} hopes you remember:
              </div>
              <div style={{ marginTop: 24, paddingLeft: 16, borderLeft: "2px solid var(--rose-gold)" }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--muted-warm)" }}>Reading time</div>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 600, color: "var(--espresso)", marginTop: 4 }}>4 min</div>
              </div>
            </div>
          </aside>

          {/* main column */}
          <div>
            <h2 style={{
              fontFamily: "'Cormorant Garamond', serif", fontSize: 64, lineHeight: 1.0,
              fontWeight: 600, color: "var(--espresso)", letterSpacing: "-0.02em", margin: "0 0 32px",
            }}>
              The most-shared <span style={{ fontStyle: "italic", color: "var(--rose-gold)" }}>worship songs</span> of the past decade come from this room.
            </h2>
            <p style={{ fontSize: 19, lineHeight: 1.7, color: "var(--espresso)", margin: 0 }}>
              <span style={{
                fontFamily: "'Cormorant Garamond', serif", float: "left", fontSize: 96, lineHeight: 0.85,
                fontWeight: 700, color: "var(--rose-gold)", marginRight: 12, marginTop: 8, marginBottom: -6,
              }}>{firstChar}</span>
              {rest}
            </p>

            {/* pull quote */}
            <blockquote style={{
              margin: "48px 0", padding: "32px 0",
              borderTop: "1px solid rgba(59,42,34,0.15)", borderBottom: "1px solid rgba(59,42,34,0.15)",
            }}>
              <p style={{
                fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 36, lineHeight: 1.25,
                color: "var(--espresso)", margin: 0, fontWeight: 500, letterSpacing: "-0.01em",
              }}>
                "{church.pastor.quote}"
              </p>
              <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 14 }}>
                <img src={church.pastor.photo} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--espresso)" }}>
                  {church.pastor.name} <span style={{ color: "var(--muted-warm)", fontWeight: 400 }}>· {church.pastor.title}</span>
                </div>
              </div>
            </blockquote>

            <p style={{ fontSize: 17, lineHeight: 1.7, color: "var(--warm-brown)", margin: 0 }}>
              Most of what people associate with the {church.name.split(" ")[0]} sound — the anthemic builds, the hands-up moments, the one-line choruses you can sing in any language — was written here. But the church itself is more than a stage.
            </p>
          </div>

          {/* details */}
          <aside>
            <div style={{ position: "sticky", top: 32 }}>
              <div style={{ background: "var(--linen-deep)", padding: 28, borderRadius: 4 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--muted-warm)", marginBottom: 16 }}>By the numbers</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  {[
                    ["Active members", "30,000+"],
                    ["Sundays since 1983", "2,232"],
                    ["Songs published", "847"],
                    ["Languages translated", "60+"],
                    ["Countries reached", "150+"],
                  ].map(([k, v], i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px dotted rgba(59,42,34,0.2)", paddingBottom: 12 }}>
                      <div style={{ fontSize: 13, color: "var(--warm-brown)" }}>{k}</div>
                      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 600, color: "var(--espresso)" }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function V2Sunday({ church }) {
  const items = [
    { time: "10:55", label: "Foyer opens", body: "Coffee, welcome team at the door, parking still easy." },
    { time: "11:00", label: "Worship begins", body: "Live band — usually 4–5 songs, ~30 minutes. Stand or sit, whatever's natural." },
    { time: "11:30", label: "Welcome & announcements", body: "About 5 minutes. If you're new, this is when the welcome gift gets mentioned." },
    { time: "11:35", label: "Teaching", body: "35 minutes from Pastor Phil or a guest. Bible-based, hopeful, applicable." },
    { time: "12:10", label: "Response & blessing", body: "One closing song, prayer, you're free to go." },
    { time: "12:20", label: "After service", body: "Stay for coffee, find a small group, or head to the Connect Desk." },
  ];

  return (
    <section style={{ padding: "120px 56px 0", background: "var(--linen-deep)", marginTop: 120 }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", paddingTop: 80, paddingBottom: 80 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 72, alignItems: "start" }}>
          <div style={{ position: "sticky", top: 32 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: "var(--rose-gold)", marginBottom: 20 }}>
              §2 — Order of service
            </div>
            <h2 style={{
              fontFamily: "'Cormorant Garamond', serif", fontSize: 56, lineHeight: 1.0,
              fontWeight: 600, color: "var(--espresso)", letterSpacing: "-0.02em", margin: 0,
            }}>
              A Sunday,<br/>
              <span style={{ fontStyle: "italic", color: "var(--rose-gold)" }}>minute by minute</span>
            </h2>
            <p style={{ marginTop: 24, fontSize: 16, lineHeight: 1.6, color: "var(--warm-brown)", maxWidth: 360 }}>
              No surprises. Here's exactly what happens between you walking in and walking out — including the awkward bits.
            </p>
            <div style={{ marginTop: 32, padding: "20px 24px", background: "white", borderRadius: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--muted-warm)", marginBottom: 6 }}>Total length</div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 600, color: "var(--espresso)" }}>
                ~80 <span style={{ fontSize: 18, color: "var(--muted-warm)" }}>minutes</span>
              </div>
            </div>
          </div>

          <div>
            {items.map((it, i) => (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "120px 1fr",
                gap: 32, padding: "28px 0",
                borderTop: i === 0 ? "2px solid var(--espresso)" : "1px solid rgba(59,42,34,0.12)",
                borderBottom: i === items.length - 1 ? "2px solid var(--espresso)" : "none",
              }}>
                <div>
                  <div style={{
                    fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 600,
                    color: "var(--rose-gold)", lineHeight: 1, fontVariantNumeric: "tabular-nums",
                  }}>
                    {it.time}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--muted-warm)", marginBottom: 6 }}>
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 600, color: "var(--espresso)", letterSpacing: "-0.01em" }}>
                    {it.label}
                  </div>
                  <p style={{ marginTop: 8, fontSize: 15, color: "var(--warm-brown)", lineHeight: 1.55, margin: "8px 0 0" }}>
                    {it.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function V2Sound({ church }) {
  return (
    <section style={{ padding: "120px 56px 0", background: "var(--espresso)", color: "white" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", paddingTop: 80, paddingBottom: 80 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
          <span style={{ width: 48, height: 1, background: "var(--rose-gold)" }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.32em", textTransform: "uppercase", color: "var(--blush)" }}>
            §3 — The Sound
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "end", marginBottom: 56 }}>
          <h2 style={{
            fontFamily: "'Cormorant Garamond', serif", fontSize: 96, lineHeight: 0.95,
            fontWeight: 600, margin: 0, letterSpacing: "-0.025em",
          }}>
            What it<br/>
            <span style={{ fontStyle: "italic", color: "var(--blush)" }}>sounds like</span>
          </h2>
          <p style={{ fontSize: 18, lineHeight: 1.6, color: "rgba(253,248,244,0.7)", margin: 0 }}>
            The soundtrack to a {church.name.split(" ")[0]} Sunday — and to the past decade of contemporary worship globally. Press play before you visit so the songs aren't strangers.
          </p>
        </div>

        {/* tracklist as editorial table */}
        <div style={{ borderTop: "2px solid var(--blush)", borderBottom: "1px solid rgba(244,201,192,0.2)" }}>
          <div style={{
            display: "grid", gridTemplateColumns: "32px 1fr 1.4fr auto auto auto",
            gap: 24, padding: "16px 0",
            fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(244,201,192,0.6)",
            borderBottom: "1px solid rgba(244,201,192,0.15)",
          }}>
            <div>#</div>
            <div>Track</div>
            <div>Notes</div>
            <div>Plays</div>
            <div>Length</div>
            <div></div>
          </div>
          {church.topSongs.map((song, i) => (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "32px 1fr 1.4fr auto auto auto",
              gap: 24, padding: "20px 0", alignItems: "center",
              borderBottom: i === church.topSongs.length - 1 ? "none" : "1px solid rgba(244,201,192,0.1)",
            }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 600, color: "rgba(244,201,192,0.5)", fontVariantNumeric: "tabular-nums" }}>{i + 1}</div>
              <div>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 600, lineHeight: 1.15, letterSpacing: "-0.01em" }}>
                  {song.title}
                </div>
                <div style={{ fontSize: 13, color: "rgba(253,248,244,0.55)", marginTop: 4 }}>{song.artist}</div>
              </div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 16, color: "rgba(253,248,244,0.7)", lineHeight: 1.4 }}>
                {i === 0 && "The wedding-ceremony-and-funeral one. Universal."}
                {i === 1 && "Eight minutes that have soundtracked a million baptisms."}
                {i === 2 && "Hymn-shaped. Built for big rooms."}
                {i === 3 && "The identity anthem. Simple, repeatable."}
                {i === 4 && "Creation-sized. Live recording, full band."}
                {i === 5 && "Built on the old cornerstone hymn. Modern frame."}
              </div>
              <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 14, color: "rgba(253,248,244,0.7)", fontWeight: 600 }}>{song.plays}</div>
              <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 14, color: "rgba(253,248,244,0.5)" }}>{song.duration}</div>
              <div style={{
                width: 36, height: 36, borderRadius: "50%", border: "1px solid rgba(244,201,192,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center", color: "var(--blush)", fontSize: 11,
              }}>▶</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 40, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button style={{ background: "#1DB954", color: "white", border: "none", padding: "16px 28px", borderRadius: 999, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            ▶ Open in Spotify
          </button>
          <button style={{ background: "transparent", color: "white", border: "1px solid rgba(255,255,255,0.3)", padding: "16px 28px", borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            ↗ YouTube Music
          </button>
          <button style={{ background: "transparent", color: "white", border: "1px solid rgba(255,255,255,0.3)", padding: "16px 28px", borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            ↗ Apple Music
          </button>
        </div>
      </div>
    </section>
  );
}

function V2GoodFit({ church }) {
  return (
    <section style={{ padding: "120px 56px 0" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 60, alignItems: "start" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: "var(--rose-gold)", marginBottom: 20 }}>
              §4 — Fit check
            </div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 64, lineHeight: 1.0, fontWeight: 600, color: "var(--espresso)", letterSpacing: "-0.02em", margin: 0 }}>
              Could be<br/>
              <span style={{ fontStyle: "italic", color: "var(--rose-gold)" }}>your church</span><br/>
              if…
            </h2>
            <p style={{ marginTop: 28, fontSize: 16, lineHeight: 1.6, color: "var(--warm-brown)", maxWidth: 360 }}>
              No church fits everyone. Here's a candid read on who tends to find a home here — and who probably won't.
            </p>
          </div>

          <div>
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#0f7a4a", marginBottom: 16 }}>
                ✓ You'll feel at home if…
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {church.goodFitTags.map((tag, i) => (
                  <li key={tag} style={{
                    display: "flex", alignItems: "baseline", gap: 16,
                    borderBottom: i === church.goodFitTags.length - 1 ? "none" : "1px solid rgba(59,42,34,0.1)",
                    padding: "16px 0",
                  }}>
                    <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", color: "var(--rose-gold)", fontSize: 18, width: 30, fontVariantNumeric: "tabular-nums" }}>
                      0{i + 1}
                    </span>
                    <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 600, color: "var(--espresso)", letterSpacing: "-0.01em" }}>
                      {tag}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div style={{ background: "var(--linen-deep)", padding: 28, borderRadius: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--muted-warm)", marginBottom: 14 }}>
                ⚠ Honest heads-up
              </div>
              <p style={{ margin: 0, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 19, lineHeight: 1.5, color: "var(--espresso)" }}>
                If you're looking for a small, intimate room with hymns and a quiet liturgy — this probably isn't it. {church.name.split(" ")[0]} runs big and contemporary. Both are good. They're different.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function V2Faq({ church }) {
  const [open, setOpen] = useStateV2(0);
  return (
    <section style={{ padding: "120px 56px 0" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
          <span style={{ width: 48, height: 1, background: "var(--rose-gold)" }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.32em", textTransform: "uppercase", color: "var(--rose-gold)" }}>
            §5 — Questions
          </span>
          <span style={{ flex: 1, height: 1, background: "rgba(59,42,34,0.1)" }} />
        </div>
        <h2 style={{
          fontFamily: "'Cormorant Garamond', serif", fontSize: 80, lineHeight: 0.95,
          fontWeight: 600, color: "var(--espresso)", letterSpacing: "-0.02em", margin: "0 0 56px",
        }}>
          Things people <span style={{ fontStyle: "italic", color: "var(--rose-gold)" }}>actually ask</span> before<br/>their first visit.
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, borderTop: "2px solid var(--espresso)", borderBottom: "2px solid var(--espresso)" }}>
          {church.faq.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={i}
                onClick={() => setOpen(isOpen ? -1 : i)}
                style={{
                  padding: "28px 32px",
                  borderRight: i % 2 === 0 ? "1px solid rgba(59,42,34,0.12)" : "none",
                  borderBottom: i < church.faq.length - 2 ? "1px solid rgba(59,42,34,0.12)" : "none",
                  cursor: "pointer", background: isOpen ? "var(--linen-deep)" : "transparent",
                  transition: "background 0.2s",
                }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
                  <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", color: "var(--rose-gold)", fontSize: 14, fontWeight: 600 }}>
                    Q.0{i + 1}
                  </span>
                  <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 600, color: "var(--espresso)", lineHeight: 1.25, letterSpacing: "-0.01em" }}>
                    {item.q}
                  </span>
                </div>
                {isOpen && (
                  <p style={{ marginTop: 16, fontSize: 15, lineHeight: 1.6, color: "var(--warm-brown)", marginLeft: 50 }}>
                    {item.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function V2Contact({ church }) {
  return (
    <section style={{ padding: "120px 56px 0" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 0, border: "2px solid var(--espresso)" }}>
          <div style={{ padding: 56, borderRight: "1px solid rgba(59,42,34,0.15)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: "var(--rose-gold)", marginBottom: 20 }}>
              §6 — Plan a visit
            </div>
            <h2 style={{
              fontFamily: "'Cormorant Garamond', serif", fontSize: 80, lineHeight: 0.95,
              fontWeight: 600, color: "var(--espresso)", letterSpacing: "-0.02em", margin: 0,
            }}>
              See you<br/>
              <span style={{ fontStyle: "italic", color: "var(--rose-gold)" }}>Sunday?</span>
            </h2>
            <p style={{ marginTop: 28, fontSize: 17, lineHeight: 1.65, color: "var(--warm-brown)", maxWidth: 460, margin: "28px 0 0" }}>
              We've saved you a seat. The coffee's already on. If you tell us you're new, someone will be at the door looking for you.
            </p>
            <div style={{ marginTop: 36, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button style={{ background: "var(--espresso)", color: "white", border: "none", padding: "16px 32px", borderRadius: 0, fontSize: 13, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", cursor: "pointer" }}>
                Plan my first visit →
              </button>
              <button style={{ background: "transparent", color: "var(--espresso)", border: "1px solid var(--espresso)", padding: "16px 32px", borderRadius: 0, fontSize: 13, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", cursor: "pointer" }}>
                Watch online
              </button>
            </div>
          </div>
          <div style={{ padding: 56, background: "var(--linen-deep)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: "var(--muted-warm)", marginBottom: 24 }}>
              The basics
            </div>
            <dl style={{ margin: 0 }}>
              {[
                ["Address", church.streetAddress],
                ["Phone", church.contact.phone],
                ["Email", church.contact.email],
                ["Web", church.contact.website],
                ["Sundays", church.serviceTimes.map(s => s.time).join(" · ")],
              ].map(([k, v], i) => (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "100px 1fr", gap: 24, alignItems: "baseline",
                  padding: "16px 0", borderTop: i === 0 ? "none" : "1px dotted rgba(59,42,34,0.2)",
                }}>
                  <dt style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--muted-warm)" }}>{k}</dt>
                  <dd style={{ margin: 0, fontFamily: "'Cormorant Garamond', serif", fontSize: 19, fontWeight: 500, color: "var(--espresso)", letterSpacing: "-0.005em" }}>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}

function VariantTwo({ church }) {
  return (
    <div style={v2Styles.page}>
      <V2RunningHeader church={church} />
      <V2Hero church={church} />
      <V2Story church={church} />
      <V2Sunday church={church} />
      <V2Sound church={church} />
      <V2GoodFit church={church} />
      <V2Faq church={church} />
      <V2Contact church={church} />
    </div>
  );
}

window.VariantTwo = VariantTwo;
