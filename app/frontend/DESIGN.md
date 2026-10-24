# Reading Companion — Design

## Direction & Layout
- Purpose: an AI research agent that reads arXiv papers with students/researchers and shows exactly where each statement comes from. Mood: a calm reading room in a university library — quiet, precise, trustworthy. It should feel like an annotated manuscript, not a chatbot or a neon AI dashboard.
- Defining visual idea: the "margin". The workspace is a manuscript column (timeline + answer) with a ruled marginalia column on the right holding notes and quotes, like pencil notes beside a paper. On the home screen the goal box sits on a large serif headline with a thin rule and a numbered set of example goals, like a table of contents.
- Reference: the arXiv abstract page and printed journal margins.
- Max width 1200px; padding 20px mobile / 32px desktop. Workspace grid desktop (>=1024px): 7fr / 5fr with 40px gap; notes panel sticky (top 88px). Below 1024px: single column, notes below the timeline. Section spacing 64px desktop, 40px mobile; card gap 16px.
- Breakpoints: 640 / 1024. Header: brand left, EN/中文 + theme toggle right; never wraps at 390px.
- Do: serif headlines, thin 1px rules, numbered steps, monospace only for tool arguments and arXiv ids. Don't: emoji, gradients, glowing borders, colored left-border cards, chat bubbles, horizontal scroll at 390px.

## Tokens
- Light: background #F7F8FA, surface #FFFFFF, surface-2 #EEF2F7, border #DCE2EA, text #14202E, text-2 #4A5868, text-3 #6B7787, primary #1F4E8C (hover #183F72), primary-soft #E3ECF7, success #2F6B4F, warning #8A5A12 (bg #FBF1DE), danger #A23B3B.
- Dark: background #0E141B, surface #151D27, surface-2 #1C2633, border #2A3644, text #E6ECF2, text-2 #A9B6C4, text-3 #7F8C9A, primary #7FA8DD, primary-soft #1B2B40, success #7CC4A0, warning #E2B46A (bg #33280F), danger #E08787.
- Primary accent stays scarce: CTA buttons, citation numbers, active step marker.
- Type: Fraunces (headings, 500/600, opsz auto), IBM Plex Sans (body 400/500/600), IBM Plex Mono (ids/args). Display 52/1.05 desktop, 36/1.1 mobile; H2 26/1.25; H3 18/1.35; body 16/1.65; small 14/1.5; caption 12/1.4 uppercase tracking 0.08em.
- Spacing scale 4/8/12/16/24/32/40/64. Radii: buttons 8px, inputs 10px, cards 12px, chips 999px. Icon buttons 40px circular.
- Elevation: borders first (1px border token); cards get shadow 0 1px 2px rgba(20,32,46,.05); sticky header uses surface at 92% with backdrop blur 8px and bottom border.

## Shared Patterns & States
- Goal composer: textarea (min 96px), arXiv id input, language-aware primary button "Start reading"; disabled while running.
- Example goals: numbered rows (01, 02, 03) with hover surface-2 and arrow; click fills and starts.
- Timeline: vertical rule with step markers for Plan, Tool calls, Notes, Answer, Self-check. Tool call rows: mono name + args, status (running spinner / done / error), result preview clamped to 3 lines. New rows fade in 180ms ease-out.
- Notes panel: numbered notes; paper id (mono, link to arXiv), finding, quote in serif italic with left quotation mark, verification badge (full text / abstract only / not matched).
- Answer: markdown prose; citations as superscript-sized blue [n] links to arXiv; unverified citations show a warning chip "unverified".
- Self-check: list of unverified claims with reason, warning tone.
- States: empty gallery text, loading skeletons, error banner (danger), rate limit banner (warning, friendly copy), saved banner with share link + copy button.
- Motion: 150–200ms ease-out only; no motion on content load beyond fade; respects prefers-reduced-motion.
- Accessibility: 40px min targets, focus ring 2px primary with 2px offset, icon buttons have aria-labels, contrast AA.

## Media
- Operational research tool; no photography needed. Identity comes from typography and rules. No abstract gradients or decorative SVGs.
