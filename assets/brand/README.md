# Oontu approved logo assets

Brand palette
- Deep Navy: `#0B1F3B`
- Signature Green: `#10B981`
- Warm White: `#F8F8F6`

## App icon, favicon and compact mark (2026-11-20)
The icon is the wordmark's own first letter and full stop: **"O."**. The O is the exact outline of the wordmark's O (Inter ExtraBold), and the green dot sits on the baseline at the wordmark's own spacing.
- **App icon:** a Deep Navy tile with a macOS-style 22.4% corner radius, a white O and a Signature Green dot.
- **Light variant:** a Warm White tile with a navy O.
- **Favicon:** the same tile, with the mark drawn larger so it still reads at 16 px.
- **Compact mark:** the mark alone, with no tile.
- **Collapsed sidebar rail:** shows the app icon.
- **PNG exports:** rendered from the SVGs at 1024 px, then downscaled.
- **Earlier versions:** kept in `original/2026-11-20/`.

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
