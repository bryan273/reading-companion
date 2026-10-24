import { client } from './api';
import { citedNumbers, getVisitorId, type AgentRun, type Note, type PaperMeta, type SelfCheck, type ToolEvent } from './agent';
import type { Lang } from './prefs';

export interface SessionRecord {
  id: number;
  share_id: string;
  goal: string;
  paper_id?: string | null;
  language: string;
  answer: string;
  plan_json?: string | null;
  notes_json?: string | null;
  sources_json?: string | null;
  self_check?: string | null;
  steps_json?: string | null;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  total_tokens?: number | null;
  turns?: number | null;
  visitor?: string | null;
  created_at?: string | null;
}

export interface SavedSession {
  record: SessionRecord;
  run: AgentRun;
}

function randomShareId(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 10; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

function parse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function saveSession(run: AgentRun, goal: string, paperId: string | null, lang: Lang): Promise<string> {
  const share_id = randomShareId();
  const usedIds = new Set(run.notes.map((n) => n.paper_id));
  const sources = [...usedIds].map((id) => {
    const p = run.papers[id];
    return { id, title: p?.title ?? id, authors: p?.authors ?? [], published: p?.published ?? '', fullText: p?.fullText };
  });
  const steps = run.events.map((e) => ({ ...e, preview: e.preview.slice(0, 400) }));
  await client.entities.reading_sessions.create({
    data: {
      share_id,
      goal,
      paper_id: paperId ?? '',
      language: lang,
      answer: run.answer,
      plan_json: JSON.stringify(run.plan),
      notes_json: JSON.stringify(run.notes),
      sources_json: JSON.stringify(sources),
      self_check: JSON.stringify(run.selfCheck),
      steps_json: JSON.stringify(steps),
      prompt_tokens: run.usage.prompt,
      completion_tokens: run.usage.completion,
      total_tokens: run.usage.total,
      turns: run.turns,
      visitor: getVisitorId(),
    },
  });
  return share_id;
}

export async function listRecentSessions(limit = 12): Promise<SessionRecord[]> {
  const res = await client.entities.reading_sessions.query({
    query: {},
    sort: '-created_at',
    limit,
    fields: ['id', 'share_id', 'goal', 'paper_id', 'language', 'total_tokens', 'turns', 'created_at', 'notes_json'],
  });
  return (res?.data?.items ?? []) as SessionRecord[];
}

export async function getSessionByShareId(shareId: string): Promise<SavedSession | null> {
  const res = await client.entities.reading_sessions.query({ query: { share_id: shareId }, limit: 1 });
  const record = (res?.data?.items ?? [])[0] as SessionRecord | undefined;
  if (!record) return null;
  const sources = parse<PaperMeta[]>(record.sources_json, []);
  const papers: Record<string, PaperMeta> = {};
  for (const s of sources) papers[s.id] = s;
  const run: AgentRun = {
    stage: 'done',
    plan: parse<string[]>(record.plan_json, []),
    events: parse<ToolEvent[]>(record.steps_json, []),
    notes: parse<Note[]>(record.notes_json, []),
    answer: record.answer,
    selfCheck: parse<SelfCheck | null>(record.self_check, null),
    papers,
    usage: {
      prompt: record.prompt_tokens ?? 0,
      completion: record.completion_tokens ?? 0,
      total: record.total_tokens ?? 0,
    },
    turns: record.turns ?? 0,
  };
  return { record, run };
}

export function noteCount(record: SessionRecord): number {
  return parse<Note[]>(record.notes_json, []).length;
}

export { citedNumbers };
