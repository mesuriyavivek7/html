# Oontu approved logo assets

Brand palette
- Deep Navy: `#0B1F3B`
- Signature Green: `#10B981`
- Warm White: `#F8F8F6`

## App icon, favicon and compact mark (2026-11-23: "O. on Deep Navy")
The icon is the wordmark's own first letter and full stop: **"O."**. The O is the exact outline of the wordmark's O (Inter ExtraBold), and the green dot keeps the wordmark's own spacing. Nothing is redrawn.
- **App icon** (`oontu-app-icon.svg`):
  - **Tile:** a continuous-curve squircle in Deep Navy with a soft top light (#14305A → #0B1F3B).
  - **Mark:** a white O and a Signature Green dot, about 58% of the tile, optically centred.
- **One file, two drawings:** at 48 px and below, a small-size version takes over by itself, through a media query inside the SVG. The O grows and the dot gets bigger, so the icon never disappears in a browser tab or the collapsed sidebar rail (32 px). Use the same file everywhere; never pick a size by hand.
- **Light variant** (`oontu-app-icon-light.svg`): a white squircle with a hairline edge and a navy O. Best kept for print and light surfaces, because it blends into white home screens.
- **Favicon:** `favicon.svg` is the app icon, so the small-size version applies by itself. `favicon-16/32/48.png` are the small-size version in the squircle, with transparent corners.
- **Platform PNGs:** `oontu-app-icon-180/192/512/1024.png` are full-bleed squares. iOS, Android and the stores apply their own corner mask, so never pre-round them.
- **Never:**
  - Kairo colours.
  - Changing the dot colour.
  - Tilting.
  - The full wordmark in the tile.
  - Outlines.
- **Earlier versions:** kept in `original/2026-11-20/`. The 2026-11-23 round replaced the rounded-square tile.

## Recommended usage
- Header / primary brand: `oontu-wordmark.svg` (subtle shadow).
- Footer on light backgrounds: `oontu-wordmark-flat.svg` (flat keeps small footer branding crisp).
- Dark surfaces: `oontu-wordmark-white.svg`; use the flat white variant for dense/small placements.
- Sidebar compact mark: `oontu-mark.svg` on light surfaces, `oontu-mark-white.svg` on dark surfaces.
- App icon: `oontu-app-icon.svg` or `oontu-app-icon.png` exports.
- Browser favicon: `favicon.svg`, plus `favicon-16.png`, `favicon-32.png`, `favicon-48.png`.
- Apple touch icon: `oontu-app-icon-180.png`. Android/PWA: `oontu-app-icon-192.png` and `oontu-app-icon-512.png`.

## HTML
```html
<link rel="icon" type="image/svg+xml" href="/assets/brand/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/brand/favicon-32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/assets/brand/oontu-app-icon-180.png">

<a class="brand" href="/" aria-label="Oontu home">
  <img src="/assets/brand/oontu-wordmark.svg" alt="Oontu" width="156" height="36">
</a>
```

## CSS sizing
```css
.brand img { display:block; width:156px; height:auto; }
.brand--footer img { width:124px; }
.brand--compact img { width:32px; height:32px; }
```

The wordmark SVG uses a system font stack (Inter / SF Pro Display / system sans-serif). For exact cross-platform letterform consistency, convert the text to vector outlines in a design tool after the final font is licensed and selected. The shadow is intentionally restrained; use the flat variants at very small sizes.
