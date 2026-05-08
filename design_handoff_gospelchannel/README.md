# Handoff: GospelChannel

A directory for the world's churches — discovery, prayer wall, claim-your-church, fit quiz. 16 pages, one editorial design system.

## About these files

The HTML files in `designs/` are **design references**, not production code. They were built as React + inline JSX in single-file HTML to iterate fast on look-and-feel. Your task is to **recreate these designs in your target codebase's environment** (e.g. Next.js + Tailwind, Remix, SvelteKit, etc.) using its established patterns — components, routing, data fetching, accessibility primitives. Do not ship the HTML directly.

If no environment exists yet, **Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui** is the recommended choice — it matches the editorial-but-modular nature of these designs and gives you SEO-friendly server rendering for the directory pages.

## Fidelity

**High-fidelity.** Final colors, typography, spacing, copy. Recreate pixel-perfectly. Where the design uses placeholder Unsplash images, swap in real photography of equivalent character.

## Pages (16 total)

Open `designs/index.html` for a clickable sitemap of all pages.

### Church profile (the individual church page) — `/churches/[slug]`

**This is the most important page.** Three full-design variants live in `designs/variants/`, displayed inside `Vackrare kyrksidor.html`:

| Variant | File | Direction |
|---|---|---|
| 01 Polished | `variants/variant-1-polished.jsx` | Refinement of current system — safe |
| 02 Editorial | `variants/variant-2-editorial.jsx` | Magazine push |
| 03 Bold | `variants/variant-3-bold.jsx` | Cinematic remix — desktop |
| 03 Bold — Mobile | `variants/variant-3-bold-mobile.jsx` | iPhone 375px reflow |

The chosen direction is **shipped as the canonical pages**:
- `church.html` — desktop church profile
- `church-mobile.html` — mobile (375px) reflow of the same data
- `church-fit.html` — "is this church a fit for me?" deep-dive variant

Plus two support sets in the same file:
- `variant-4-fallbacks.jsx` — five hero-fallback strategies for churches without a good photo
- `variant-5-giant-initial.jsx` — the chosen no-photo direction (color + giant Cormorant initial), with all tradition palettes shown

All four variants render the same `church` object (`data/hillsong.js`) so you can compare apples to apples. **Pick one and port it as the canonical church profile.**

### Discover & Search
| File | Route suggestion | Purpose |
|---|---|---|
| `Landing - Säker.html` | `/` (variant A) | Polished refinement landing |
| `Landing - Push.html` | `/` (variant B) | Editorial bold landing — pick one |
| `Vackrare kyrksidor.html` | (internal) | Side-by-side variant canvas — for review only, do not ship |
| `Search - Säker.html` | `/search` (variant A) | Filterable results |
| `Search - Push.html` | `/search` (variant B) | Editorial results — pick one |
| `city.html` | `/cities/[slug]` | All churches in a city |
| `tradition.html` | `/traditions/[slug]` | Tradition landing (Lutheran shown as template) |
| `compare.html` | `/compare?ids=...` | Side-by-side 2–4 church comparison |
| `quiz.html` | `/quiz` | 8-question fit quiz → 3 matches |

### Community
| File | Route suggestion | Purpose |
|---|---|---|
| `prayer-wall.html` | `/prayer-wall` | Anonymous prayer wall, "pray with" counter |
| `prayer-wall-mobile.html` | `/prayer-wall` (mobile) | Single-column reflow |
| `about.html` | `/about` | Mission + stats |

### For Churches
| File | Route suggestion | Purpose |
|---|---|---|
| `for-churches.html` | `/for-churches` | B2B pitch + pricing |
| `claim-church.html` | `/churches/[id]/claim` | Verify ownership form |
| `suggest-church.html` | `/suggest` | Submit a new church |

### Marketing & system
| File | Route suggestion | Purpose |
|---|---|---|
| `about.html` | `/about` | Story, mission |
| `404.html` | (404 fallback) | Editorial lost page |
| `index.html` | (sitemap, dev-only) | Page index for review |

## Design tokens

All tokens are in `designs/lib/shared.css` as CSS custom properties. Port these to your token system (Tailwind config / CSS vars / theme file).

### Colors

```
--linen:        #fdf8f4   /* page background */
--linen-deep:   #f7ede4   /* secondary surface */
--linen-darker: #efe2d4

--blush:        #f4c9c0
--blush-light:  #fce9e5

--rose-gold:      #b06a50   /* PRIMARY brand color */
--rose-gold-deep: #944f3c   /* primary hover/pressed */

--mauve:       #9b7fa0     /* eyebrow / accent */
--mauve-light: #e8dff0

--espresso:    #3b2a22     /* body text + dark surfaces */
--warm-brown:  #7a5c4e     /* body copy */
--muted-warm:  #9e8075     /* metadata, captions */

--sage: #8a9d83
--gold: #c89b58
```

### Typography

Two families, loaded from Google Fonts:

- **Cormorant Garamond** (serif) — headlines, italic accents, large numerals. Weights 400–700, italic available.
- **Nunito** (sans) — body, UI, buttons. Weights 400–900.

```
H1: Cormorant Garamond 600, 64–96px, letter-spacing -0.02em, line-height 1.05
H2: Cormorant Garamond 600, 44px, letter-spacing -0.01em, line-height 1.1
H3: Cormorant Garamond 600, 28px, letter-spacing -0.01em, line-height 1.2
Italic accent: Cormorant Garamond italic, color: var(--rose-gold)
Lede: Nunito 400, 18px, color: var(--warm-brown), line-height 1.55
Body: Nunito 400, 15px, color: var(--espresso) or var(--warm-brown)
Eyebrow: Nunito 700, 11px, letter-spacing 0.22em, UPPERCASE, color: var(--mauve)
Metadata: Nunito 600, 12px, letter-spacing 0.06–0.16em, UPPERCASE, color: var(--muted-warm)
```

The `<em class="gc-italic">word</em>` pattern (italic Cormorant in rose-gold) is a **signature treatment** — used in nearly every headline. Keep it.

### Spacing & radii

- Section padding: 80px vertical, 48px horizontal (desktop); 48px / 20px (mobile)
- Max content width: 1280px
- Card radius: 18px (large), 16px (medium), 14px (input), 999px (pills/buttons)
- Shadows: `--shadow-sm`, `--shadow`, `--shadow-lg` (warm tinted, low-spread — see `shared.css`)

### Borders

- `--border`: `1px solid rgba(176,106,80,0.14)` — section dividers
- `--border-soft`: `1px solid rgba(176,106,80,0.10)` — internal dividers, soft cards

## Components

Three shared components defined in `designs/lib/shared.jsx`:

### `<GCHeader active dark />`
Sticky, blur-backdrop. Logo (Cormorant) left, 4 nav links center, Sign in + Add a church right. Pass `active` to highlight a nav link in rose-gold. Pass `dark={true}` for dark hero overlays.

### `<GCFooter />`
Espresso background, 5-column grid (brand + 4 link columns), language switcher in bottom row. Update church/country counts from real data.

### `<GCChurchCard church size />`
Renders a church listing card. **Critical detail — empty-state handling:** if `church.thumbnail` is missing, the card renders a fallback panel: a tradition-tinted dark background with a giant Cormorant initial in the tradition's accent color. This is the brand's signature graceful empty state. Tradition palettes are in `GCTraditionPalettes`:

```
pentecostal/nondenominational → bg #1a1814, accent #b06a50 (rose-gold)
charismatic                   → bg #1f1a14, accent #c08a4f
baptist                       → bg #162018, accent #7a9d83 (sage)
presbyterian                  → bg #0f1419, accent #3a6fb0
anglican                      → bg #1d1a24, accent #9b7fa0 (mauve)
lutheran                      → bg #1f1c18, accent #c89b58 (gold)
catholic                      → bg #1a1620, accent #7a5fa8
orthodox                      → bg #1a1410, accent #c8731f
methodist                     → bg #181d1a, accent #5d8a6f
```

Card props:
```
{ name, city, country, denomination, style, blurb, thumbnail, verified, hasMusic, hasKids, hasService, initial?, palette? }
```

## Buttons

All pill-shaped (border-radius 999px). Three variants:

- `.gc-btn-primary` — rose-gold bg, white text. Lifts on hover with rose-gold shadow.
- `.gc-btn-ghost` — transparent, espresso text, rose-gold-tinted border.
- `.gc-btn-dark` — espresso bg, linen text.

Sizes: `.gc-btn-sm` (8/16px), default (12/22px), `.gc-btn-lg` (16/32px).

## Interactions & behavior

- **Quiz** (`quiz.html`): 8 sequential questions. Selecting an answer auto-advances after 250ms. Progress bar fills as you go. Skip-to-results link in top-right. Results page shows 3 match cards with % match, "why" line in italic Cormorant.
- **Compare** (`compare.html`): Up to 4 columns. First column is "+ Add a 4th" CTA when fewer than 4. Comparison rows alternate background (`rgba(247,237,228,0.4)`) for readability.
- **Prayer Wall**: "Pray with" button increments a counter. Card shadows lift on hover.
- **Search filter pills**: Active state is `--espresso` bg with `--linen` text; inactive is `--linen-deep` bg.
- **Card hover**: `translateY(-3px)` + shadow upgrade `--shadow-sm` → `--shadow`.

## State & data shape

```ts
type Church = {
  id: string;
  name: string;
  city: string;
  country: string;
  neighborhood?: string;
  denomination: 'pentecostal' | 'lutheran' | 'catholic' | 'anglican' | 'baptist' | 'presbyterian' | 'methodist' | 'orthodox' | 'charismatic' | 'nondenominational';
  style?: string;        // "Contemporary · bilingual"
  blurb?: string;
  size?: string;         // "1,200 weekly"
  serviceTimes?: string;
  language?: string;
  thumbnail?: string;
  verified: boolean;
  hasMusic: boolean;
  hasKids: boolean;
  hasService: boolean;
};

type PrayerRequest = {
  id: string;
  text: string;
  prayedWithCount: number;
  createdAt: Date;
  // anonymous — no author
};

type QuizAnswer = { questionIndex: number; choice: string };
type QuizResult = { church: Church; matchPct: number; whyLine: string };
```

## Responsive behavior

Designs are desktop-first at 1280px. Mobile breakpoint is 768px:
- Header nav collapses (hamburger needed — not designed; use a slide-down panel)
- H1 drops 72→44px, H2 drops 44→32px
- Section padding shrinks 48px → 20px horizontal
- Footer grid 5col → 2col

## Voice & copy

- **Editorial, calm, slightly literary.** Not corporate. Not preachy.
- Numbered sections ("No. 01 · Discover", "No. 02 · By tradition") — keep this convention.
- Lowercase metadata in eyebrows, except the eyebrow itself which is UPPERCASE.
- Italic Cormorant for emphasis words inside headlines (`Tradition.` → `<em class="gc-italic">Tradition</em>.`)
- Swedish + English mixed copy in some places (the project is Swedish-origin) — keep or translate per launch market.

## Assets

- All photography in mocks is from Unsplash (placeholder). Replace with real, licensed church photography.
- No icons used in mocks (intentional — the brand uses Cormorant initials and `✓` verified marks instead). If you need icons, lean on **Phosphor** or **Lucide** in the lightest weight.
- Logo is wordmark-only: "GospelChannel" in Cormorant Garamond 600, letter-spacing -0.01em.

## Files

```
designs/
  index.html                      Sitemap
  Landing - Säker.html            Landing variant A (safe)
  Landing - Push.html             Landing variant B (editorial)
  Search - Säker.html             Search variant A
  Search - Push.html              Search variant B
  Vackrare kyrksidor.html         Variant canvas (review only)
  prayer-wall.html
  for-churches.html
  claim-church.html
  suggest-church.html
  about.html
  compare.html
  quiz.html
  city.html                       Stockholm template
  tradition.html                  Lutheran template
  404.html
  lib/
    shared.css                    All design tokens + utility classes
    shared.jsx                    GCHeader, GCFooter, GCChurchCard, GCTraditionPalettes
    design-canvas.jsx             Canvas chrome (review only, do not port)
  variants/
    landing-safe.jsx              Landing variant A — full design
    landing-push.jsx              Landing variant B — full design
    search-safe.jsx               Search variant A — full design
    search-push.jsx               Search variant B — full design
    variant-*.jsx                 Earlier exploration variants (review only)
  data/
    landing-data.js               Sample data for landing/search
    hillsong.js                   Sample church record
```

## Open questions for the team

1. **Pick one landing variant.** Both Säker (safe) and Push (editorial) are production-ready; the user is reviewing.
2. **Pick one search variant.** Same situation.
3. **Real church data source** — admin tool, public submission with moderation, or an existing dataset?
4. **Claim flow verification** — email-on-domain, callback, or manual review?
5. **i18n strategy** — the footer hints at SE/EN/ES. Confirm launch languages.
