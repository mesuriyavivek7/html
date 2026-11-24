# design-style.md: Oontu Design System 2.0, "B · Balanced"

**Status:** approved. This is the single source of truth for how Oontu looks and moves.
**Supersedes:** `design.md` (Oontu Design 1.0, "graphite", 2026-11-15). Where the two disagree, this file wins. Token *names* from 1.0 are kept on purpose (§14.3), so the code changes values, not structure.
**Visual authority:** the approved `Balanced.dc.html` (in `B · Balanced (recommended)-html.zip`), plus the refinements the owner approved on 18 Nov 2026 in the working version of the same direction (board "B+ · Balanced, working app"). §2.1 lists those refinements.
**Functional authority:** the existing product, `recruitment-os-prototype.html` (18 Nov 2026 build, 58,262 lines), its `docs/` and its `tests/`. This document never adds, removes or renames a feature, permission, route, record or label. The only exceptions are the items in §2.4, each named and bounded.
**Brand authority:** `oontu-approved-logo-assets.zip` (§2.3).

Reading order for implementers: §1 → §3 (tokens) → §4 (shell) → §8 (components) → the module you are working on in §6/§7 → §15 acceptance criteria for it.

---

## 1. Design vision

### 1.1 Philosophy
Oontu is a Recruitment Operating System. The interface should feel like a calm, intelligent colleague, not a dashboard full of widgets. **B · Balanced** sits between "calm" and "rich":

- **White-first, navy-anchored.** The page is a cool near-white (`#F6F7F9`). Content sits on white surfaces. Deep Navy (`#0B1F3B`) is used for the few things that must win: the primary action, the selected day and the active rail item. Text is navy-tinted slate, never black.
- **One working accent.** Blue `#2F64D6` is the interaction colour: links, focus and the selected/informational state. It is not decoration.
- **Green is a signature.** Signature Green `#10B981` means "done, earned, paid": the logo dot, Joined/Get-paid, goal completion and positive deltas. It is never a button fill or a background wash.
- **Colour carries meaning, always lightly.** Status colour is a translucent tint (7–9%) plus a 6 px dot and tinted text. No solid status fills, no saturated badges.
- **Few boxes.** A card exists only when it groups one job to be done. Inside cards, use whitespace, hairlines (`rgba(11,31,59,.06)`) and alignment, not nested boxes.
- **Numbers are calm and exact.** Tabular figures, one size per role (KPI, inline stat, table value), comparison text beside them, and no gauges for things that are not measurements.
- **Fixed frame, flowing content.** The sidebar and top bar stay still while content scrolls under a frosted top bar. Motion is quick and functional.

### 1.2 Experience goals
1. Someone landing on Home knows within five seconds what needs them, what is happening today and how the period is going.
2. Every list can be scanned in columns: the same column means the same thing on every row.
3. Every card has a fixed footprint. Overflow is handled inside the card by scroll, paging or "+N more", never by growing the page unpredictably.
4. Every role and every module looks like the same product.
5. Works from 320 px phones to 2560 px monitors without "shrunk desktop" layouts.

### 1.3 Visual hierarchy (highest to lowest)
1. Primary action (navy pill), the selected state (navy tile/chip, white active nav card).
2. Page greeting/title (32/24 px, weight 600).
3. Key numbers (28 px KPI, 22–26 px inline stats).
4. Section titles (18 px / 600) and card titles (15 px / 600).
5. Row titles (14 px / 500), body (14 px / 400).
6. Metadata (12–13 px, `--text-3`), axis labels (11 px).
7. Status tints, hairlines and backgrounds.

### 1.4 What to avoid (hard rules)
- Pure black text (`#000`, `#111`) or text darker than `#1E2E48`.
- Font weights 700/800 in the UI (800 exists only inside the wordmark SVG).
- UPPERCASE overlines and letter-spaced labels. Use sentence case.
- Solid saturated badges (white text on red, green or blue). Exceptions: the navy primary button, the navy selected day/rail tile and the Kairo launcher.
- Grey-only charts. Data uses the soft chart palette (§9). Neutral UI uses navy-tinted slates, not flat greys like `#9CA3AF` or `#E5E7EB`.
- Rainbow emphasis: never more than one attention colour in a single row.
- Cards inside cards, borders plus shadows plus fills on the same element, or dashed decoration.
- Hidden-until-hover actions that shift layout. Actions may *strengthen* on hover, but their space is always reserved.
- Spinners. Use skeletons or the Oontu loader (§8.19).
- Emoji in UI chrome, purple/pink gradients outside Kairo, glassmorphism outside the top bar and floating layers.
- Any change to behaviour, data, permissions or copy meaning as a by-product of styling.

---

## 2. Reference analysis

### 2.1 What the approved reference contains
`Balanced.dc.html` is one 1440 × 2140 artboard of the **Recruiter Home**, built from inline styles:

| Region | Extracted structure and values |
|---|---|
| Page | `background:#F6F7F9`; Inter 400/500/600(/800 wordmark); body colour `#3D4B63`; `letter-spacing:-0.006em`; antialiased |
| Sidebar | 248 px, transparent on page background, padding `26px 16px 20px`, gap 26. Wordmark text (26 px / 800 / `-0.06em`, `#0B1F3B`) with a 6 px green dot. Workspace card: white, radius 14, ring `0 0 0 1px rgba(11,31,59,.06)`, 32 px gradient initials tile (`#2F64D6→#10B981`, radius 10). Grouped nav: group label 12 px `#5E6A82`; item 38 px tall, radius 11, 14 px, icon 17 px stroke 1.6, gap 12; active item white with ring `.06` and `0 2px 6px -3px rgba(11,31,59,.12)`, colour `#1E2E48`, weight 500; count 12 px `#5E6A82` tabular |
| Top bar | search field (white, radius 12, ring `.07`, 42 px, placeholder "Search candidates, jobs, clients", `⌘K` chip on `#F1F4F9` radius 6), secondary pill button (white, ring `.08`, 42 px, radius 999), primary pill button (`#0B1F3B`, white text, 42 px, radius 999, plus icon), bell icon button (42 px, radius 12, red dot 7 px with 2 px white ring), avatar (42 px, radius 12, `#EAF0FB`/`#2652B8`) |
| Hero | radius 28 (refined to 26), `linear-gradient(135deg,#EEF3FD,#F1F6FC 50%,#E9F7F1)` (refined lighter, §3.1), radial glow `rgba(47,100,214,.14)` top-right. Date line 14 px `#5E6A82` with an amber sun icon; greeting 40 px (refined to 32 px) / 600 / `-0.035em` `#1E2E48`; one-sentence summary 17 px (refined to 15 px) with `#1E2E48` 600 emphasis; three chips (white 75%, ring `.06`, 34 px, 7 px coloured dot). Goal card: white 78%, radius 20, 76 px progress ring (stroke 7, gradient `#2F64D6→#10B981`, track `#E3EAF6`), plus a "your day" timeline |
| KPIs | 4 tiles, white 86%, radius 18 (refined to one strip, radius 20, §2.2), label 13/500, tinted 30 px icon chip radius 9, value 34 px (refined to 28) / 600 / `-0.035em`, sparkline 2 px in chip colour, delta pill |
| The Thread | "Your hires, end to end": Find → Engage → Interview → Approve → Hire → Get paid. Stage ramp `#3B5CB8 #2F6BD0 #2786C8 #1E9CB5 #16AA98 #10B981`; slowest stage amber `#E8960F` with a 6 px halo; Get paid solid green with halo |
| Cards | white, radius 22, `box-shadow:0 0 0 1px rgba(11,31,59,.05), 0 10px 30px -18px rgba(11,31,59,.18)`, title 18/600 `-0.015em` |
| Needs you | queue rows with a 36 px tinted icon tile (radius 11), title 14/500, meta 13, due pill, row hover `#F7F9FC` |
| Today | timeline of interviews with time, 9 px status ring, status pill |
| Chart | area chart, blue `#2F64D6` and teal `#14A3A0` lines 2.4 px, gradient fills, end-value bubbles |
| Kairo card | `linear-gradient(140deg,#F3F0FD,#FBF1F4)`, radius 22, white 28 px icon tile, iris `#5B48C2` link, label colour `#5B4A7A` |
| Where time goes | horizontal bars 8 px, track = colour at 10%, slowest in amber |
| Jobs table | grid rows 64 px, hairline separators, owner avatar 28 px, segmented pipeline bar 6 px, status pills, "⋯" 32 px ghost button, pagination |
| Kairo launcher | fixed bottom-right pill 52 px, `linear-gradient(135deg,#7C6CE0,#D46A86)`, shadow `0 16px 30px -12px rgba(124,108,224,.6)` |

### 2.2 Refinements the owner approved after the reference (now part of the spec)
1. **Lighter status colour** everywhere (status, feedback, remarks, due labels, icon tiles): translucent tint + dot (§3.1.4).
2. **Compact Home hero:** greeting 32 px; KPIs merged into one divided strip; the Thread rebuilt as compact columns with proportional bars, % conversion between stages and time-in-stage under each count.
3. **Needs you** became an aligned table-like list: shared column grid (icon · task · due · action), column headings, group headings with counts and a rule, and always-visible light action buttons.
4. **Submissions card** with Status/Trend views. Status shows Submitted · Still moving · Client replied · Backed out, one stacked bar, then "Moving forward" and "Dropped" columns with count and %, a Kairo note, and an actionable footer. Trend shows Submitted, Interviews **and Backed out** for the selected period.
5. **Date-range control** in the top-right corner of the top bar (presets plus calendar plus "compare with previous period"); every Home number follows it.
6. **Fixed sidebar and frosted top bar**; only the content column scrolls; sections rise in softly on scroll.
7. **Collapsed rail without numbers:** active item is a navy tile; pending work is shown as a 7 px dot (urgent = rose with a soft pulse); tooltips carry the detail.
8. **Fixed card heights with defined overflow** (internal scroll with fade, "+N more", pagination, line clamps).
9. **Softer chart colours** (§9).

### 2.3 Approved logo assets: analysis and rules
Package contents (verified): `oontu-wordmark.svg` (restrained shadow), `oontu-wordmark-flat.svg`, `oontu-wordmark-white.svg`, `oontu-wordmark-white-flat.svg`, `oontu-mark.svg` (O-ring with green dot, light surfaces), `oontu-mark-white.svg`, `oontu-app-icon.svg` / `-light.svg` with PNGs at 180/192/512/1024, `favicon.svg`, `favicon-light.svg`, `favicon-16/32/48.png`, and three preview PNGs.

| Placement | Asset | Size |
|---|---|---|
| Expanded sidebar header (primary brand on light) | `oontu-wordmark.svg` | width 112 px (height ≈ 26 px); left edge aligned to nav icon column |
| Collapsed rail header | `oontu-mark.svg` | 32 × 32 px |
| Mobile top bar | `oontu-wordmark-flat.svg` | width 96 px |
| Auth / sign-up / onboarding header | `oontu-wordmark.svg` | width 156 px (README default) |
| Footers, legal pages, outside-app pages (secure links, vendor portal, jobs website), emails | `oontu-wordmark-flat.svg` | width 124 px |
| Any dark surface (navy panels, dark theme, launch screen on navy) | `oontu-wordmark-white.svg`; `-white-flat` below 100 px width; `oontu-mark-white.svg` for the mark | same sizes |
| Browser favicon | `favicon.svg` + `favicon-32.png` + `favicon-16.png` (+48) | — |
| Apple touch | `oontu-app-icon-180.png` | — |
| PWA / Android | `oontu-app-icon-192.png`, `-512.png` (and `-light-*` for light-theme manifests if used) | — |
| Loader / launch | `oontu-mark.svg` (light), `oontu-mark-white.svg` (navy) | 56 px |

Rules:
- Ship the files under `assets/brand/` and reference them with `<img>` or `<use>`. **Never redraw, recolour, re-typeset, stretch, crop, add effects to or approximate the logo.** The prototype's inline `OONTU_SYMBOL_MARK` and full-lockup SVG constants are the *old* brand and must be replaced by the approved files (or byte-identical inline copies of them).
- Clear space: at least the height of the green dot × 2 on every side.
- Minimum sizes: wordmark 72 px wide (use the flat variant below 100 px); mark 16 px.
- **Known asset caveat:** the wordmark SVGs set "Oontu" as live text (Inter/SF fallbacks, weight 800). If the font is missing, the dot position drifts. The UI must load Inter 800 (or ship an outlined export) before the wordmark renders. Record in the completion report whether an outlined version was available. Do not hand-edit the SVG geometry to compensate.
- The tenant's own workspace identity (initials tile, company name) is separate from the Oontu logo and never replaces it.

### 2.4 Bounded additions approved as part of this design (visual features that read existing data)
These are the only places the design asks for UI that the current screens do not already have. Each reads data the product already stores. None writes new data or changes a model.
1. **Home period control** (§7.1.3): filters Home metrics by date using existing record timestamps. A metric without a usable date shows "All time" in its caption instead of pretending to filter.
2. **Submissions card status breakdown and backout trend** (§7.1.6): computed from existing journey statuses (`JOURNEY_STATUS_LABEL`: `with_client`, `shortlisted`, `interviewing`, `selected`, `offer_made`, `offer_accepted`, `joined`, `rejected_client`, `rejected_round`, `backed_out`, `offer_declined`, `on_hold`, `withdrawn`) and their history dates.
3. **Collapsed-rail signal dots and tooltips** (§4.3): computed from the existing nav `count()` functions and the existing `urgent` flag.
4. **Goal ring** (Home hero and rail): shown **only** if a target for the signed-in person already exists in the data. Otherwise the hero shows the existing summary content and the rail shows nothing in that slot.

If any of these cannot be computed from existing data for a role, render the element without the missing number (or omit it) and record it in the completion report. **Never fabricate numbers.**

---

## 3. Design tokens

All tokens live in one `:root` block in the last stylesheet of the page (`<style id="oontu-design">`), as in 1.0. Names follow 1.0 where a 1.0 name exists, and **only the values change**. New names are marked **new**. Components never use raw hex, rgba, px radii, shadows or durations. They use these tokens.

### 3.1 Colour

#### 3.1.1 Brand
| Token | Value | Use |
|---|---|---|
| `--brand-navy` **new** | `#0B1F3B` | primary action fill, active rail tile, selected day, navy surfaces |
| `--brand` | `#10B981` | signature green: logo dot, Joined/Get paid, goal completion, positive delta icons, success toast dot |
| `--brand-warm-white` **new** | `#F8F8F6` | auth/marketing backgrounds and print/PDF pages (not the app page) |

#### 3.1.2 Text (navy-tinted slate; contrast on `#FFFFFF` / `#F6F7F9`)
| Token | Value | Contrast on white | Use |
|---|---|---|---|
| `--text-1` | `#1E2E48` | 13.9:1 | titles, values, row titles, selected labels |
| `--text-2` | `#3D4B63` | 9.3:1 | body, nav items, table cells |
| `--text-3` | `#5E6A82` | 5.6:1 | metadata, captions, group labels, axis labels, placeholders |
| `--text-4` | `#9AA4B6` | 2.5:1 | **decorative only**: disabled text, future dates, chevrons. Never for information |
| `--text-on-dark` **new** | `#FFFFFF` | — | on navy |

#### 3.1.3 Action, accent, surfaces, lines
| Token | Value | Use |
|---|---|---|
| `--action` | `#0B1F3B` | primary button background |
| `--action-hover` | `#14294A` | primary hover |
| `--action-pressed` | `#081730` | primary pressed |
| `--on-action` | `#FFFFFF` | |
| `--accent` **new** | `#2F64D6` | links, focus ring, info dots, chart series 1, selected-range fill edges |
| `--accent-ink` **new** | `#2652B8` | link text on tints, avatar text |
| `--accent-tint` **new** | `#EAF0FB` | selected range days, accent icon chip, avatar background |
| `--bg-page` | `#F6F7F9` | app page and sidebar background |
| `--bg-card` | `#FFFFFF` | cards, fields, menus |
| `--bg-subtle` | `#F4F6FA` | inset rows ("+3 more"), field fill in popovers, segmented tracks on white |
| `--bg-sunken` **new** | `#F1F4F9` | kbd chips, code, empty chart tracks |
| `--row-hover` **new** | `#F7F9FC` | list/queue row hover |
| `--table-row-hover` **new** | `#FAFBFD` | table row hover |
| `--fill-hover` | `rgba(11,31,59,.05)` | ghost buttons, nav hover, icon buttons |
| `--fill-selected` | `rgba(11,31,59,.045)` | segmented-control track, tab track |
| `--line` | `rgba(11,31,59,.06)` | hairlines, table separators, card ring |
| `--line-strong` | `rgba(11,31,59,.09)` | outline (secondary) buttons, inputs at rest |
| `--line-control` **new** | `rgba(11,31,59,.07)` | search field / icon button ring |
| `--focus-ring` | `#2F64D6` | 2 px outline, 2 px offset |
| `--scrim` | `rgba(11,31,59,.32)` | modal/drawer backdrop |
| `--material-bar` | `rgba(246,247,249,.72)` | frosted top bar |
| `--material-float` | `rgba(255,255,255,.86)` | menus over content, toasts |
| `--material-blur` | `saturate(180%) blur(20px)` | |
| `--hero-gradient` **new** | `linear-gradient(135deg,#F1F5FD 0%,#F4F7FC 50%,#EEF8F4 100%)` | Home hero only |
| `--hero-glow` **new** | `radial-gradient(closest-side, rgba(47,100,214,.10), transparent)` | 420 px circle, top-right of hero |
| `--surface-on-tint` **new** | `rgba(255,255,255,.82)` | KPI strip and goal card inside the hero |

#### 3.1.4 Status (light translucent system; `data-ow-tone`)
The product already renders statuses with `[data-ow-tone]` (dot + tinted pill). Re-point its tokens:

| Tone | `--st-*-bg` | `--st-*-fg` (text) | `--st-*-dot` | Meaning |
|---|---|---|---|---|
| `risk` | `rgba(217,54,74,.07)` | `#B4303F` | `#E0566A` | late, at risk, rejected, failed, blocked |
| `warn` | `rgba(232,150,15,.09)` | `#8F5E06` | `#E8A33A` | due today, waiting, possible clash, needs feedback, slowest |
| `good` / `done` | `rgba(16,185,129,.08)` | `#0F7A58` | `#2BC08F` | cleared, joined, paid, approved, live |
| `info` | `rgba(47,100,214,.07)` | `#2D5BC0` | `#5B86E0` | confirmed, scheduled, on track, in progress |
| `review` | `rgba(124,108,224,.08)` | `#5B4BC0` | `#9183E6` | in review, interviewing, offer to approve, Kairo-suggested |
| `neutral` | `rgba(11,31,59,.05)` | `#3D4B63` | `#9AA6BA` | draft, paused, closed, sourced |

Pill anatomy: height 24 px (22 in dense tables and timelines), padding `0 10px 0 8px`, gap 6, radius 999, 12 px / 500, 6 px dot. Never place two pills of different tones side by side in a row. If a row needs two states, the second one is plain `--text-3` text.

#### 3.1.5 Icon chips (category colour for icons only)
| Chip | Background | Icon | Typical use |
|---|---|---|---|
| blue | `#EAF0FB` | `#2F64D6` | jobs, open positions, info tasks |
| teal | `#E3F5F4` | `#11807C` | submissions, sends |
| iris | `#EFEDFB` | `#5B48C2` | interviews, Kairo |
| green | `#E2F7F0` | `#0E7A57` | placements, money in |
| amber | `#FCF0DE` | `#9A6200` | due today, approvals waiting |
| rose | `#FBEBEF` | `#B23A5C` | overdue, backouts |

Queue and task icon tiles use the **status** tone tint (`--st-*-bg`) with `--st-*-fg` icons, so they stay as light as the pills.

#### 3.1.6 Stage ramp (hiring journey; "the Thread")
`--stage-1:#3B5CB8; --stage-2:#2F6BD0; --stage-3:#2786C8; --stage-4:#1E9CB5; --stage-5:#16AA98; --stage-6:#10B981;` Bars and dots render at **opacity .7**. The slowest stage is overridden with `--st-warn-dot` (`#E8A33A`).

#### 3.1.7 Kairo (intelligence agent)
| Token | Value |
|---|---|
| `--kairo-gradient` | `linear-gradient(135deg,#7C6CE0,#D46A86)` (launcher only) |
| `--kairo-surface` | `linear-gradient(140deg,#F3F0FD,#FBF1F4)` (Kairo cards and notes) |
| `--kairo-ink` | `#5B48C2` (icon, link) |
| `--kairo-label` | `#5B4A7A` (small labels on Kairo surface) |
| `--kairo-shadow` | `0 16px 30px -12px rgba(124,108,224,.6)` |

Kairo is presented as an agent ("Kairo found…", "Kairo sent…"), never as "AI". Every element Kairo adds keeps its existing `data-agent` hook, so the agents-off switch (`OONTU_AGENTS=false`) still removes all of it.

#### 3.1.8 Chart palette: see §9.1.

#### 3.1.9 Avatars
Initials avatars use the icon-chip pairs (blue, teal, iris, green, amber, rose), assigned by a stable hash of the person id. Size 28 (tables), 26 (stacks, with a 2 px surface-coloured ring), 32 (rows), 42 (top bar, radius 12). Photos keep their existing provenance UI.

#### 3.1.10 Eye Comfort theme (`html[data-theme="comfort"]`, existing optional dark theme)
Re-point the same tokens. `--bg-page:#0E1626; --bg-card:#15203A; --bg-subtle:#1A2744; --bg-sunken:#111B30; --row-hover:#1A2744; --text-1:#E6EBF5; --text-2:#C3CCDD; --text-3:#97A3BA; --text-4:#5F6B83; --line:rgba(230,235,245,.08); --line-strong:rgba(230,235,245,.14); --action:#E6EBF5; --on-action:#0B1F3B; --accent:#7FA3F0; --material-bar:rgba(14,22,38,.72)`. Status tints keep hue at roughly double alpha (`.14–.18`) with lighter text (`risk #F3A0AC`, `warn #F2C77F`, `good #6FDDB6`, `info #A9C1F5`, `review #BDB3F5`). Use the white logo variants. The hero gradient becomes `linear-gradient(135deg,#15203A,#14223B 50%,#13262A)`.

### 3.2 Typography
**Family:** `--font: Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif`. Load Inter 400, 500, 600 and 800 (800 for the wordmark text only). Self-host or Google Fonts with `display=swap`. **Mono:** `--mono: "JetBrains Mono", ui-monospace, monospace` (IDs, codes, tokens). Global `letter-spacing:-0.006em`, `-webkit-font-smoothing:antialiased`, `font-variant-numeric: tabular-nums` on every number column, KPI and stat.

| Role | Size / line | Weight | Tracking | Colour |
|---|---|---|---|---|
| Display (Home greeting, auth headline) | 32 / 38 | 600 | -0.035em | `--text-1` |
| Page title (all other screens) | 24 / 30 | 600 | -0.025em | `--text-1` |
| Section title (card h2) | 18 / 24 | 600 | -0.015em | `--text-1` |
| Card/sub-section title | 15 / 20 | 600 | -0.01em | `--text-1` |
| KPI value | 28 / 32 | 600 | -0.035em | `--text-1` |
| Inline stat value | 22–26 / 26–30 | 600 | -0.03em | `--text-1` |
| Stage count (Thread) | 24 / 28 | 600 | -0.03em | `--text-1` |
| Body / row title | 14 / 20 | 500 (titles), 400 (body) | — | `--text-1` / `--text-2` |
| Lead paragraph (hero summary) | 15 / 23 | 400 with 600 emphasis | — | `--text-2` |
| Secondary / control text | 13 / 18 | 400–500 | — | `--text-2` / `--text-3` |
| Meta, captions, group labels, pills | 12 / 16 | 400–500 | — | `--text-3` |
| Micro (axis, kbd, calendar weekday) | 11 / 14 | 400–500 | — | `--text-3` |

Rules: only weights 400/500/600. Above 24 px use 600. Below 14 px use 600 only for numbers inside stats. No italics except quoted candidate or client text. Truncate single-line titles with an ellipsis plus a `title` attribute. Clamp descriptions with `-webkit-line-clamp` (2 in cards, 3 in Kairo notes).

### 3.3 Spacing
Base unit 2 px; use this scale only: `2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 40, 48, 64`.
| Token | Value | Use |
|---|---|---|
| `--gap-grid` | 22 px | between cards and columns on dashboards |
| `--gap-stack` | 14–18 px | between blocks inside the hero, between title and content |
| `--pad-card` | 20 px 22 px (small), 22 px 24 px (standard) | card padding |
| `--pad-hero` | 26 px | hero padding |
| `--row-h-queue` | 60 px | Needs-you / task rows |
| `--row-h-table` | 64 px (two-line), 52 px (single-line), 44 px (dense) | tables |
| `--row-h-timeline` | 64 px | Today/Interviews rows |
| `--row-h-list` | 34 px | breakdown lists (Submissions status rows) |
| `--pad-page` | 0 32 px 72 px 12 px (desktop), 0 24 px 64 px (tablet), 0 16 px 88 px (mobile) | main column (bottom leaves room for the Kairo launcher) |

### 3.4 Radius
`--r-xs:6px` (kbd, tiny swatches) · `--r-sm:9px` (32 px icon buttons, chips in calendar) · `--r-control:12px` (inputs, search, 42 px icon buttons, nav items 11 → 12 allowed) · `--r-tile:14px` (rows, inset panels, icon tiles 36 px use 11) · `--r-panel:20px` (KPI strip, popovers, goal card, Kairo inner note) · `--r-card:22px` (cards, tables) · `--r-hero:26px` · `--r-modal:22px` · `--r-sheet:28px` (mobile sheets, top corners) · `--r-pill:999px`.

### 3.5 Borders and elevation
Separation comes from a ring (`box-shadow: 0 0 0 1px`) rather than CSS borders, so it never shifts layout.
| Token | Value | Use |
|---|---|---|
| `--elev-card` | `0 0 0 1px rgba(11,31,59,.05), 0 10px 30px -18px rgba(11,31,59,.18)` | every card/table |
| `--elev-on-tint` | `0 0 0 1px rgba(255,255,255,.9), 0 8px 24px -18px rgba(11,31,59,.25)` | white surfaces inside the hero gradient |
| `--elev-control` | `0 0 0 1px rgba(11,31,59,.07)` | search, inputs, icon buttons, workspace card |
| `--elev-thumb` | `0 1px 2px rgba(11,31,59,.10)` | segmented thumb, selected tab |
| `--elev-nav-active` | `0 0 0 1px rgba(11,31,59,.06), 0 2px 6px -3px rgba(11,31,59,.12)` | active sidebar item |
| `--elev-rail-active` | `0 8px 18px -10px rgba(11,31,59,.55)` | navy rail tile |
| `--elev-popover` | `0 0 0 1px rgba(11,31,59,.06), 0 30px 60px -20px rgba(11,31,59,.35)` | popovers, menus, date picker, command palette |
| `--elev-modal` | `0 0 0 1px rgba(11,31,59,.06), 0 40px 80px -24px rgba(11,31,59,.40)` | modals, drawers |
| `--elev-kairo` | `var(--kairo-shadow)` | launcher |
| `--hairline` | `1px solid var(--line)` | table and list separators, card footers |

### 3.6 Opacity
`.04` hover tint · `.05` neutral fills/rings · `.07–.09` status tints · `.10–.12` chart fills and value tags · `.7` stage bars and sparklines · `.72/.82/.86` materials · `.9` chart lines · `.32` scrim · disabled controls `opacity:.45` + `cursor:not-allowed` (not colour swaps).

### 3.7 Layout
| Token | Value |
|---|---|
| `--sidebar-w` | 248 px |
| `--sidebar-rail` | 76 px |
| `--topbar-h` | 70 px (14 px padding + 42 px controls) |
| `--page-max` | 1280 px (content column, centred) |
| `--read-max` | 720 px (settings forms, legal, long text) |
| `--grid` | 12 columns; dashboards use 3 equal columns (`2 + 1` spans) |
| Card heights (desktop) | Needs you / Today 520 · Submissions 470 · Kairo 214 · Where time goes 234 · Jobs table body 5 rows × 64 |

### 3.8 Breakpoints
| Name | Range | Shell |
|---|---|---|
| `xs` small mobile | < 380 | top bar + off-canvas sheet nav; single column; 16 px gutters |
| `sm` mobile | 380–767 | same, 16 px gutters |
| `md` tablet | 768–1023 | rail (76 px) by default, expandable as an overlay; 2 columns |
| `lg` laptop | 1024–1279 | rail or expanded (remembered); dashboard 2 columns, Today under Needs you |
| `xl` desktop | 1280–1535 | expanded by default; 3-column dashboard |
| `2xl` large | ≥ 1536 | same, content max 1280 centred; tables may go to 1440 |

### 3.9 Motion tokens
| Token | Value | Use |
|---|---|---|
| `--ease-out` | `cubic-bezier(.2,.8,.2,1)` | popovers, menus, tooltips, pills |
| `--spring` | `cubic-bezier(.16,1,.3,1)` | sidebar width, sliding selection, sheets |
| `--ease-in` **new** | `cubic-bezier(.4,0,1,1)` | exits |
| `--t-instant` | 120 ms | hover colour, label fade-out, press |
| `--t-fast` | 200 ms | tooltips, menus, tab content cross-fade, view leave |
| `--t-base` | 280 ms | sidebar width, drawers in, date popover, view enter |
| `--t-glide` | 350 ms | sliding selection pill / segmented thumb (keeps the existing test value) |
| `--t-slow` | 500 ms | chart draw-in, number count-up (max) |
| `--stagger` | 40 ms | list item entrance (first 8 items only) |

---

## 4. Global application shell

### 4.1 Structure and scroll architecture
```
#app  (display:flex; height:100vh; overflow:hidden)
├── aside#sidebar        height:100%; flex:0 0 var(--sidebar-w|--sidebar-rail); own scroll for #sidebar-nav only
└── div.app-column       flex:1; min-width:0; display:flex; flex-direction:column; height:100%
    ├── header#topbar    position:sticky inside the column; height:var(--topbar-h); material bar
    ├── #verify-banner-root
    └── main#main-content  flex:1; overflow-y:auto  ← THE ONLY page scroller
```
- Exactly **two** scroll containers: `#main-content` (page) and `#sidebar-nav` (nav list, only when it overflows). `html`/`body` do not scroll while the app is shown (`overflow:hidden`). Card-internal scrollers (Needs you, preview panes, tables wider than the viewport) are allowed and must use `overscroll-behavior:contain` so they never scroll the page or the sidebar.
- The sidebar header (logo + toggle) and footer (workspace/account) are fixed inside the sidebar. Only the nav list between them scrolls, with a 16 px fade mask at the edges when scrolled.
- The top bar does not scroll. When `#main-content` has scrolled more than 4 px, add class `is-scrolled` to the top bar, which adds a hairline (`0 1px 0 var(--line)`). A scroll-timeline is allowed where supported, with the class as the fallback.
- Keep the existing per-view scroll memory (`scrollCache`) working: it already reads and writes `#main-content.scrollTop`.
- `#main-content`: `scroll-behavior:smooth` (disabled under reduced motion), `overscroll-behavior-y:contain`, thin overlay scrollbar (transparent until the column is hovered; thumb `rgba(11,31,59,.18)`, 10 px track, 3 px transparent border).

### 4.2 Sidebar: expanded (≥ 1024 px default; state remembered)
Width 248, background `--bg-page`, no border, padding `20px 16px 16px`, vertical gap 20.

1. **Header (height 44):** approved `oontu-wordmark.svg` at 112 px wide, left-aligned with the nav icon column (x = 28 px). The collapse toggle (34 px ghost, radius 10, "sidebar" icon) sits at the right, visible at 0.6 opacity at rest and 1 on sidebar hover or focus-within. Tooltip: "Collapse sidebar · Ctrl \". Keep `#sidebar-toggle-btn`, `.sb-toggle`, `toggleSidebar()`, `Ctrl/⌘+\` and `localStorage["oontu.sidebar"]`.
2. **Workspace card (height 52):** white, radius 14, `--elev-control`. Contains a 32 px initials tile (radius 10, `linear-gradient(135deg,#2F64D6,#10B981)`, white 12/600), the workspace name 13/500 (ellipsis), a subline 12 `--text-3` (person · role label, e.g. "Priya Sharma · Recruiter") and an up/down chevron. It is the existing `#role-trigger` and opens the existing `#role-menu` (View as…, Your settings, Restart onboarding, Sign out). Keep every id and handler. (This replaces the bottom "o-sb-account" card position. The menu content is unchanged.)
3. **Navigation (`#sidebar-nav`):** groups from the existing `NAV_LAYOUT` / `AGENCY_NAV_LAYOUT` (same groups, labels and order; see §5). Group label 12/500 `--text-3`, sentence case, margin `0 0 6px 12px`. Blank-label groups get 8 px spacing only. Groups are 18 px apart.
   - Item: height 38, radius 12, padding `0 12px`, gap 12, icon 18 px stroke 1.6, label 14/400 `--text-2`, count right-aligned 12 `--text-3` tabular (only when the existing `count()` returns > 0).
   - Hover: `--fill-hover`. Active: white, `--elev-nav-active`, label `--text-1` 500, icon `--text-1`. The active background is the existing **sliding selection pill** (`.o-pill` with `positionNavSel()`), restyled to white plus `--elev-nav-active`, gliding with `--t-glide` `--spring`.
   - Urgent counts (`urgent:true` items such as Interviews and Approvals): the count gets `--st-risk-fg` colour and a 6 px dot before it, with no badge.
   - Fold groups (`collapsible` / `fold`, e.g. Owner "Insights" and "More"): header row with a chevron rotating 90° (`--t-fast`). The existing open/closed memory (`localStorage["oontu.navGroups"]`) and auto-open-on-navigate stay.
4. **Footer (pinned):** Settings item where the layout puts it last (existing order), then nothing else. The Oontu brand is already in the header.

### 4.3 Sidebar: collapsed rail (76 px)
- Header: approved `oontu-mark.svg` 32 px (keep class `.sb-logo-mark`; the test expects 32 px height). Hovering or focusing the mark swaps it for the expand icon (existing `.sb-rail-btn` behaviour).
- Workspace: a 40 px initials tile (radius 12, gradient). Same `#role-trigger` behaviour; the menu opens to the right.
- Items: 44 × 44 centred icon buttons (radius 13, icon 19 px), 4 px apart; groups separated by a 24 px hairline (`--line`), not by labels.
- **Active:** navy tile `--brand-navy`, white icon, `--elev-rail-active`. The sliding pill animates between rail positions too.
- **Pending indicators (no numbers):**
  - If `count() > 0` and the item is `urgent`, show a 7 px dot `--st-risk-dot` at the top-right of the icon (9 px inset) with a 2 px `--bg-page` ring and a soft ping ring (2.4 s, opacity .7 → 0, scale .6 → 1.6). Under reduced motion there is no ping.
  - If `count() > 0` and the item is not urgent, show the same dot in `--accent` with no ping.
  - If the count is 0, show nothing. Never more than one dot per icon. Dots never overlap the icon stroke.
- **Tooltips** on hover *and* keyboard focus: dark navy (`#0B1F3B`, white 12/500, radius 8, padding `6px 10px`), 12 px to the right, vertically centred, `--t-fast` fade and 4 px slide. Text: "Label", or "Label · N pending" / "Interviews · 4 today" using the item's existing count semantics. The same text is the button's `aria-label`.
- **Goal ring (optional, §2.4-4):** 36 px ring above Settings, only if a target exists.
- Bottom: Settings (44 px), then the expand button (44 px ghost, `.sb-rail-btn`).

### 4.4 Collapse and expand motion (ChatGPT-quality)
- **Collapse:** (1) labels, counts, group labels and workspace text fade to 0 over `--t-instant` (no reflow because the text is `white-space:nowrap` inside a fixed-width inner box); (2) the sidebar width animates 248 → 76 over `--t-base` `--spring`; the main column resizes in the same frame; (3) icons stay on a fixed 28 px x-axis during the whole transition (inner content is left-anchored at fixed padding, so icons never jump); (4) dots fade in after the width settles (`--t-fast`).
- **Expand:** width 76 → 248 (`--t-base` `--spring`), then labels fade in over `--t-fast`, with a 60 ms delay so text never squashes.
- The selection pill re-measures once at the end (existing `setTimeout(positionNavSel, …)`, set to 300 ms).
- No content flicker: charts and tables in the main column listen to a `ResizeObserver` and re-layout once at the end (debounced 120 ms).
- Reduced motion: no width animation; switch instantly.

### 4.5 Top bar (`#topbar`, 70 px, frosted)
Left to right (desktop):
1. Mobile menu button (only < 768), back button (`#topbar-back-btn`, when history exists).
2. **Page title** `#topbar-title` 15/600 `--text-1` with `#topbar-date` 13 `--text-3` after a middle dot. **Hidden on Home screens**, which show the large greeting instead. Keep `#topbar-subtitle` (hidden) and `#org-verify-slot`.
3. **Search field** (§4.6), 42 px, `flex:0 1 440px`.
4. Spacer.
5. **Period control** (§8.10): only on screens that already have a period filter or are Home dashboards. It sits in this corner slot.
6. **Primary action** of the screen/role (existing `ROLE_META.quickAction` or the screen's main create action), navy pill 42 px. At most one primary action in the top bar.
7. `#ws-pill-slot` (setup progress), unchanged.
8. Messages (`#topbar-msg`) and Notifications (`#topbar-bell` + `#topbar-bell-dot` 7 px `--st-risk-dot` with a 2 px white ring): 42 px icon buttons, radius 12, white, `--elev-control`.
9. Avatar 42 px (radius 12, initials chip). Opens the same account menu as the workspace card.

Material: `--material-bar` + `--material-blur`; it spans the full main column (negative margins match `--pad-page`). Inner content aligned to `--page-max`.

### 4.6 Search entry point
- **Remove the standalone search button from the top of the sidebar** (`#sidebar-search` / `.o-sb-search`). Search lives in the top bar as a calm field ("Search candidates, jobs, clients" with a `⌘K` / `Ctrl K` chip). Clicking it, focusing it or pressing ⌘/Ctrl+K calls the existing `openGlobalSearch()`, which opens the existing global search / command palette (`#global-search-root`, `#command-palette-root`) with all its intent parsing, saved searches, type filters and keyboard navigation unchanged. Keep the `#sidebar-search` id on the new top-bar trigger (or alias it) so existing code and tests that call or query it keep working. Record this in the report.
- Collapsed rail: no search icon (the top-bar field is always visible).
- < 768: the field becomes a 42 px icon button that opens the same palette full-screen as a sheet.
- Palette styling: centred 640 px panel, radius 20, `--elev-popover`, material float, input 48 px 16/400, results rows 44 px with type chips (§3.1.5), highlighted row `--row-hover` with a 2 px accent left edge, footer hint row 12 `--text-3` ("↑↓ to move · ↵ to open · Esc to close").

### 4.7 Kairo launcher (`#ai-fab-container`)
Fixed bottom-right, 28 px from the edges (desktop), 16 px + safe-area (mobile). Pill 52 px with `--kairo-gradient`, white 14/500 "Ask Kairo" and an icon, `--elev-kairo`. Above 1280 px it never overlaps card content, because `--pad-page` bottom is 72. Hidden when agents are off (existing `oApplyAgentFlag`). The chat panel (`#kairo-chat-root`) is a 400 × min(640, 80vh) panel, radius 22, `--elev-modal`, header on `--kairo-surface`.

### 4.8 Responsive shell
| Range | Sidebar | Top bar | Main padding |
|---|---|---|---|
| ≥ 1280 | expanded (or rail if remembered) | full | `0 32px 72px 12px`, content max 1280 |
| 1024–1279 | remembered state | full; primary action may shorten to its icon + tooltip | `0 24px 72px 8px` |
| 768–1023 | rail by default; expanding overlays content as a 248 px panel with `--scrim` | search shrinks to 280 px | `0 24px 64px` |
| < 768 | hidden. `#mobile-sidebar-toggle` opens it as a left sheet (`.mobile-open`, 86vw max 320, radius `0 22px 22px 0`, scrim) | 56 px: menu · wordmark (flat, 96 px) · search icon · bell · avatar. Period control moves under the page title as a full-width segmented row | `0 16px 88px` |

Touch targets ≥ 44 × 44 below 1024 px. Close the mobile sheet on navigation (existing `closeMobileSidebar()` in `showView`).

---

## 5. Role inventory

Roles that exist in the product (`state.role`, `ROLE_META`, `CUSTOM_ROLES`, `orgType`). **Permissions, menus and homes are computed by existing code (`NAV_LAYOUT`, `AGENCY_NAV_LAYOUT`, `NAV_ITEM_ACCESS`, `navItemAllowed`, `homeFor`, `filterNavForOrgType`, `filterNavForAgents`, `filterNavForPermissions`). The redesign restyles them and must not edit their logic.** The orders below are the ones the existing `tests/sidebar.spec.js` asserts.

### 5.1 Agency workspace (`orgType` ≠ Corporate)
| Role | Home (default view) | Sidebar (groups → items, in order) | Notes |
|---|---|---|---|
| **Recruiter** (`recruiter`; also any custom role scoped to own journeys) | `dashboard` | · Home, To do · **Hiring**: Jobs, Candidates, Interviews, Clients · **Outreach**: Cowork, LinkIt · **Insights**: Intelligence, PayTrack · Settings | Counts: Jobs (mapped active), Interviews (urgent), To do |
| **Recruiter Manager** (`manager`; team scope) | `manager-dashboard` | · Home, Approvals, To do · **Hiring**: Jobs, Candidates, Interviews, Clients · **Outreach**: Cowork, LinkIt · **Insights**: Intelligence · **Workspace**: Team · Settings | "View as recruiter" banner (`manager-recruiter-detail`, mirrored dashboards) |
| **Owner** (`admin`; locked Super Admin role) | `admin-dashboard` | · Home, Approvals, Tasks · **Hiring**: Jobs, Candidates, Interviews, Clients · **Outreach**: Cowork, LinkIt · **Money**: Revenue, PayTrack · **Insights** (folded): Reports, Analytics, Org productivity, Intelligence · **Workspace**: Team, Settings | Corporate-only items (Requisitions, Vendors, Marketplace, Contract hiring) appear only where plan gates (`NAV_PLAN_GATES`) and org type allow |
| **Custom roles** (`CUSTOM_ROLES`, Settings › Roles) | from `homeFor()`: admin-dashboard / manager-dashboard / admin-paytrack / dashboard | `AGENCY_NAV_LAYOUT` filtered per permission | Finance-only roles land on PayTrack |
| **Client contact** (no login) | secure link `#/l/<token>` | none (outside-app page, §7.14) | shortlist, hold, reject, book |
| **Hiring Manager in agency** | not used (decision AR-3: agency clients use the review link) | — | — |

### 5.2 Corporate workspace (`orgType: 'Corporate'`)
Clients, PayTrack (agency), Revenue and payroll billing are hidden (`filterNavForOrgType`). Requisitions, Vendors, Marketplace and Contract hiring are shown under "Company hiring" where allowed.
| Role | Home | Sidebar |
|---|---|---|
| Owner / TA Head (`admin`) | `admin-dashboard` (corporate cards: "Hires this quarter", "Offer acceptance", no Revenue) | Home, Approvals, Tasks · Hiring (Jobs, Candidates, Interviews) · Company hiring (Requisitions, Vendors, Marketplace, Contract hiring, subject to plan gates) · Outreach · Insights · Workspace (exact output is whatever `renderSidebar()` produces; the test asserts Hiring stays first) |
| TA Recruiter (`recruiter`) | `dashboard` | Recruiter layout with Clients/PayTrack removed by `filterNavForOrgType`; Company hiring items appear only where `NAV_LAYOUT`/plan gates/permissions put them (verify by rendering) |
| Hiring Manager (`hm`) | `hm-dashboard` | · Recommended · **Your reviews**: Interviews, Feedback, Decisions · **Requisitions**: Jobs, Requisitions · Settings |
| Interviewer | secure link (scorecard) | none |
| Approver | Approvals screen, or one-tap from link | role-dependent |
| Vendor contact | `#/vendor` (email + one-time code) | vendor portal (outside app) |
| Employee | internal jobs / referrals (listed as built in `docs/role-wise-workflow-matrix.md`) | **Gap:** route not located during this audit. Claude Code must locate it and apply §7.14 |

### 5.3 Candidate (`candidate`)
Home `candidate-home`. Sidebar: · Home, Opportunities, Interviews · **Account**: My profile, Settings. Outside-app routes: `#/apply/<token>`, `#/consent/<token>`, `#/resume/…`.

### 5.4 Oontu platform (`oontu`, Oontu Super Admin)
Home `oontu-dashboard`. Sidebar: · Home · **Customers**: Tenants, Sign-ups, Help, Subscriptions · **Product**: Plans, Agents, Feature controls · **Operations**: Platform users, Notifications, Audit · Settings (`oontu-settings`).

### 5.5 Per-role experience rules
- Each role's Home uses the Home template (§7.1) with **its own existing content**; roles are not forced into one dashboard. The recruiter Home is the reference composition. Manager and Owner Homes keep their existing blocks (greeting, one Kairo note, three summary cards, "Needs your attention", "Today's interviews", team and money blocks) mapped onto the same template slots. HM, Candidate and Oontu Homes are mapped in §7.
- Empty states are per role and use the existing copy (§8.17).
- Every role gets the same shell, tokens and components; only the menu and content differ.

---

## 6. Module inventory

Routes are `showView()` view ids (keys of `RENDERERS`, 78 found) or hash routes for pages outside the app. "Issues" come from the 18 Nov audit of the prototype. "AC" points to §15. Every module gets the global treatment (tokens, shell, components). The columns below list what is specific to each.

| # | Module | Purpose | Routes (view ids) | Roles | Existing features to preserve | Current design issues | New visual treatment / component changes | Interaction changes | Responsive | AC |
|---|---|---|---|---|---|---|---|---|---|---|
| M1 | **Home** | daily command centre per role | `dashboard`, `manager-dashboard`, `admin-dashboard`, `hm-dashboard`, `candidate-home`, `oontu-dashboard` | all | greeting, Kairo note, summary cards, Needs your attention, Today's interviews, approvals preview, team/money blocks, setup progress, corporate variant cards, saved filters, `dashDateFilter` | every role's Home has the same shape; every block is a white card; too many row buttons compete; nothing shows the whole hire end to end; pale grey charts | T1 Home template (§7.1): hero (greeting + goal/summary + period caption + KPI strip + the Thread), then the 3-column grid (Needs you · Today · Submissions · Kairo · Where time goes · Open positions) using each role's existing blocks | period control in top bar; Status/Trend switch; tabs in Needs you; aligned rows with always-visible light actions | §7.1.9 | AC-1 |
| M2 | **Tasks / To do** | personal and team task queues | `my-todo`, `manager-todo`, `all-tasks` | recruiter, manager, owner | personal tasks, follow-ups, Kairo tasks, completion, SLA | dense lists, mixed button styles | T2 list using the Needs-you row grid (icon · task · due · action) with group headings (Overdue · Today · This week · Later) | complete with check + undo toast; filters as segmented control | single column; action becomes a trailing icon button < 768 | AC-2 |
| M3 | **Jobs** | requisitions/jobs pipeline | `jobs`, `job-detail`, add-job drawer (`openAddJobDrawer`), job-creation flow (`jcStage`), `hm-jobs`, `hm-job-create` | recruiter, manager, owner, hm | ownership rules, mapping, publishing, applicants, pipeline, Kairo matches, job intake/parse, talent preview, pay fit | heavy cards, uppercase overlines, many pills per row | T2 table (Open-positions spec §8.9) with pipeline segment bar; T3 detail with header strip + tabs; T4 wizard for creation | row hover "⋯"; bulk select with a floating action bar | table → stacked rows < 768 | AC-3 |
| M4 | **Candidates / Talent pool** | search, lineup, prospects, profiles | `talent-pool`, `candidate-search`, `advanced-search`, candidate profile (drawer/page), `li-lists-hub` | recruiter, manager, owner | lineup/prospects/add/search tabs, enrichment, duplicate detection, identity engine, photo provenance, results screen with preview panel, saved searches, 50-row paging | multiple style generations (`--rf-*`, `--oa-*`), mixed grey/brown tints | T6 split list + preview (results), T2 lists, T3 profile; match % as plain number + 4 px bar (`--accent` at .7) | keyboard ↑↓ in results; preview cross-fade | preview becomes a bottom sheet < 1024 | AC-4 |
| M5 | **Interviews** | schedule, day/month views, issues | `interviews`, `hm-interviews`, `candidate-interviews`, schedule/reschedule modals, interview detail sheet, secure interviewer links | recruiter, manager, owner, hm, candidate | `interviewIssues`, day & month views, "needs you" column, clash detection, reschedule, secure links, scorecards | timeline rhythm inconsistent | T7 calendar/timeline: week strip (§8.12), 64 px timeline rows with status ring + pill; month grid with 4 px day dots | drag none (unchanged); click → detail sheet | day list only < 768 | AC-5 |
| M6 | **Clients** | client accounts, terms, money | `client-management`, `client-detail`, `client-new` | manager, owner (recruiter: view where allowed) | fee by CTC slab, per-job fees, ownership window, revenue target, map pins, contacts, GST/tax engine, approval policy, duplicate check | dark fills in places, dense terms | T2 list (calm, detail on hover), T3 account (strip + Overview/Contacts/Terms/Documents tabs), T4 full-page form | — | tabs scroll horizontally < 768 | AC-6 |
| M7 | **Approvals** | SLA approval queue | `approval-center` (+ Settings › Approval rules) | manager, owner, approvers | APS engine, three views, Kairo lanes, selection, undo, right preview panel, phone card, SLA clock | header numbers + lanes compete | T6 queue + preview; header stat strip (§8.6); one-tap approve (good) / send back (risk) icon buttons 32 px | selection with keyboard; undo toast | preview → sheet | AC-7 |
| M8 | **Submissions & hiring pipeline** | submit, duplicate, offer, joining | submit modal, duplicate modal, offer modal, joining-date modal, follow-up modal, split-proposal modal, pipeline tabs in job detail | recruiter, manager, owner | single canonical write, duplicate window, reason codes, offer band check, joining, follow-ups | modal styles vary | §8.14 modal spec; statuses via `data-ow-tone` (§3.1.4) | primary/secondary order fixed (secondary left, primary right) | modals become sheets < 768 | AC-8 |
| M9 | **Cowork (Kairo agents)** | agents, campaigns, workflows | `kairo-team`, `cowork-campaign`, `cowork-campaign-new`, `cowork-workflow` (aliases `agents`, `workflow-studio`, `workflow-wizard`), legacy `workflow-builder` | recruiter, manager, owner (permission `kairo › Use agents`) | five agents (Talent Discovery, Engagement, Interviews, Offer & Joining, LinkedIn outreach add-on), Agents/Activity tabs, campaigns with plan, workflow builder Simple/Advanced, drafts/publish/versions, test runs, kill switch | "Automation not found" when `workflow-builder` opens without an id | T3 hub with agent rows (status pill, last activity, signals), T4 campaign page (six cards + plan), **flow map** spec §10 | empty-state for missing workflow id (§10.8) | single column | AC-9 |
| M10 | **LinkIt** | LinkedIn/WhatsApp/email inbox and lists | `li-uni-box`, `li-lists-hub`, `linkit-wizard` | recruiter, manager, owner | unified inbox, channels, lists, wizard | channel colours loud | T6 inbox (list + thread); channel identified by a 16 px brand glyph only, no coloured fills | — | list ↔ thread push navigation < 768 | AC-10 |
| M11 | **Intelligence** | coach: bottlenecks, risk, drop-off | `intelligence` | all agency staff with reports view | bottlenecks, pipeline risk, drop-off, "indicative" labels | gauges imply precision | T2/T1 hybrid: insight rows with one number each, horizontal bars (§9), "Indicative" `neutral` pill kept | — | — | AC-11 |
| M12 | **Reports & analytics** | funnel, recruiter analytics, productivity | `reports`, `recruiter-analytics`, `admin-recruiters` | owner, manager (scope all) | funnel, recruiter score, filters, exports | pale grey charts | charts per §9; KPI strip; tables §8.9 | period control in top bar where a period filter exists | charts full-width, legends wrap | AC-12 |
| M13 | **Money** | revenue, placements, invoices, contract staff | `admin-revenue`, `paytrack`, `admin-paytrack`, `payroll-billing`, PayTrack drawer, GST modal, contract & temporary staff (assignments, timesheets, invoices) | owner, finance roles, recruiter (own placements) | split credits, invoice states, guarantee windows, approved-time-only invoicing | money states use brown/amber text | amounts tabular 600; states via tones (Due = warn, Overdue = risk, Paid = good, Draft = neutral); "Get paid" green used only for paid/invoice-ready | — | tables → stacked rows | AC-13 |
| M14 | **Team** | members, performance, roles | `manager-team`, `manager-recruiter-detail`, `team-members`, `user-management`, member modal/drawer | manager, owner | invites, roles, handover, view-as-recruiter, productivity | — | T2 table with avatar, role pill (neutral), status; T3 member detail | view-as banner restyled as an `info` inline banner | — | AC-14 |
| M15 | **Settings & administration** | You / Workspace / Platform | `settings` (sections; old setup screens redirect via `SETTINGS_REDIRECT`), `setup-hub`, `roles-permissions`, `security-settings`, `master-data`, `org-structure`, `audit-center`, `feature-flags`, `scheduled-jobs`, `user-management`, `design-system` | all (by permission) | Settings v2 lean structure (max 3 tabs per section), approval chains, plan gates, appearance (Eye Comfort), legal centre links, demo data | long pages, mixed field styles | T5 settings: 240 px section list + content column max 720; fields §8.2; save bar sticky at bottom when dirty | — | section list becomes a top select / push list < 768 | AC-15 |
| M16 | **Company hiring (corporate)** | requisitions, vendors, marketplace, contract hiring | `requisitions`, `requisition-new`, `requisition-detail`, `vendors`, `vendor-detail`, `marketplace`, `contract-hiring` | corporate owner/TA/HM; agency owner/manager where plan allows | requisition approvals, vendor lifecycle, pick vendors per job, marketplace (domain experts first), work orders/timesheets | marketplace shows a corporate-only message to agency owners (copy/behaviour unchanged by this redesign; listed for the backlog) | T2 lists, T3 details, T4 forms | — | — | AC-16 |
| M17 | **Hiring Manager workspace** | review and decide | `hm-dashboard`, `hm-interviews`, `hm-feedback`, `hm-decisions`, `hm-jobs`, `hm-job-create` | hm | recommended candidates, feedback requests, decision history, job post wizard | — | T1 Home variant (Recommended as primary list), T2 lists, T4 wizard | — | — | AC-17 |
| M18 | **Candidate portal** | candidate self-service | `candidate-home`, `candidate-opportunities`, `candidate-interviews`, `candidate-profile-self` | candidate | applications, interviews, profile, availability | — | warm, simpler T1 (greeting + next step card + applications list); never shows internal scores | — | mobile-first | AC-18 |
| M19 | **Oontu platform** | tenants, plans, agents, ops | `oontu-dashboard`, `oontu-tenants`, `oontu-tenant-detail`, `oontu-signups`, `oontu-help`, `oontu-subscriptions`, `oontu-subscription-detail`, `oontu-plans`, `oontu-plans-detail`, `oontu-agents`, `oontu-feature-controls`, `oontu-platform-users`, `oontu-notifications`, `oontu-audit`, `oontu-settings` | oontu | create tenant, owner invite, incomplete sign-ups, assisted setup, agents catalog, kill switch, plan limits | — | same system; KPI strip + tables; kill switch is a `risk` confirm modal | — | — | AC-19 |
| M20 | **Authentication & onboarding** | sign in, sign up, verify, recover, invite, onboarding | `#/sign-in`, `#/sign-up`, `#/auth…`, `#/invite/<t>`, `#/assist/<t>`, onboarding (`#onboarding`), sign-up sheet, logout modal | everyone | workspace creation wizard, email verification, password strength, recovery, join requests, demo companies | busy radial gradients, old brand mark | T9 auth (§7.13) | — | single column | AC-20 |
| M21 | **Outside-app pages** | no-login pages | `#/l/<token>` (client review / interviewer), `#/hm/<t>`, `#/vendor`, `#/consent/<t>`, `#/time/<t>`, `#/time-ok/<t>`, `#/apply/<t>`, `#/resume/…`, `#/jobs` (Oontu jobs website), `#/legal/<doc>` | external people | secure links, one-time codes, scorecards, timesheets, consent, public jobs | each page styled separately | T8 standalone (§7.14) | — | mobile-first | AC-21 |
| M22 | **Global overlays** | cross-app tools | global search / command palette, notifications, messages, composer, Kairo chat, toasts, AI info, prospect picker, photo modal | all | everything | toast covers content | §8.13–8.16; toasts bottom-centre above the Kairo launcher, max 2 stacked | — | sheets < 768 | AC-22 |

**Not inspectable as a separate route in this audit (must be located and covered):** the Employee portal (corporate) and the integrations centre (`PAGE_TITLES.integrations` exists, no renderer; likely redirected into Settings). If a route cannot be found, record it as a gap in the completion report. Do not build it.

---

## 7. Screen-by-screen specifications

Every screen uses one of nine templates. Each template is fully specified here. Then every screen is listed with its template and the details specific to it. **Content (sections, fields, columns, buttons, copy) is whatever the screen has today.** The redesign changes arrangement and appearance, not substance. Where a template slot has no existing content on a screen, leave it out. Do not fill it.

### 7.0 Templates (shared rules)
- **Page header (all except Home):** title 24/600 `--text-1`, optional one-line description 14 `--text-3` (existing copy only), right side: max one primary (navy) + one secondary (outline) + overflow "⋯". Tabs below (§8.7), 20 px gap. No breadcrumb bar that repeats the title. Back navigation is the top-bar back button.
- **States on every data region:** loading = skeleton shaped like the content after 300 ms (§8.18); empty = §8.17; error = existing `errorStateHTML` restyled (§8.17); success = toast (§8.15). Long lists keep the existing "50 rows at a time" behaviour, styled as a quiet "Show 50 more" text button at the list foot.
- **Accessibility on every screen:** one `h1` (title or greeting), card titles are `h2`; landmarks `nav`, `main`, `header`; focus visible (§13); live regions for toasts (existing `#toast-container` `role=status`).

#### T1: Home dashboard. See §7.1 (full spec).

#### T2: List / table page
Header → toolbar row (search-in-list field 36 px radius 10 on `--bg-card` + `--elev-control`; filter chips (§8.8); segmented view switch; right: count text 13 `--text-3` and a sort select) → table card (§8.9) or list card. Bulk selection shows a floating action bar at the bottom centre (white, `--elev-popover`, radius 16, 52 px). Empty → §8.17.

#### T3: Detail page
Header strip: 48 px avatar/icon tile + title 24/600 + meta line (13 `--text-3`, middle-dot separated) + status pill + actions right. Below: tabs. Content: 2 columns at ≥ 1280 (main 2/3, side 1/3 with summary cards), 1 column below. Side cards are 214–260 px tall with the defined overflow rules.

#### T4: Form / wizard
Content max 720 (forms) or 2 columns (form 2/3 + live summary/preview 1/3 for job creation, campaigns and new client). Wizard progress: a 2 px line with step labels 12/500 (current `--text-1`, done `--text-3` with a check, upcoming `--text-4`). Sticky footer bar (material float, hairline top): secondary left, primary right. Field spec §8.2.

#### T5: Settings
Two panes: section list (240 px, items like sidebar items but 34 px) + content (max 720). Each section: title 18/600, description 13 `--text-3`, up to 3 tabs, then grouped field rows: label column 220 px / control column, 18 px row gap, hairline between groups. Danger zone: a `risk`-tinted inset panel, radius 14.

#### T6: Split list + preview
List (min 420, flex 1) + preview panel (440–520, sticky, own scroll with `overscroll-behavior:contain`). Selected row: `--row-hover` + 2 px `--accent` left edge. Preview cross-fades on change (`--t-fast`).

#### T7: Calendar / timeline
Week strip (§8.12) + timeline list or month grid. Month cell: date 13/500, up to 3 event lines (12 px, 4 px dot in status dot colour), "+N" overflow link.

#### T8: Standalone outside-app page
Top: 64 px header with `oontu-wordmark-flat.svg` 104 px (or the workspace name when the page is tenant-branded, with "Powered by Oontu" in the footer) on `--bg-card`. Body: one centred column max 640 (forms) / 960 (jobs website) on `--bg-page`. Footer: 12 px links (Legal), the flat wordmark 72 px.

#### T9: Auth
Background `--brand-warm-white` with one very soft radial (`rgba(47,100,214,.06)` top-left). Centred card 440 px, radius 22, `--elev-card`, padding 32. `oontu-wordmark.svg` 156 px above the card. Headline 32/600, sub 15 `--text-3`. Fields 44 px. Primary full-width navy pill 44 px. Wizard steps use the T4 progress line.

### 7.1 Home (T1): reference composition (Recruiter `dashboard`)
Grid inside `--page-max`: hero (full width), then a 3-column grid (gap 22).

**7.1.1 Hero** (`--hero-gradient` + `--hero-glow`, radius 26, padding 26, gap 20):
- Left (1.5fr): date line 14 `--text-3` with a 16 px sun/moon icon in `#C98A12` (morning/afternoon/evening per local time); greeting **32/600** "Good morning, {first name}."; one-sentence summary 15/23 `--text-2` built only from existing data (e.g. placements vs target, the latest cleared round); up to 3 summary chips (34 px, white 75%, ring `.06`, 7 px dot in the tone colour) that link to the filtered view (e.g. "3 need you now" → Needs you › Overdue).
- Right (minmax 300px, 1fr): goal card (`--surface-on-tint`, `--elev-on-tint`, radius 20, padding `20px 22px`), only if a target exists (§2.4-4): 76 px ring (stroke 7, gradient blue → green, track `#E3EAF6`) with "2/3" 18/600, title "Your {Month}", line "2 of 3 placements" 16/600, sub "12 days left · on pace" 13/500 `--st-good-fg`; "Your day" timeline: 2 px track `#E3EAF6`, elapsed part `--accent`, interview dots 10 px (done = filled green, upcoming = white with a tone ring), "now" marker 2 × 22 px navy, hour labels 11 px. Without a target the right column shows the "Your day" timeline alone.

**7.1.2 Period caption + scope:** a row with "**Last 7 days** · 12–18 Nov · compared with previous 7 days" (13 px, the range name in `--text-1` 500) and, on the right, the existing Mine/Team segmented control where the role has team scope (manager, owner).

**7.1.3 Period control** (top bar corner, §8.10): presets Today · Last 7 days · Last 30 days · This quarter · Custom range. Every number in the hero, KPI strip, Thread, Submissions and Where-time-goes recomputes. Lists (Needs you, Today, Open positions) are **not** filtered by period. It reuses and extends the existing `dashDateFilter` state, which today only shows a toast.

**7.1.4 KPI strip** (one surface, `--surface-on-tint`, `--elev-on-tint`, radius 20, padding `16px 0`, 4 columns separated by 1 px `--line` dividers, cell padding `4px 22px`, ~104 px tall): per cell, a 24 px icon chip (radius 7) + label 13/500 `--text-2`; value 28/600 + sparkline 88 × 28 (2 px, chip icon colour, opacity .75); footer line 22 px: either a delta (↑ 12 px arrow + "17%" 12/600 `--st-good-fg` + "vs 24 last week" 12 `--text-3`) or a tone pill ("1 at risk" risk, "of 3 goal" review). Recruiter cells: Open jobs · Submitted · Interviews · Placements (use the role's existing three or four summary cards; managers and owners keep their own set, e.g. corporate "Hires this quarter", "Offer acceptance").

**7.1.5 The Thread: "Your hires, end to end"** (card `--elev-card`, radius 22, padding `16px 16px 12px`):
- Header row: "Your hires, end to end" 15/600 + hint 12 `--text-3` "% between stages = how many move on" + "Open pipeline ›" link 13/500 right.
- Body grid: `repeat(6, 1fr)` with a 40 px connector column between stages. Stage cell (padding `8px 10px`, radius 12, hover `rgba(47,100,214,.05)`, click → the pipeline filtered to that stage): 7 px stage dot + label 12/500 `--text-2`; count 24/600; 4 px bar on a `rgba(11,31,59,.05)` track, width = count / first-stage count (min 4%), stage colour at .7; sub-line 12: time in stage "3.2 d here" (`--text-3`), the slowest stage in `--st-warn-fg` 500 "6.4 d · slowest" with an amber dot and bar, and Get paid in `--st-good-fg` 500 "₹4.2L to invoice". Connector: 14 px chevron `#9AA6BA` + conversion "62%" 11 `--text-3`.
- **Data mapping (existing statuses):** Find = sourced + applied + screening + not_*; Engage = ready + in_review + ready_to_send + with_client; Interview = shortlisted + interviewing; Approve = selected + offer_made; Hire = offer_accepted + joined; Get paid = placements with invoice-ready/paid state in PayTrack. If the product already has a helper that defines these stage groups (e.g. a Home funnel or Reports funnel), use that helper and record the mapping used. Time in stage = median of existing stage-entry/exit timestamps. If those don't exist, omit the time line (no fake numbers).

**7.1.6 Main grid** (3 columns; row 1: Needs you (span 2, 520 px) + Today (520 px); row 2: Submissions (span 2, 470 px) + a column of Kairo (214) and Where time goes (234); row 3: Open positions (span 3)).
- **Needs you** (`h2` 18/600; tabs All · Overdue · Today · This week with counts, segmented control 30 px): column header row (12 `--text-3`: "", Task, Due, Action) using the row grid `36px | minmax(0,1fr) | 118px | 104px`, column gap 16, padding `0 12px`; group headings (12/500 `--text-1` + count `--text-3` + a 1 px rule filling the rest); rows 60 px: icon tile 36 px (radius 11, tone tint, 16 px icon), title 14/500 (ellipsis) + meta 12 `--text-3`, due pill (left-aligned in its column), action button full column width 32 px (transparent, `inset 0 0 0 1px rgba(11,31,59,.09)`, 13/500; on row hover it turns white with a stronger ring). The body scrolls inside the card with a 28 px bottom fade. Footer: "14 tasks · scroll for more" + "Open To do ›". Tab-filtered views end with "That's everything for overdue." Actions call the existing handlers (Remind, Send, Confirm, Record, Draft, Call…).
- **Today** (`h2` "Today" + "Calendar ›"): week strip (§8.12); timeline rows 64 px: time 13/500 tabular (48 px column), 9 px ring dot (filled green when done) on a 1.5 px `--line` spine, name 14/500 + meta 12 `--text-3`, status pill 22 px. Shows at most 4 rows. The rest collapse into a "+N more after 6 pm" inset row (44 px, `--bg-subtle`, radius 12) with a 26 px avatar stack.
- **Submissions** (`h2` "Submissions", sub "Where every profile you sent stands now", Status|Trend segmented, "All ›"):
  - *Status view:* a 4-cell stat row (Submitted · Still moving · Client replied (rate, "avg 2.4 d to reply") · Backed out (count, top reasons from existing reason codes)) divided by 1 px rules; a 10 px stacked bar with 3 px gaps, radius 6, segments in the status palette (§9.1.3); two aligned columns: **Moving forward** (Awaiting client feedback = `with_client`, Shortlisted, Interviewing, Offered = `selected`+`offer_made`+`offer_accepted`, Joined) and **Dropped** (Rejected by client = `rejected_client`+`rejected_round`, Backed out = `backed_out`+`offer_declined`, On hold, Withdrawn). Each row (34 px, radius 10, hover `--row-hover`, click → filtered list): 8 px square dot · label 13 · count 14/600 right · % 12 `--text-3` right; column heads 12/500 in `--st-good-fg` / `--st-risk-fg` with totals. A Kairo note (`--kairo-surface`, radius 14, 3-line clamp, only with an existing Kairo signal) sits under Dropped. Footer row (hairline top): "{n} waiting on client feedback · oldest sent {age}" in `--st-warn-fg` + an outline "Remind clients" button using the existing reminder action, shown only if it exists for the role.
  - *Trend view:* caption (granularity · range) + legend stats (Submitted / Interviews / **Backed out**, each with total and comparison; the backout comparison is neutral `--text-3` "vs 1 last week", never a green arrow) + the area chart (§9.3) with three series.
- **Kairo overnight** (`--kairo-surface`, radius 22, padding `20px 22px`): 28 px white icon tile + "Kairo overnight" 15/600; 3 stats (22/600 + 12 `--kairo-label`); 2-line clamped note; link "See what Kairo did ›" `--kairo-ink`. Shows only existing Kairo activity. Hidden when agents are off.
- **Where time goes** (card 234): rows `70px | 1fr | 44px`: label 13, 8 px bar (stage colour, track = colour at 10%; slowest amber on `--st-warn-bg`), "6.4 d" 13/500. Header "Median days" 12 `--text-3`.
- **Open positions** (table §8.9): columns Position (title 14/500 + location 12) · Client · Owner (28 px avatar) · Pipeline (6 px segmented bar in the stage ramp + "24 people" 12) · Open ("9 d") · Status pill · "⋯". Mine/Team segmented + "All jobs ›". 5 rows per page, pagination (§8.11). On the last page, empty rows are replaced by "That's all 12 jobs · Post a new job ›".

**7.1.7 Role variants of T1**
| Screen | Hero | KPI strip | Thread | Grid slots |
|---|---|---|---|---|
| `dashboard` (Recruiter) | as above | Open jobs, Submitted, Interviews, Placements | own | Needs you (My work today: follow-ups, screening, interviews) · Today · Submissions · Kairo · Where time goes · Open positions (mine) |
| `manager-dashboard` | greeting + one Kairo note | existing three summary cards (+1 if present) | team scope | Needs your attention (incl. approvals) · Today's interviews · Submissions (team) · Team snapshot (existing) · Open positions (team) |
| `admin-dashboard` (Owner, agency) | greeting + Kairo note + setup pill | existing summary cards incl. revenue | all | Needs your attention · Today's interviews · Revenue/PayTrack summary (existing) · Clients block (existing `#own-clients-h`) · Open positions |
| `admin-dashboard` (Corporate) | same | "Hires this quarter", "Offer acceptance", … (existing) | all | as above, **no Clients table, no revenue** (tests assert this) |
| `hm-dashboard` | greeting | — (or existing counts) | — | Recommended candidates as the primary list (T6 rows with a match number) · Interviews to attend · Feedback requests |
| `candidate-home` | warm greeting, next step card | — | — | My applications (status pills) · Upcoming interviews · Profile completeness (existing) |
| `oontu-dashboard` | "Good morning" + platform summary | tenants, sign-ups, MRR/plan counts (existing) | — | incomplete sign-ups queue · notifications · audit highlights |

**7.1.8 Interaction:** stage cells, chips, status rows and KPI cells are links into existing filtered views. If no filtered view exists, the element is not clickable (no hover). Hover on cells: `--fill-hover`; press: scale .99 for 120 ms.

**7.1.9 Responsive:** ≥ 1280 as above. 1024–1279: hero right column moves under the left (goal card + day timeline side by side); the KPI strip stays 4 columns; the grid becomes 2 columns (Needs you full, then Today + Kairo, Submissions full, Where time goes + …). 768–1023: KPI strip 2 × 2 (dividers become a cross); the Thread becomes a horizontally scrollable row (snap per stage, 132 px min per stage). < 768: greeting 26/600; summary chips scroll horizontally; KPI strip 2 × 2; the Thread is a vertical list (stage · count · bar · conversion); every card is full width with heights released (`height:auto`) but internal limits kept (Needs you max 6 rows + "Open To do", Today max 4 + "+N"); Open positions renders as stacked rows (title, client · owner, status pill, pipeline bar).

### 7.2 Screen register (all remaining screens)
Format: **view id**, then template, then the screen-specific layout. States: L = loading, E = empty, Er = error. Hover/active follow the component specs. Responsive follows the template unless noted.

#### Tasks
- **`my-todo`**: T2. Header "To do" + "New task" (secondary). Segmented: All · Overdue · Today · This week · Done. List uses the Needs-you row grid (§7.1.6) at full width with an extra "Related to" column (job/candidate link, 13 `--accent-ink`) at ≥ 1280. Completing a task: the check animates (stroke-draw 200 ms), the row collapses (height → 0, 200 ms) and an Undo toast appears. E: "Nothing needs you right now" + the existing secondary link. L: 6 skeleton rows.
- **`manager-todo`**: as above + an "Owner" avatar column; the filter adds "Mine / Team".
- **`all-tasks`**: as `manager-todo` with an "All" scope; group headings by owner when sorted by owner.

#### Jobs
- **`jobs`**: T2. Header "Jobs" + primary "New job" (opens the existing add-job drawer / job creation). Toolbar: search, chips (Status, Client, Owner, Priority, Work mode), Mine/Team. Table columns per §7.1.6 Open positions plus Priority (tone pill only for High, as warn) and Applicants (count + Kairo badge if any). Row click → `job-detail`. Bulk: assign, pause, close (existing). E: illustration-free empty state with "New job".
- **`job-detail`**: T3. Header: briefcase tile (blue chip), title, meta "Client · Location · Work mode · ID" (ID in mono 12), status pill, actions (Edit, Publish/Share, ⋯). Tabs (existing): Overview · Pipeline · Applicants · Matches (Kairo) · Activity · Settings, whatever exists. **Pipeline tab:** horizontal stage columns (board, §8.20) or the stage list. Each candidate card is 72 px: avatar, name 14/500, current-stage age, a status pill only when not "normal". Side column (≥ 1280): Job summary card, Hiring team, Client contacts, Fee summary (permission-gated as today).
- **Job creation (`jcStage` flow) / add-job drawer**: T4 wizard in a right drawer (720 px) or full page as today. Steps keep their order and validation. The live summary panel on the right shows parsed fields and the talent preview (match count, pay-fit bar). JD parse animation: replace the scanline glow with a calm 2 px `--accent` progress line under the textarea + "Reading the job description…" 13 `--text-3`.
- **`hm-jobs`**: T2 list of the HM's requisitions/jobs; columns Title · Status · Candidates in review · Next interview.
- **`hm-job-create`**: T4 wizard (job post wizard), one question per step where it already works that way.

#### Candidates
- **`talent-pool`**: T2 with existing tabs Lineup · Prospects · Add · Search (segmented, sliding thumb). Lineup rows: 64 px, avatar 32, name + current role, best job match (number 14/600 + 40 px 4 px bar at `--accent` .7), journey status pill, last activity 12 `--text-3`, actions "⋯". Prospect picker and bulk add keep the floating action bar. Sticky list header (`.tp-head`) uses `--material-bar` instead of the lavender tint.
- **`candidate-search`** (results after search): T6. Left: result cards (radius 14, padding 14, ring `--line`, selected = accent edge) with name, role, location, key skills as 12 px quiet chips (`--bg-subtle`, `--text-2`), match number. Right: preview panel with profile header, match reasoning (matched skills = good tone chips, missing = neutral chips with strike-free "missing" label, bonus = info), availability, pay fit bar, actions (Submit, Add to job, Message). Highlights keep the existing `--hl-*` yellow marks, toned down to `rgba(232,163,58,.22)` exact and `.10` related.
- **`advanced-search`** ("Classic search"): T4-like form in a card (2-column field grid) + results below (same cards). Saved searches as chips.
- **Candidate profile** (drawer and/or page): T3. Header with photo/avatar 56, name 24/600, role · location, IDs in mono, availability pill, actions. Tabs (existing): Overview · Journeys · Activity · Documents · Notes. Activity uses the timeline component (§8.21). Enrichment and identity confidence render as quiet info rows with a neutral "Indicative" pill where the data is indicative.
- **`li-lists-hub`**: T2 lists of saved LinkIt lists (name, count, last updated, owner).

#### Interviews
- **`interviews`**: T7 + T6. Top: segmented Day · Month; date navigation (chevrons + "Today" pill); the right "Needs you" column (320 px) lists `interviewIssues` with tone tiles. Day view: timeline rows (§7.1.6 Today rows, full width, with interviewer avatars and join/scorecard actions). Month view: grid. Click → detail sheet (right drawer 480): candidate, job, round, time (with time zone), panel, links, scorecard status, actions (Reschedule, Cancel, Send reminder).
- **Schedule / reschedule modals**: §8.14, 2-column layout (form left, slot suggestions right), with clash warnings as an inline `warn` banner.
- **`hm-interviews`**: T7 list scoped to the HM.
- **`candidate-interviews`**: list of upcoming/past interview cards (radius 14) with time, mode, join link and the candidate's confirm/reschedule actions.

#### Clients
- **`client-management`**: T2. Columns: Client (logo tile or initials + name) · Industry · Open jobs · Placements · Revenue (permission-gated) · Owner · Status. Detail on hover = a popover card (existing behaviour) styled as §8.13.
- **`client-detail`**: T3. Account strip (existing): logo/initials 48, name, city pins, terms summary chips. Tabs: Overview · Contacts · Terms · Documents (existing). The Terms tab shows "You earn per hire" with the slab table (§8.9 dense) and a 4 px fee bar per slab. Map pins use `--accent` markers.
- **`client-new`**: T4 full page, tabs Locations · Contacts · Commercial terms · Documents, sticky save bar, duplicate-check result as an inline `warn` banner with a link to the existing client.

#### Approvals
- **`approval-center`**: T6. Header stat strip (KPI strip style, 4 cells: Waiting on you · Due today · Overdue · Approved this week). Views (existing three) as a segmented control. Queue rows (Needs-you grid: tone tile · title + meta · SLA pill · two 32 px icon buttons: approve (good tint, check) and send back (risk tint, x), plus "⋯"). Kairo lanes show as grouped sections with a Kairo label pill (review tone). Right panel: the rich submission preview / compact detail. The undo toast is kept. The phone card is kept as a mobile preview.

#### Cowork, LinkIt, Intelligence
- **`kairo-team`** (Cowork hub): T3 hub. Tabs Agents · Activity (and Campaigns where present). Agent rows (not tiles): 40 px iris icon tile, agent name 15/600, one-line purpose 13 `--text-3`, status pill (Live good / Paused neutral / Needs setup warn), last action time, "Open". The LinkedIn outreach add-on is marked with a neutral "Add-on" pill. Activity: timeline (§8.21) with agent glyphs.
- **`cowork-campaign`**: T3. Header with goal sentence ("12 people ready to call by 2 Dec"), progress (4 px bar + "7 of 12"), status. Plan column (right) as a vertical step list (§10 styles). People table with stage pills.
- **`cowork-campaign-new`**: T4. Six cards plus sending pace on the left as stacked sections (no nested cards: a section title + fields + hairline); "The plan" on the right (sticky).
- **`cowork-workflow`** / legacy **`workflow-builder`**: product flow map editor, §10.
- **`linkit-wizard`**: T4 wizard.
- **`li-uni-box`**: T6 inbox: conversation list (avatar, name, last message 13 `--text-3` one line, time, channel glyph 14 px, unread = 7 px accent dot) + thread (bubbles: mine `--brand-navy` white text, radius 16/16/4/16; theirs white with ring; time 11 `--text-3`) + composer (44 px field, radius 22).
- **`intelligence`**: T1-lite: KPI strip (existing headline numbers) + three sections (Bottlenecks, Pipeline risk, Drop-off) as list cards with one number and one horizontal bar per row; every probability/risk keeps the "Indicative" neutral pill.

#### Reports and team
- **`reports`**: header + period control (if a period exists) + KPI strip + Funnel chart (§9.5) + tables. Exports stay as secondary buttons.
- **`recruiter-analytics`**: KPI strip + per-recruiter table with inline 60 px bars for the score; the recruiter score keeps its disclosure note as 12 `--text-3` under the table.
- **`admin-recruiters`** (Org productivity): T2 table with sparkline column (88 × 24).
- **`manager-team`**: T2 cards-in-list: member rows with avatar, role pill (neutral), workload bar (open jobs), this-period submissions/interviews/placements (tabular), "View as" button.
- **`manager-recruiter-detail`**: T3 for a recruiter; the "Viewing as {name}" banner becomes an `info` inline banner (radius 14, accent dot, Exit link).
- **`team-members`**, **`user-management`**: T2 table: Name/email · Role (neutral pill) · Team · Status (Active good / Invited info / Suspended risk) · Last active · ⋯. Invite = primary. The member modal/drawer follows §8.14/§8.16.

#### Money
- **`admin-revenue`**: KPI strip (Revenue earned, Invoiced, Collected, Due; existing numbers) + revenue chart (bar, §9.4) + split-credit table.
- **`paytrack`** (recruiter, own placements) and **`admin-paytrack`**: T2 with segmented sections (Placements · Invoices · Contracts as existing). Money columns right-aligned, tabular, 14/600 for totals. State pills: Draft neutral, Raised info, Due warn, Overdue risk, Paid good. Guarantee window shown as a 4 px progress bar with "18 d left". The PayTrack drawer: §8.16.
- **`payroll-billing`**: T2 tables; GST modal §8.14.
- Contract and temporary staff (inside PayTrack): assignments and timesheets tables; timesheet status pills; "invoice from approved time only" stays as an inline info banner.

#### Settings and administration
- **`settings`**: T5 with sections You · Workspace · Platform (Settings v2). Each existing section keeps its tabs (max 3). Appearance offers Standard / Eye Comfort as two preview tiles (radius 14, selected = 2 px accent ring).
- **`setup-hub`**: checklist card list: step rows (36 px tone tile, title, description, status pill, action); progress ring 36 px at the top (gradient as the goal ring).
- **`roles-permissions`**: permission matrix table: sticky first column, checkbox cells (§8.2), module group rows on `--bg-subtle`.
- **`security-settings`**, **`master-data`**, **`feature-flags`**, **`scheduled-jobs`**: T5/T2 accordingly; switches §8.2; destructive actions in a danger zone.
- **`org-structure`**: organisation chart (reusable component, §10.7).
- **`audit-center`**: T2 log table, dense rows (44 px), mono IDs, actor avatar 24, action text, time; filters as chips.
- **`design-system`**: the in-app design reference page. Rebuild it to show the 2.0 tokens and components (it is the living documentation of this file).

#### Corporate hiring
- **`requisitions`**: T2 (Title · Department · Hiring manager · Status · Approvals progress (dots) · Age). **`requisition-new`**: T4 ("one sentence" quick form first, details second). **`requisition-detail`**: T3 with the approval chain timeline (§8.21).
- **`vendors`**: T2 (Vendor · Specialisation chips · Jobs shared · Submissions · Status (Invited info / Active good / Suspended risk)). **`vendor-detail`**: T3 with access lifecycle actions (resend, reactivate, suspend) and a dedupe rules panel.
- **`marketplace`**: T2 grid of agency cards (max 3 per row; card radius 18: name, domains as chips, rating if it exists, "Invite"). Copy and permission behaviour unchanged.
- **`contract-hiring`**: T2 work orders + timesheets + invoices tabs.

#### Hiring manager
- **`hm-dashboard`** (Recommended): T1 variant (§7.1.7). **`hm-feedback`**: Needs-you style list with "Give feedback" actions. **`hm-decisions`**: T2 history table with decision pills (Hired good, Rejected risk, On hold warn).

#### Candidate portal
- **`candidate-opportunities`**: card list (radius 18): job title, company, location, status pill, next step. **`candidate-profile-self`**: T5-like single column form.

#### Oontu platform
- **`oontu-tenants`** / **`oontu-tenant-detail`**: T2/T3 (tenant, plan pill (info), seats, status, created). **`oontu-signups`**: Needs-you style queue with reminder/call-outcome actions. **`oontu-help`**: T6 tickets. **`oontu-subscriptions`** / **`-detail`**: T2/T3 with money columns. **`oontu-plans`** / **`-detail`**: plan cards (radius 18) + a limits table. **`oontu-agents`**: agent rows + kill switch (switch with a confirm modal in risk tone). **`oontu-feature-controls`**: switches table. **`oontu-platform-users`**: T2. **`oontu-notifications`**: composer + list. **`oontu-audit`**: as `audit-center`. **`oontu-settings`**: T5.

### 7.13 Authentication and onboarding (T9)
Sign in (`#/sign-in`): wordmark, headline "Welcome back", email, password (show/hide), primary "Sign in", secondary links (Forgot password, Create workspace), `#auth-error` as an inline risk banner. Sign up (`#/sign-up`, `suShellHTML` wizard): T9 with the T4 progress line; workspace type choice as two large selectable tiles (radius 18, 2 px accent ring when selected); password strength (`#auth-password-strength`) as a 4-segment bar (risk → warn → info → good tints). Verify email: an envelope icon in a blue chip, resend link (`#auth-resend`) with a cooldown counter. Recovery and invite (`#/invite/…`), assisted setup (`#/assist/…`): same card. **Onboarding** (`#onboarding`): replace the multi-radial background with `--brand-warm-white` + one soft radial; content card max 640; steps per the existing flow. **Logout modal**: §8.14 (small, 400 px).

### 7.14 Outside-app pages (T8)
- **Client review / interviewer link `#/l/<token>`**: the tenant name header; candidate cards (radius 18) with profile summary, the CV link, and three decision buttons (Shortlist good outline, Hold warn outline, Reject risk outline) + "Book interview" primary; the interviewer scorecard uses §8.2 fields with 1–5 rating segmented controls; scores hidden until submitted (existing rule).
- **Hiring-manager link `#/hm/<t>`**: same pattern with decision options.
- **Vendor `#/vendor`**: sign-in with email + one-time code (6 boxed 48 px inputs); portal: T2 lists of authorised jobs (Job ID mono), submissions with status pills, the vendor's own interviews.
- **Consent `#/consent/<t>`**, **resume `#/resume/…`**, **apply `#/apply/<t>`**: single-column forms max 560, with a clear privacy note and the legal links.
- **Contractor time `#/time/<t>`**, **`#/time-ok/<t>`**: week timesheet grid (7 columns, 44 px cells), submit; the confirmation page has a green check in a green chip.
- **Oontu jobs website `#/jobs`**: public job board for verified workspaces: hero with search (56 px field), job cards (radius 18), job detail page with "Apply". Uses the tenant's name; Oontu branding in the footer.
- **Legal centre `#/legal/<doc>`**: reading layout max 720, 16/26 body, sticky 220 px table of contents, region selector.

### 7.15 Global overlays
Command palette / global search (§4.6); notifications panel (right drawer 420: category segmented control, rows with tone tiles, "Mark all read"); messages panel (§8.16, the LinkIt inbox pattern); composer (modal 640); Kairo chat (§4.7); AI info popover (§8.13); prospect picker (modal with a searchable list); photo modal (modal 560); split-proposal, follow-up, joining-date and duplicate modals (§8.14); toasts (§8.15).

---

## 8. Component library

Every component is defined once in `<style id="oontu-design">` using tokens. Screens use the shared classes (`.o-btn`, `.o-card`, `.o-table`, `.seg`, `.o-nav-item`, `.o-menu`, `.modal-panel`, `.o-empty`, `[data-ow-tone]`, …). Keep the existing class names and re-skin them. Introduce new classes only where no class exists.

### 8.1 Buttons
| Variant | Spec |
|---|---|
| Primary | `--action` fill, `--on-action` text 14/500, height 42 (top bar, page header) / 36 (cards) / 32 (rows), padding `0 18px`, radius 999, optional 15 px icon (stroke 2) gap 8. Hover `--action-hover`; active `--action-pressed` + scale .98 (120 ms); focus ring. One per view region |
| Secondary (outline) | white, `box-shadow: inset 0 0 0 1px var(--line-strong)`, text `--text-1` 14/500, same sizes. Hover: ring `rgba(11,31,59,.14)` + `0 1px 2px rgba(11,31,59,.06)` |
| Quiet (tinted) | `--fill-hover` background, `--text-1` 13/500, radius 999, height 34 (e.g. "Remind clients", "Cancel") |
| Ghost / icon | 32 or 34 px square, radius 9–10, transparent, icon `--text-3`; hover `--fill-hover` + `--text-1` |
| Top-bar icon | 42 px, radius 12, white, `--elev-control` |
| Tone action (approve / send back) | 32 px, radius 10, background `--st-good-bg` / `--st-risk-bg`, icon `--st-*-fg`; hover alpha ×1.6 |
| Link | `--accent` 13/500, no underline; hover underline 1 px offset 3; trailing "›" |
| Destructive | secondary style with `--st-risk-fg` text; confirmation modal uses a filled risk button `#C03545` white text (the only solid red in the product) |
| Loading | label fades to three 4 px `currentColor` dots pulsing in sequence; width locked; `aria-busy=true` |
Disabled: `opacity:.45`, no hover, `aria-disabled`. Never disable without a tooltip explaining why (existing copy).

### 8.2 Inputs and form controls
- **Text field:** height 42 (forms) / 36 (toolbars) / 44 (auth, mobile); radius 12; white; `--elev-control`; padding `0 14px`; text 14 `--text-1`; placeholder `--text-3`. Hover ring `rgba(11,31,59,.12)`. Focus: ring `0 0 0 2px var(--accent)` + `0 0 0 6px rgba(47,100,214,.12)`. Error: ring `--st-risk-dot`, message 12 `--st-risk-fg` below with a 12 px icon. Label 13/500 `--text-1` above with a 6 px gap; helper 12 `--text-3`.
- **Textarea:** same, min-height 96, padding 12 14.
- **Select / combobox:** a field with a 15 px chevron; the menu per §8.4; type-ahead; multi-select shows chips inside (§8.8 small).
- **Checkbox:** 18 px, radius 5, ring `--line-strong`; checked `--action` fill + white 12 px check (stroke 2.4), 120 ms. **Radio:** 18 px circle, checked = 6 px navy dot. **Switch:** 32 × 20 track; on = `--brand` (`#10B981`, switches are "on/done"), off = `rgba(11,31,59,.14)`; thumb 16 white with `--elev-thumb`; 200 ms `--spring`.
- **Segmented control (`.seg`, sliding `.o-pill` thumb):** track `--fill-selected` radius 999 padding 3–4; options 30–34 px, 13 px; selected = white thumb + `--elev-thumb`, text `--text-1` 500; others `--text-3`; thumb glides `--t-glide` `--spring` (existing test). Counts inside options in `--text-3`.
- **Date fields:** see §8.10.
- **OTP input:** 6 × 48 px boxes, radius 12, mono 20/600, auto-advance.
- **File upload / dropzone:** dashed ring is not allowed. Use `--bg-subtle` + `--elev-control`, 1 px ring on dragover `--accent`, with an icon in a blue chip.
- Forms: one column ≤ 720; two columns only for short related fields (city/state, from/to). The required marker is "Required" 12 `--text-3` after the label, never a red asterisk.

### 8.3 Cards and surfaces
`.o-card`: `--bg-card`, `--r-card` 22, `--elev-card`, padding 22/24, title row (h2 18/600 + optional sub 13 `--text-3` + right-side controls). Card footer: hairline top, padding-top 12, 13 `--text-3` left + link right. Inset panel (inside a card): `--bg-subtle`, radius 14, no ring. Surfaces on the hero tint: `--surface-on-tint` + `--elev-on-tint`. **Never** nest an `.o-card` inside an `.o-card`. **Fixed heights:** dashboard cards declare a height (§3.7) and an overflow rule (§8.22).

### 8.4 Dropdowns and menus (`.o-menu`)
Panel white (or `--material-float` over content), radius 16, `--elev-popover`, padding 6, min-width 200. Item 36 px, radius 10, 14 px `--text-2`, icon 16 `--text-3`; hover `--fill-hover`; selected = check icon right + `--text-1` 500; danger item `--st-risk-fg`. Section heading 12/500 `--text-3` sentence case (`.o-menu__head`). Separator 1 px `--line` with 6 px margins. Enter: opacity 0 → 1 + translateY(-4px) → 0 + scale .98 → 1, 200 ms `--ease-out`; exit 120 ms. Keyboard: ↑↓, Home/End, Esc, type-ahead.

### 8.5 Tooltips
Navy `#0B1F3B`, white 12/500, radius 8, padding `6px 10px`, max-width 260, delay 300 ms in / 0 ms out, 200 ms fade + 4 px slide from the anchor side. Shown on hover and focus. Never contains interactive content (use a popover).

### 8.6 Stat strip / KPI
See §7.1.4. Standalone stat (inside cards): label 12 `--text-3`, value 22–26/600, sub 12. A row of stats uses 1 px `--line` dividers, not boxes.

### 8.7 Tabs
Two kinds: (a) **segmented** (§8.2) for view switches inside cards and toolbars; (b) **page tabs** under a page header: text tabs 14/500, `--text-3` → `--text-1` selected, a 2 px `--action` underline that slides (`--t-glide`), 44 px tall, hairline below the tab row. Overflowing tabs scroll horizontally with fade edges. ARIA `tablist` / `tab` / `tabpanel`; ←/→ to move.

### 8.8 Filters and chips
Filter chip: 32 px, radius 999, white + `--elev-control`, 13 `--text-2`, chevron; active = `--accent-tint` background + `--accent-ink` text + an "×" clear icon. Quiet chip (skills, tags): 24 px, radius 8, `--bg-subtle`, 12 `--text-2`. "Clear all" link at the end. Applied filters persist as today.

### 8.9 Tables (`.o-table`)
Inside a card (radius 22, `overflow:hidden`, `overflow-x:auto` with a min-width at narrow sizes). Header row: 12/500 `--text-3`, sentence case, padding-bottom 10, no background, sticky (`top:0` inside its own scroller, or below the top bar on long pages) with the material on stick. Rows: 64 (two-line) / 52 / 44 (dense); separators `--hairline`; padding x 24; hover `--table-row-hover`; selected `--row-hover` + 2 px accent left edge. Cells: primary 14/500 `--text-1`; secondary line 12 `--text-3`; numbers right-aligned tabular; money 14/600; statuses as pills; owners as 28 px avatars; row actions = one "⋯" ghost (always visible at 60% opacity, 100% on row hover). Sort: header text + a 12 px arrow on the active column. Column visibility and resizing only where they already exist. Empty table → §8.17 inside the card. Pagination §8.11. **< 768:** each row becomes a stacked block (title line, meta line, status + key number line, pipeline bar), 16 px padding, hairline separators.

### 8.10 Date-range / period control
Trigger (top-bar corner, 42 px, radius 12, white, `--elev-control`): 16 px calendar icon `--text-3`, two lines (preset name 11 `--text-3`; range 14/500 tabular "12 – 18 Nov"), 14 px chevron. Popover (620 px, radius 20, `--elev-popover`, anchored right, 52 px below): left column 170 px of presets (36 px rows, radius 10; selected `--accent-tint` + `--accent-ink` 500); right: From/To fields (36 px, `--bg-subtle`), month header with chevrons, a 7-column grid of 36 px day buttons (in-range `--accent-tint` with square inner edges; start/end navy `--brand-navy` white 600 radius 10; today has a 4 px dot; future days `--text-4` and disabled), footer: the "Compare with previous period" switch + Cancel (quiet) + Apply (primary). Opens with the menu motion. Keyboard: arrow keys move days, Enter selects, Esc closes, Tab cycles presets → grid → footer. < 768: opens as a bottom sheet with presets as a segmented row and a single month.

### 8.11 Pagination
Right-aligned: "Showing 1–5 of 12" 13 `--text-3` left; prev/next 32 px ghost chevrons (disabled `--text-4`); page buttons 32 px radius 9, current `--brand-navy` white 600. For infinite or 50-row lists: "Show 50 more" quiet button.

### 8.12 Week strip / mini calendar
7 equal buttons, 52 px tall, radius 12: weekday 11 `--text-3`, date 15/600 `--text-1`, 4 px dot below (accent if the day has items, green on today). Today = navy fill, white text. Selected (not today) = `--accent-tint`.

### 8.13 Popovers and hover cards
Like menus but with content: radius 16–20, padding 16, `--elev-popover`, arrow-less, 8 px offset, max-width 360. Hover cards (client, candidate) open after 400 ms and stay while hovered.

### 8.14 Modals
Scrim `--scrim` (fade 200 ms). Panel white, radius 22, `--elev-modal`, widths 400 (confirm) / 560 (standard) / 720 (complex) / 960 (two-pane). Header: title 18/600 + description 13 `--text-3` + a 32 px close ghost. Body padding 24, scrolls internally. Footer: hairline top, padding `16px 24px`, secondary left / primary right (destructive right). Enter: opacity + translateY(8px) + scale .98 → 1 over 280 ms `--spring`; exit 160 ms. Focus trap, Esc closes (unless the modal is blocking), focus returns to the trigger. < 768: becomes a bottom sheet (radius 28 top, grab handle 36 × 4 `rgba(11,31,59,.15)`, max-height 92vh, swipe-down closes when not dirty).

### 8.15 Toasts and alerts
**Toast** (`#toast-container`): bottom-centre, 24 px above the bottom (and above the Kairo launcher's top edge on mobile); material float, radius 14, padding `12px 16px`, 14 `--text-1`, leading 7 px tone dot, optional "Undo" link (accent 500), max 2 stacked (new one on top, older ones shift up 8 px and fade to .9); auto-dismiss 4 s (existing), paused on hover. Toasts must **never cover the primary action region or the selected row**. **Inline banner:** radius 14, tone tint background, 7 px dot, 13–14 text in `--st-*-fg`, optional action link right. **Verify banner** (`#verify-banner-root`): an info banner inside the content column, not full-bleed.

### 8.16 Drawers and sheets
Right drawer: width 480 (detail) / 720 (create flows), full height minus 12 px inset, radius 22 on the left corners, `--elev-modal`, header like modals and sticky, footer sticky. Enter: translateX(24px) + opacity → 0 over 280 ms `--spring`. Content behind is not scrolled. < 768: full-screen sheet from the bottom.

### 8.17 Empty, error and permission states
Empty: centred in its region, 40 px icon in a tone chip (blue by default), title 15/600, one line 13 `--text-3` (existing copy), at most one action (secondary or primary). Error (`errorStateHTML`): same layout with a rose chip, title "Something went wrong loading this screen", actions "Try again" (secondary) + "Go to Home" (primary), technical details in a `<details>` with mono 11. Permission/plan-gated: a neutral chip + the existing explanation + the existing upgrade/request action. Never show a blank card.

### 8.18 Skeletons
Shape-matched blocks in `rgba(11,31,59,.05)`, radius matching the content (8 for text lines, 999 for pills, 22 for cards), opacity pulse .5 ↔ 1 over 1.6 s (no shimmer sweep). Shown only after 300 ms (existing `SKELETON_SCREENS` logic; replace `skeletonGridHTML` styling). Cross-fade 200 ms to content.

### 8.19 Loader
The existing Oontu loader concept (two rings + gliding green dot) is retained, re-drawn with the approved mark proportions: rings `rgba(11,31,59,.14)`, dot `--brand`. Sizes 16/24/40/56. Used when the layout is unknown or the wait is over 1 s. It is the only looping animation besides the rail ping and the Kairo "thinking" dot.

### 8.20 Kanban / board (pipeline)
Columns 280 px, gap 14, column header (stage dot in the stage-ramp colour, name 13/500, count 12 `--text-3`), column body `--bg-subtle` radius 18 padding 8, own vertical scroll. Cards: white, radius 14, `--elev-control`, padding 12, avatar 28, name 14/500, role 12, age 12 `--text-3`, one pill max. Drag (only if it exists today): lifted card `--elev-popover` + rotate(1deg); drop target column ring `--accent` 1.5 px. The board scrolls horizontally with fade edges; on < 768 it shows one column at a time with a stage segmented control.

### 8.21 Timeline / activity feed
Left spine 1.5 px `--line`; event dot 9 px (tone dot colour; ring for upcoming); actor 13/500 + action 13 `--text-2` + time 12 `--text-3`; attachments as quiet chips. Group by day with 12/500 headings.

### 8.22 Overflow rules for fixed-size cards
| Content | Rule |
|---|---|
| Queues (Needs you, approvals, tasks inside cards) | internal scroll + 28 px bottom fade mask + footer count "N tasks · scroll for more" |
| Time-ordered lists (Today) | show the first N that fit, collapse the rest into a "+N more …" inset row linking to the full view |
| Tables | 5 rows per page in dashboards; full pages page at 25/50; never grow a dashboard card |
| Text | titles: 1 line ellipsis + `title`; notes: 2–3 line clamp + "See more" link |
| Chips/tags | max 3 visible + "+N" quiet chip with a hover card |
| Numbers | abbreviate ≥ 10,000 (12.4k; ₹32.8L / ₹1.2Cr in INR workspaces), full value in a tooltip |
| Charts | x-labels thinned to fit (never rotated), the last point always labelled |

### 8.23 Badges and counts
Navigation counts: plain numbers (§4.2). In-content counts next to titles: 12 `--text-3` after the title. Unread dots: 7 px. **No circular numeric badges anywhere**, except the existing notification dot (no number).

### 8.24 Avatars and stacks
§3.1.9. Stacks overlap by 6 px with a 2 px ring in the surface colour; max 3 + "+N".

### 8.25 Progress
Linear: 4 px (in rows) / 8 px (Where time goes) / 2 px (wizards), radius 999, track = colour at 10% or `rgba(11,31,59,.05)`. Ring: 36 / 76 px, gradient `#2F64D6 → #10B981`, track `#E3EAF6`, round caps.

### 8.26 Workflow nodes: see §10.

---

## 9. Data visualisation standards

### 9.1 Palettes
**9.1.1 Series (soft, ordered):**
| # | Token | Line / mark | Area fill | Value tag |
|---|---|---|---|---|
| 1 | `--chart-1` | `#2F64D6` at .9, 2.2 px | gradient `rgba(47,100,214,.12)` → 0 | bg `rgba(45,91,192,.12)`, text `#2D5BC0` |
| 2 | `--chart-2` | `#14A3A0` at .9, 2.2 px | `rgba(20,163,160,.10)` → 0 | bg `rgba(15,127,122,.12)`, text `#0F7F7A` |
| 3 | `--chart-3` | `#D4607E` at .8, 2 px | none | bg `rgba(180,64,95,.12)`, text `#B4405F` |
| 4 | `--chart-4` | `#7C6CE0` at .85 | `rgba(124,108,224,.10)` → 0 | `#5B4BC0` on `.12` |
| 5 | `--chart-5` | `#E8A33A` at .85 | none | `#8F5E06` on `.12` |
| 6 | `--chart-6` | `#2BC08F` at .85 | none | `#0F7A58` on `.12` |
Series order is fixed: the primary measure is always blue, the comparison measure teal, the negative/loss measure rose (e.g. Backed out), then iris, amber, green. Max 4 series in one chart. Beyond that, use small multiples.

**9.1.2 Sequential (one measure, intensity):** `#EAF0FB, #C9D8F5, #9CB7EC, #6A90DF, #2F64D6`.

**9.1.3 Status categorical (stacked bars, donuts, breakdowns):** Awaiting/with client `#EDB65C` · Shortlisted `#7C95D8` · Interviewing `#5FA7DA` · Offered `#4FC2B3` · Joined `#3FCB9C` · Rejected `#EE9AAD` · Backed out `#D4607E` · On hold `#B5ABE6` · Withdrawn `#A9B6CC`. Segments are separated by 3 px gaps (no borders).

**9.1.4 Stage ramp:** §3.1.6 at .7 opacity.

### 9.2 Chart chrome
Plot background transparent (on white) or `--bg-card`. Gridlines: 3 horizontal lines max (top, middle, zero), `rgba(11,31,59,.05)`, 1 px, no vertical grid. Axis labels 11 `--text-3`; the y-axis is right-aligned to a 34 px gutter; no axis lines; no chart borders. Zero baseline always shown. Dashed `rgba(11,31,59,.10)` 3/4 marker at "now"/the latest point. End-point: a 4.5 px white circle with a 2.2 px series ring + a tinted value tag (radius 11, 12/600). Avoid label collisions: offset tags vertically (min 22 px apart) and flip below the point if needed.

### 9.3 Line and area
Smooth monotone curves (cubic, horizontal tangents at midpoints, never overshoot below 0). Area only for series 1–2. Granularity follows the period: Today → hourly or last-7-days context; 7 days → daily; 30 days → weekly; Quarter → weekly; Custom → auto (≤ 14 days daily, ≤ 90 weekly, else monthly). Labels thinned to ≤ 7.

### 9.4 Bars
Radius 6 on the top corners (vertical) / ends (horizontal). Bar thickness 8–14 px with a 40% gap. Track bars (progress-like) use the colour at 10% as the track. Highlight one bar at most (amber for "slowest", navy for "selected").

### 9.5 Funnel
Horizontal bars per stage in the stage ramp (.7), left-aligned, with conversion % between rows (12 `--text-3`). Never a trapezoid graphic.

### 9.6 Sparklines
88 × 28 (KPI) / 116 × 34 (large); 2 px; chip colour at .75; no dots, no area, no axes.

### 9.7 Tooltips (charts)
On hover/focus of a point or bar: a vertical guide 1 px `rgba(11,31,59,.12)`; tooltip panel white, radius 12, `--elev-popover`, padding `10px 12px`; title 12/500 `--text-3` (date); rows: 8 px series dot + label 12 `--text-2` + value 13/600 tabular right; comparison 12 `--text-3`. Follows the pointer horizontally (snaps to points), fades 120 ms. Keyboard: the chart is focusable, ←/→ moves between points, and the tooltip shows for the focused point. Charts have `role="img"` + a meaningful `aria-label` and a visually hidden data table (or "View as table" toggle) for screen readers.

### 9.8 Legends
Inline, above the chart, right-aligned: 8 px round dot + label 12 `--text-2` + optional total 22/600 + delta. Click toggles the series where multiple series exist (dimmed to .25, not removed).

### 9.9 Interaction and motion
Draw-in on first render: lines stroke-draw over 500 ms `--ease-out`, areas fade 300 ms, bars grow from the baseline over 400 ms with a 30 ms stagger; numbers count up ≤ 500 ms. Only on first view of the session per chart, and none under reduced motion. Period changes cross-fade (200 ms) rather than re-drawing.

### 9.10 Rules
- Every chart answers one question, written as its title or caption.
- Show the numbers: totals in the legend and the last value tagged.
- Positive change: ↑ + `--st-good-fg`. Change where up is bad (backouts, overdue, time to fill): neutral `--text-3` text "vs N"; use the risk colour only when crossing an existing threshold.
- "Indicative" metrics (join/response probability, counter-offer risk) never use gauges or percent bars implying precision; they show a number + a neutral "Indicative" pill.
- Charts never use grey as a series colour.

---

## 10. Product flow map specification

The product's "flow map" surfaces are: (a) the **Cowork workflow builder** (`cowork-workflow`, `renderCwb*`), step-based with Simple/Advanced modes, branches (`kind:'branch'` with `yes`/`no` lists), drafts, versions, tests and checks; (b) the legacy **Workflow Studio / builder** (`workflow-builder`, `renderWorkflowBuilder`), Trigger → Conditions → Actions configuration; (c) the **job hiring stages** in job creation (`jcStage`) and job pipelines; (d) the **approval chains** (Settings › Approval rules, `#approval-chains-body`); (e) the **organisation chart** (`org-structure`, reusable component). **There is no node-graph library (no React Flow).** The editors are deliberately step-based. Keep it that way. Do not add a canvas library, drag physics or wires.

### 10.1 Layout
Editor = 3 regions: header (workflow name 24/600 inline-editable as today, status pill (Live good / Draft neutral / Paused warn / Needs fixes risk), version text 12 `--text-3`, Simple|Advanced segmented, Test (secondary), Publish (primary)); **canvas column** (max 760, centred) on `--bg-page` with an optional dot grid (`radial-gradient(rgba(11,31,59,.06) 1px, transparent 1.3px)` 22 px) in Advanced mode only; **inspector** (right, 400 px, sticky, white card) for the selected step.

### 10.2 Spine and steps
- Vertical spine: 2 px `rgba(11,31,59,.08)`, centred under the step icons, with 20 px between steps.
- **Step node** (not a heavy card): a row 64 px min; a 32 px circular icon node (tinted by kind) on the spine + a content block (title 14/500 "When a candidate replies", summary 13 `--text-3` in plain language, chips for key values) + a right "⋯". The content block has no box at rest. Hover: `--row-hover` background with radius 14 around the content. **Selected:** white surface, `--elev-control` + 2 px `--accent` ring, radius 14, and the icon node gets a 4 px `rgba(47,100,214,.15)` halo.
- **Kinds → icon chip colours:** Trigger/When = blue; Condition/If = iris; Action/Do = teal; Wait/Delay = amber; Message/Send = teal; Approval = amber; End/Goal = green; Kairo step = iris with a Kairo sparkle.
- **Branch:** the spine splits into two columns (gap 32) with a rounded 12 px elbow connector (2 px line). "Yes" / "No" labels sit as 22 px pills on the elbows (Yes = good tint, No = neutral). Columns re-join with a mirrored elbow at the end. Nested branches indent by one column. Below 900 px width, branches stack (Yes block, then No block, each with a left 2 px tinted rule).
- **Add step:** a 24 px circular "+" button on the spine between steps, visible at 0 opacity and 1 on spine hover/focus (its space is reserved). It opens the existing add menu (`cwb.addMenu`) as a popover menu (§8.4) grouped by kind.
- **Validation:** steps with gaps (`cwb.gaps`) show a 7 px warn dot on the icon node + a warn inline banner in the inspector. Failed checks are risk.

### 10.3 Status indicators
In Activity view only, the spine segment of the step that ran last is drawn as a 3 px `--st-good-dot` line at .6 opacity (static, no shimmer). Run counts are 12 `--text-3` text. Never animate the spine continuously.

### 10.4 Test runs
A "Test" result panel replaces the inspector: candidate picker + a per-step result list (✓ good, ✕ risk, ↷ skipped neutral) with plain reasons. Uses the existing real evaluation.

### 10.5 Hiring stages (job creation and pipelines)
A horizontal stage track: 18 px nodes (white with a 2 px stage-ramp ring; current = filled navy; done = filled stage colour .7), 2 px connector in the stage gradient at .55, labels 12/500 below, stage counts 24/600 where shown. Editing a stage list uses reorderable rows (drag handle 16 px, only if reordering exists today) with the same node at the left.

### 10.6 Approval chains
Vertical chain of approver rows: avatar 28 + name + rule text ("if offer > band") + SLA pill; connectors as the spine; parallel approvers shown side by side within one level.

### 10.7 Organisation chart
Nodes are compact person chips (avatar 32 + name 13/500 + role 12 `--text-3`, white, radius 14, `--elev-control`), with connectors 1.5 px `rgba(11,31,59,.12)` drawn as rounded orthogonal elbows. Selected = accent ring. Pan by scroll; zoom controls only if they exist today (if so: a 3-button vertical group 32 px, bottom-right, white, `--elev-control`, radius 12).

### 10.8 Robustness requirement
Opening `workflow-builder` (or `cowork-workflow`) without a valid workflow id must show the §8.17 empty state ("Pick a workflow to edit" + "Back to Cowork" + the existing "New workflow" action if permitted) instead of "Automation not found". This is a presentation fix: no data or routing changes beyond choosing what to render when the id is missing.

### 10.9 Responsive
< 1024: the inspector becomes a bottom sheet; the canvas is full width. < 768: Simple mode is forced visually (Advanced controls collapse into "⋯"), steps stay full-featured.

---

## 11. Motion system

### 11.1 Laws
1. Motion explains a change of place or state. It never decorates.
2. Fast in, faster out: entrances 200–280 ms, exits 120–160 ms.
3. Small distances: 4–8 px translation, scale ≥ .98. No bounces, no overshoot beyond `--spring`'s natural settle, no zooms over 2%.
4. Nothing blocks input. Clicks during an animation take effect immediately (e.g. a new nav click cancels the leaving fade, as today).
5. Only `transform` and `opacity` animate (plus `width` for the sidebar). Never animate `height` on large regions. Use clip or `grid-template-rows: 0fr → 1fr` for expanders.

### 11.2 Motion map
| Element | Enter | Exit | Notes |
|---|---|---|---|
| View change (`navigateWithSkeleton`) | content opacity 0 → 1 + translateY(6px) → 0, 280 ms `--spring` | opacity → 0, 160 ms (existing `.o-leaving`, set to 160) | keep the skeleton route list |
| Section reveal on scroll | opacity 0 → 1 + translateY(24px) scale .985 → none, driven by `animation-timeline: view()`, range entry 0–35% | — | only for cards below the fold; `@supports` guarded; none under reduced motion |
| Sidebar collapse/expand | §4.4 | | |
| Sliding selection (nav, segmented, tabs) | translate/width 350 ms `--spring` | | existing `.o-pill` |
| Menu / popover / date picker | opacity + translateY(-4px) + scale .98, 200 ms `--ease-out` | 120 ms | transform-origin at the anchor |
| Tooltip | opacity + 4 px slide, 200 ms after a 300 ms delay | 0 ms | |
| Modal | §8.14 | | |
| Drawer | §8.16 | | |
| Toast | translateY(12px) → 0 + opacity, 280 ms `--spring` | opacity + translateY(8px), 160 ms | |
| Tabs content | cross-fade 200 ms | | no slide |
| Accordion / fold group | rows `0fr → 1fr` 280 ms `--spring` + chevron 90° | 200 ms | |
| Row hover | background 120 ms | | |
| Button press | scale .98, 120 ms | back 120 ms | |
| Check / complete | stroke-draw 200 ms + row collapse 200 ms | | |
| Charts | §9.9 | | |
| Number change (period switch) | cross-fade 200 ms (no slot-machine roll) | | |
| Flow map | selection halo 200 ms; branch expand 280 ms; add-step "+" fade 120 ms | | |
| Rail urgent dot | ping ring 2.4 s infinite | | the only infinite loop besides the loader and Kairo "thinking" |
| Kairo launcher | hover lift translateY(-1px) + shadow +10%, 200 ms | | |

### 11.3 Reduced motion (`prefers-reduced-motion: reduce`)
All durations become 0–1 ms except opacity fades (kept at ≤ 120 ms). No reveal, ping, draw-in, count-up, smooth scroll or sidebar width animation. The loader's dot "breathes" (opacity) instead of gliding.

---

## 12. Responsive design (per component)

| Component | ≥ 1280 | 1024–1279 | 768–1023 | < 768 | < 380 |
|---|---|---|---|---|---|
| Shell | §4.8 | | | | wordmark hidden in the top bar (mark only) |
| Home | §7.1.9 | | | | greeting 24/600 |
| KPI strip | 4 across | 4 across | 2 × 2 | 2 × 2 | 1 column |
| Thread | 6 columns + connectors | same | horizontal scroll-snap | vertical list | vertical list |
| Tables | full | hide low-priority columns (Owner → avatar only, Open days) | horizontal scroll with a sticky first column | stacked rows | stacked rows |
| T6 split | list + preview | list + preview (380) | list; preview as a right drawer | list; preview as a full sheet | same |
| Forms | 1–2 columns ≤ 720 | same | 1 column | 1 column, 44 px fields, sticky submit | same |
| Modals | centred | centred | centred | bottom sheet | full screen |
| Boards | horizontal | horizontal | horizontal | one column + stage switch | same |
| Calendar month | grid | grid | grid, 2 event lines | agenda list | agenda list |
| Charts | full | full | full, legend wraps | height 200, ≤ 5 x-labels | same |
| Period control | top-bar corner | corner | corner (compact: range only) | full-width row under the title + bottom sheet | same |
| Kairo launcher | pill | pill | icon-only 52 px circle | icon-only, above the bottom safe area | same |

Overflow: no horizontal page scroll at any width (only inside tables/boards/chip rows, with fade edges). Long words break (`overflow-wrap:anywhere` for emails/IDs).

---

## 13. Accessibility

- **Contrast:** text tokens §3.1.2 (`--text-3` ≥ 4.5:1 on white and `#F6F7F9`). Status text colours meet ≥ 4.5:1 on their tints. Never encode meaning by colour alone: every status has a word, every chart series a label.
- **Focus:** `:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }` on every interactive element. Radius follows the element. Never remove outlines without this replacement.
- **Keyboard:** everything reachable in DOM order; skip link "Skip to content" → `#main-content`; ⌘/Ctrl+K search, Ctrl/⌘+\ sidebar (existing); Esc closes the topmost layer; menus, tabs, segmented controls, date grid and charts per their specs. Rail tooltips appear on focus.
- **Semantics:** `nav` (`aria-label="Primary"`), `main`, `header`; the current nav item `aria-current="page"` (existing); toggles `aria-expanded`; tabs ARIA pattern; dialogs `role="dialog" aria-modal="true" aria-labelledby`; pills are text (not `role=status`); toasts in the existing live region; loaders `role="status" aria-label`.
- **Targets:** ≥ 32 px desktop, ≥ 44 px touch (< 1024).
- **Motion:** §11.3.
- **Zoom:** layouts hold at 200% (reflow to tablet/mobile layouts).
- **Language:** sentence case, plain words, no jargon. Kairo is described as an agent. Numbers with units ("6.4 d", "₹4.2L").

---

## 14. Technical implementation guidance

### 14.1 Existing architecture (verified)
- One file: `recruitment-os-prototype.html`. Vanilla JS, in-memory data (`JOBS`, `CANDIDATES`, `SUBMISSIONS`, `CLIENTS`, `PLACEMENTS`, `APPROVAL_REQUESTS`, `CUSTOM_ROLES`, `ORG_STRUCTURE`, …), localStorage for preferences. **There is no backend, database, ORM (Prisma/Sequelize/Mongoose) or API layer in this repository.** The "no schema change" rule therefore means: **do not change the shape, names or semantics of any in-memory data structure, seed data, localStorage key, function signature used across modules, or hash route.**
- Routing: `showView(viewId, navOverride)` → `RENDERERS[viewId]()` returns HTML into `#main-content`; `navigateWithSkeleton` adds the leave fade/skeleton; `PAGE_TITLES` names the top bar; hash routes (`#/l`, `#/vendor`, `#/hm`, `#/consent`, `#/time`, `#/time-ok`, `#/jobs`, `#/legal`, `#/sign-in`, `#/sign-up`, `#/auth`, `#/apply`, `#/assist`, `#/resume`, `#/invite`) render standalone roots (`co-root`, `jn-root`, `sl-root`, `cs-root`, `#onboarding`).
- Menus: `NAV`, `NAV_LAYOUT`, `AGENCY_NAV_LAYOUT`, `NAV_ITEM_ACCESS`, `navItemAllowed`, `homeFor`, plan gates `NAV_PLAN_GATES`, agents flag `oApplyAgentFlag` / `OONTU_AGENTS`.
- Styling: Tailwind via CDN (`tailwind.config` with legacy colour extensions) + 14 `<style>` blocks from several design generations (`--au-*`, `--oa-*`, `--o-*`, `--rf-*`, `--n-*`, …). The **last** block, `<style id="oontu-design">` (Design 1.0), is the single token and component layer, with legacy variables aliased to it. Status pills are `[data-ow-tone]`. The sliding selection is `oPill()` / `.o-pill`. Post-render hook: `oPostRender(main)`.
- Tests: 45+ browser specs in `tests/*.spec.js` run with `tests/run-auth-tests.ps1` (PowerShell + a browser) plus `test/aps.test.js`. Several assert design-1.0 *visual* values (sidebar 240/64, logo heights 32/40, top bar 56, "no blue/indigo/purple colour", fill-selected `rgba(60,60,67,.06)`, 350 ms glide).

### 14.2 Strategy
1. **Re-point, don't rebuild.** Change token values in `<style id="oontu-design">` to §3 and add the few **new** tokens. Every component already wired to tokens updates automatically.
2. **Then fix stragglers:** raw hex/rgba/px in screen CSS and inline `style=` / Tailwind colour classes (`bg-zinc-900`, `text-zinc-500`, `bg-accent-50`, `ios-*`, `gold-*`, `terracotta-*`, `forest-*`, `mint-*`) → token classes. Re-map the Tailwind colour extensions in `tailwind.config` to the new tokens (e.g. `accent-*` → the navy/slate scale, `gold/terracotta` → warn/risk tones) so legacy utility classes inherit the new look in one move. Remove the legacy layers only after their selectors are confirmed unused.
3. **Shell next** (sidebar, top bar, scroll architecture), then shared components, then screens in §15 order.
4. **Brand assets:** add `assets/brand/` with the approved files; replace the `OONTU_SYMBOL_MARK` / full-lockup constants used by `renderSidebarLogo()` and every other logo use (auth, onboarding, loader, outside-app pages, favicon `<link>`s, manifest).
5. **Fonts:** add Inter (400/500/600/800) and set `--font`. Remove other font links (e.g. Plus Jakarta Sans if still present).
6. **Charts** are hand-built SVG strings. Implement §9 as small shared helpers (e.g. `ooChartArea(series, opts)`, `ooSpark()`, `ooBars()`, `ooStackBar()`) and replace per-screen chart code with them where the chart is the same kind. **Do not add a chart library.**
7. **No new frameworks.** No React, no build step unless one already exists. Keep the single-file architecture.
8. **Copy:** unchanged, except removing uppercase transforms and fixing sentence case in labels.

### 14.3 Token map (1.0 name → 2.0 value)
`--text-1 #1E2E48 · --text-2 #3D4B63 · --text-3 #5E6A82 · --text-4 #9AA4B6 · --action #0B1F3B · --action-hover #14294A · --action-pressed #081730 · --brand #10B981 · --bg-page #F6F7F9 · --bg-card #FFFFFF · --bg-subtle #F4F6FA · --line rgba(11,31,59,.06) · --line-strong rgba(11,31,59,.09) · --fill-hover rgba(11,31,59,.05) · --fill-selected rgba(11,31,59,.045) · --focus-ring #2F64D6 · --material-bar rgba(246,247,249,.72) · --st-* §3.1.4 · --kairo-bg → --kairo-surface · --kairo-fg #5B48C2 · --viz-1..3/--viz-key → --chart-1..6 · --r-control 12px · --r-card 22px · --r-modal 22px · --r-sheet 28px · --elev-1 → --elev-control/--elev-card · --elev-2 → --elev-popover · --elev-3 → --elev-modal · --sidebar-w 248px · --sidebar-rail 76px · --topbar-h 70px · --page-max 1280px · --spring cubic-bezier(.16,1,.3,1) · --t-base 280ms (was 350; keep --t-glide 350ms for pills)`.

### 14.4 Libraries and things to preserve
pdf.js (CV parsing), any existing date/time-zone helpers, the APS engine (`oontu-approval-sla-engine.js`), the search engine and intent parser, the identity engine, demo data builders, the agents flag, the long-list 50-row pager, the scroll cache, the role/view-as machinery, Eye Comfort.

### 14.5 Safe implementation constraints
- Change appearance and motion only. Keep: ids, `data-*` hooks used by code or tests (`data-nav`, `data-agent`, `data-ow-tone`, `data-o-pill*`), function names, `onclick` handlers, event wiring, localStorage keys, routes, copy.
- When a markup change is unavoidable (e.g. moving the workspace card to the top, adding column headers to Needs you), keep the same handlers and ids and move the node rather than recreating behaviour.
- No `!important` in new CSS. If an old rule wins, delete or narrow the old rule.
- Visual-assertion tests that encode **1.0 design values** (widths, heights, colours, "no blue") are updated to the 2.0 values in this file, each change listed in the report with the section of this document that justifies it. Tests that encode **behaviour** are never weakened.

---

## 15. Module-by-module acceptance criteria

Global criteria (apply to every module, checked per screen): (G1) only tokens, no raw colours/radii/shadows in new or touched CSS; (G2) typography per §3.2, no 700/800 weights, no uppercase labels; (G3) statuses use `[data-ow-tone]` with 2.0 tints; (G4) loading/empty/error states present and styled; (G5) keyboard and focus per §13; (G6) layouts at 1440, 1280, 1024, 768, 390, 360 widths with no horizontal page scroll; (G7) all existing actions on the screen still work (click each one); (G8) no console errors on render or interaction; (G9) role and permission visibility unchanged (compare menus and screens before/after for every role).

| AC | Module | Specific, measurable criteria |
|---|---|---|
| AC-0 | Shell | sidebar 248/76; only `#main-content` and `#sidebar-nav` scroll; the top bar stays fixed and gains a hairline after scrolling; collapse/expand with no label wrap, no icon x-shift (≤ 1 px) and no main-content flicker; rail shows no numbers, dots match `count()>0`/`urgent`, tooltips on hover and focus; search field in the top bar opens the existing palette with ⌘/Ctrl+K; the sidebar search button is gone; approved logo files used everywhere (no old SVG constants remain); favicon/apple/PWA icons wired |
| AC-1 | Home | each role's Home matches §7.1.7; KPI strip ~104 px tall; Thread values sum consistently with Submissions/KPIs for the same period; the period control changes every period-bound number and the caption; Needs you columns align (due pills share an x position ±1 px; action buttons equal width); fixed card heights hold with 0 and 50 items; the Submissions Status/Trend switch works and Trend includes Backed out; corporate owner shows no Clients table or revenue |
| AC-2 | Tasks | complete + undo works; group headings with counts; filters keep state on return |
| AC-3 | Jobs | table columns per spec; row "⋯" always reserved; job detail tabs and pipeline actions all work; job creation steps, parsing, validation and talent preview unchanged in behaviour |
| AC-4 | Candidates | results split view with keyboard navigation; preview cross-fade; duplicates/identity/photo provenance visible as before; 50-row pager works |
| AC-5 | Interviews | day/month views; the needs-you column lists the same issues as before; schedule/reschedule/cancel; secure links render in T8 |
| AC-6 | Clients | list hover cards; account tabs; new-client form with the duplicate check; fee slabs and map pins render |
| AC-7 | Approvals | same counts as before; approve/send back/undo; SLA pills; right panel; lanes |
| AC-8 | Submissions & modals | every modal opens, traps focus, closes with Esc and returns focus; mobile sheets; duplicate/offer/joining rules unchanged |
| AC-9 | Cowork & flow map | agents list with statuses; campaigns; the workflow editor shows spine/steps/branches per §10; add/edit/test/publish work; a missing id shows the empty state, not "Automation not found"; the agents-off switch removes all Kairo UI |
| AC-10 | LinkIt | inbox list ↔ thread; channels identified; wizard steps |
| AC-11 | Intelligence | "Indicative" labels retained; no gauges |
| AC-12 | Reports | charts use §9 palettes (no grey series); legends with totals; tooltips by mouse and keyboard |
| AC-13 | Money | amounts tabular and right-aligned; state pills mapped; drawer per §8.16; corporate hides money modules (unchanged) |
| AC-14 | Team | view-as banner and exit work; invites; role pills |
| AC-15 | Settings | T5 layout; Eye Comfort renders with the comfort token set and white logos; approval chains per §10.6; roles matrix sticky column |
| AC-16 | Corporate hiring | requisition/vendor/marketplace/contract screens per template; vendor lifecycle actions work |
| AC-17 | HM | Recommended list, feedback, decisions per spec |
| AC-18 | Candidate | portal pages per spec; no internal scores visible |
| AC-19 | Oontu platform | all 15 screens restyled; kill switch confirm |
| AC-20 | Auth | sign in/up/verify/recover/invite/assist/onboarding per T9 with the approved wordmark; password strength; errors inline |
| AC-21 | Outside-app | every hash route renders T8 with the flat wordmark; OTP input; mobile-first at 360 px |
| AC-22 | Overlays | palette, notifications, messages, composer, Kairo chat, toasts (bottom-centre, max 2, never over primary actions) |

---

## 16. Global quality checklist (run before calling any screen done)

**Visual consistency**
- [ ] Page background `#F6F7F9`; cards white, radius 22, `--elev-card`; no card inside a card.
- [ ] Text only in the four text tokens; nothing darker than `#1E2E48`; weights 400/500/600.
- [ ] One primary (navy) action per region; secondary outline; quiet tinted.
- [ ] Status = translucent tint + dot + word; no solid status fills; ≤ 1 attention colour per row.
- [ ] Green only for done/earned/paid/brand.
- [ ] Charts: soft palette, 3 gridlines, totals in legends, last value tagged, no grey series.
- [ ] Approved logo files at the specified sizes; no old marks.
- [ ] Sentence case; no uppercase overlines; no emoji in chrome.

**Functional integrity**
- [ ] Every button, link, menu and shortcut on the screen performs exactly what it did before.
- [ ] Menus and Homes per role identical in membership and order (§5).
- [ ] No data structure, route, localStorage key or handler renamed.
- [ ] No dummy data shown as real; numbers that cannot be computed are omitted and reported.

**Responsiveness**
- [ ] 1440 / 1280 / 1024 / 768 / 390 / 360 checked; no horizontal page scroll; touch targets ≥ 44 below 1024.

**Accessibility**
- [ ] Focus visible everywhere; keyboard paths work; contrast ≥ 4.5:1 for text; reduced motion honoured; charts have labels/tables.

**Performance**
- [ ] No layout thrash on sidebar toggle (one re-measure); animations on transform/opacity; no new libraries; fonts `display=swap`; images/SVG assets cached; no added render passes per `showView`.

---

## Addendum on `agency-prototype-v2` (24 Nov 2026)

Copied from `redesign/balanced-2-0` as the reference spec for this branch. The body above is unchanged. Where later approved work differs, the later work wins:

- **Motion timings:** the approved scale since 21 Nov 2026 is 80 / 120 / 200 / 320 / 480 ms with standard (.2,0,0,1), enter (0,0,0,1) and exit (.3,0,1,1) easing, in `<style id="oontu-motion">`. `tests/motion.spec.js` pins it.
- **OFI motion families** (Oontu Flow Intelligence, approved 24 Nov 2026), on those same tokens, in `<style id="ofi-motion-style">` + `<script id="ofi-motion-script">`: Quiet arrival, Context expansion (opening a job, candidate or client), Guided passage (browser Back from the left, Forward from the right), Focus shift (Kairo panel opening, once), Progress thread, Thoughtful response (the Working pulse), Gentle correction, Confident completion. Every family becomes a short fade under reduced motion. `tests/ofi-motion.spec.js`.
- **Navigation history:** Back and Forward move between screens and records (`<script id="nav-history-script">`, `tests/nav-history.spec.js`).
- **Kairo context:** the chat shows what Kairo is working on and keeps one conversation per context (`kairo-context-script`, `tests/kairo-context.spec.js`).
- **AI states:** one vocabulary for every AI surface: Ready, Working, Waiting, Done, Failed, Needs your confirmation, Partly done (`ai-state-script`, `tests/ai-states.spec.js`).
