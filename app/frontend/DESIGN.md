# Reading Companion — Design (Repro Suite system)

## Direction & Layout
- Part of Repro Suite; must look like the Paper Repro Agent: paper-white, near-black ink, one blue accent, calm and tool-like. No serif fonts, no emoji, no gradients.
- Shell: 248px sticky full-height left sidebar (logo black rounded square with white "C", "Reading Companion", grey "part of Repro Suite"; group "Reading Companion" = in-page anchors Ask, Plan, Tool calls, Notes, Answer, Self-check, Recent questions; group "Repro Suite" = external links with ↗ opening in new tabs; footer = ☾/☀ theme button + EN/中文 pill switch). No top nav on desktop.
- Under 900px: slim top bar with ☰ opening the sidebar as a drawer (scrim, Esc closes). No horizontal scroll at 390px.
- Content max width 1080px; hero + goal card two columns from 1280px, single column below. Run workspace: timeline + 340px notes card from 1024px, notes below timeline on smaller screens.

## Tokens
- Light: bg #FBFBFD, card #FFFFFF, soft #F3F3F6, text #1D1D1F, secondary #5C5C66, border #E4E4EA, accent #2B59FF, accent tint #ECF0FF, success #15803D, warning #B45309, error #C62828.
- Dark: bg #0B0B0E, card #151519, soft #1C1C22, text #F4F4F6, secondary #ADADB8, border #2A2A31, accent #7B96FF, accent tint #1B2146.
- Theme: light first; dark only via toggle, stored in localStorage "repro.theme2".
- Type: Inter + Noto Sans SC; JetBrains Mono for numbers, ids, tool args. Headlines 800, letter-spacing -0.035em.
- Cards radius 16px, 1px border, shadow 0 8px 24px rgba(16,24,40,.06). Buttons are pills (999px); primary = accent fill.

## Shared Patterns & States
- `.card`, `.btn-primary`, `.btn-ghost`, `.nav-item`, `.field`, `.badge`, `.eyebrow` utilities in index.css.
- Status colours only for badges/banners (success = full text, warning = abstract only / unverified, error = failures).
- Focus ring 2px accent; icon buttons have aria-labels; 36–44px targets.

## Media
- Operational tool; no imagery.
