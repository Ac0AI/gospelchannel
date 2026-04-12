# GospelChannel Design System

Warm, welcoming, trustworthy. Think "Pinterest meets church welcome page." Not corporate, not megachurch, not generic SaaS.

## Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `linen` | `#fdf8f4` | Page background (with radial gradients) |
| `linen-deep` | `#f7ede4` | Card backgrounds, hover states |
| `blush` | `#f4c9c0` | Decorative accents, soft borders |
| `blush-light` | `#fce9e5` | Radial gradient tint, badges |
| `rose-gold` | `#b06a50` | Primary accent, links, CTAs, icons |
| `rose-gold-deep` | `#944f3c` | Hover state for rose-gold |
| `mauve` | `#9b7fa0` | Secondary accent (used sparingly) |
| `mauve-light` | `#e8dff0` | Radial gradient tint |
| `espresso` | `#3b2a22` | Primary text color |
| `warm-brown` | `#7a5c4e` | Secondary text, subtle headings |
| `muted-warm` | `#9e8075` | Labels, metadata, tertiary text |

All colors are CSS custom properties defined in `src/app/globals.css` and mapped to Tailwind via `@theme inline`.

## Typography

| Role | Font | Tailwind | Weight |
|------|------|----------|--------|
| Body | Nunito | `font-sans` | 400, 500, 600, 700 |
| Headings | Cormorant Garamond | `font-serif` | 600, 700 |

- Headings: `font-serif font-semibold text-espresso` with `letter-spacing: -0.01em`
- Section headings: `font-serif text-xl font-semibold text-espresso sm:text-2xl`
- Labels: `text-xs font-semibold uppercase tracking-wider text-muted-warm`
- Body text: `text-sm text-espresso` or `text-sm leading-relaxed text-espresso`

## Layout

- Page background: linen with blush and mauve radial gradients
- Max content width: defined by container classes in layout
- Section spacing: `space-y-6` between major sections

## Component Patterns

### Container / Card
```
rounded-2xl border border-rose-200/40 bg-white/80 p-6 backdrop-blur-sm sm:p-8
```

### Pill / Tag
```
inline-flex items-center gap-1 rounded-full bg-cream-warm/60 px-2.5 py-1 text-xs font-medium text-warm-brown
```

### Button (primary)
```
rounded-full bg-rose-gold px-6 py-2.5 text-sm font-semibold text-white hover:bg-rose-gold-deep transition-colors
```

### Link
```
text-rose-gold hover:text-rose-gold-deep
```
With worship-link underline animation (see globals.css).

### Icon
Heroicons outline, `h-3.5 w-3.5 text-rose-gold/60` in labels. Larger `h-5 w-5` in standalone contexts.

### Section Heading
```
<h2 className="font-serif text-xl font-semibold text-espresso sm:text-2xl">
```

### Label
```
<dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-warm">
```

## Animations

- `reveal-up`: scroll-triggered entrance (0.6s ease-out, translateY 24px to 0)
- `heart-pulse`: like button pulse (0.45s cubic-bezier)
- `fade-in`: overlay/modal entrance (0.2s ease-out)
- `holy-shimmer`: warm light gradient rotation on search input
- Links: underline grows from left on hover (0.3s ease)

## Principles

1. **Warm, not corporate.** Rose-gold and cream, not blue and gray.
2. **Serif for trust.** Headings in Cormorant Garamond convey warmth and tradition.
3. **Backdrop blur for depth.** White containers with blur over the gradient background create layers.
4. **Hide when empty.** If a field has no data, hide the entire element. No "N/A", no placeholders.
5. **Icons are subtle.** Small, muted rose-gold. They support labels, they don't replace them.
6. **Mobile-first.** Prevent horizontal overflow. Touch targets on mobile via media queries.
