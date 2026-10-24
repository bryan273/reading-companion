---
last_updated: 2026-10-24T18:00:00Z
---

# Architecture Design

## System Overview
Reading Companion: browser-run arXiv research agent. The frontend runs the agent loop (plan -> tool calls -> notes -> answer -> self-check, max 12 LLM turns) against two external Supabase edge functions (agent-llm, paper-tools; no keys in app). Finished sessions are saved publicly in the Atoms Cloud table `reading_sessions` and shown in a gallery and at share links `/s/:shareId`.

## Tech Stack
Vite + React + TS + Tailwind/shadcn; @metagptx/web-sdk for entities; markdown-to-jsx for answers; Atoms Cloud FastAPI backend (auto-generated CRUD).

## Module Design
| Module | Responsibility | Key Files |
|--------|---------------|-----------|
| Agent engine | Tool schemas, LLM loop, tool execution, quote verification, self-check, 429 handling | app/frontend/src/lib/agent.ts |
| Persistence | Save/list/get sessions via client.entities.reading_sessions | app/frontend/src/lib/sessions.ts |
| Prefs/i18n | EN/中文 strings, theme, language context | app/frontend/src/lib/prefs.tsx |
| UI | Header, timeline + notes panel, home, shared session page | src/components/AppHeader.tsx, src/components/RunView.tsx, src/pages/Index.tsx, src/pages/SessionPage.tsx |
| Backend | Public table reading_sessions (create_only=false) | app/backend/routers/reading_sessions.py |

## Tech Decisions
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Table name | reading_sessions | Alembic env excludes table name `sessions` from migrations |
| Agent location | Browser | External gateways are public endpoints with per-visitor id |
| Citation trust | Quotes matched against fetched text locally | Marks notes fulltext/abstract/unmatched; unverified claims flagged |
| Context size | Older read_paper slices elided after 2 | Keep prompts within budget |

## File Tree Plan
See Module Design.

## Implementation Guide
Notes are cited as [n] in the answer; cites link to arXiv; self-check combines LLM review with deterministic checks for missing/abstract-only/unmatched notes.
