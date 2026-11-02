import type { Lang } from './prefs';

const BASE = 'https://vzvyghmtsakixlhzzuol.supabase.co/functions/v1';
const LLM_URL = `${BASE}/agent-llm`;
const PAPER_URL = `${BASE}/paper-tools`;

export const MAX_TURNS = 12;
const MAX_QUOTE_WORDS = 25;

export type Verification = 'fulltext' | 'abstract' | 'unmatched';
export type Stage = 'plan' | 'tools' | 'answer' | 'selfcheck' | 'done';

export interface Note {
  n: number;
  paper_id: string;
  text: string;
  quote: string;
  verification: Verification;
}

export interface ToolEvent {
  id: string;
  turn: number;
  name: string;
  args: Record<string, unknown>;
  status: 'running' | 'done' | 'error';
  preview: string;
}

export interface SelfCheckItem {
  claim: string;
  notes: number[];
  reason: string;
}

export interface SelfCheck {
  summary: string;
  items: SelfCheckItem[];
}

export interface PaperMeta {
  id: string;
  title: string;
  authors: string[];
  published: string;
  fullText?: 'yes' | 'no';
}

export interface Usage {
  prompt: number;
  completion: number;
  total: number;
}

export interface AgentRun {
  stage: Stage;
  plan: string[];
  events: ToolEvent[];
  notes: Note[];
  answer: string;
  selfCheck: SelfCheck | null;
  papers: Record<string, PaperMeta>;
  usage: Usage;
  turns: number;
}

export class AgentError extends Error {
  kind: 'rate' | 'aborted' | 'other';
  constructor(kind: 'rate' | 'aborted' | 'other', message: string) {
    super(message);
    this.kind = kind;
  }
}

export function emptyRun(): AgentRun {
  return {
    stage: 'plan',
    plan: [],
    events: [],
    notes: [],
    answer: '',
    selfCheck: null,
    papers: {},
    usage: { prompt: 0, completion: 0, total: 0 },
    turns: 0,
  };
}

export function getVisitorId(): string {
  let v = localStorage.getItem('rc_visitor');
  if (!v) {
    const rand =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
    v = `v_${rand}`;
    localStorage.setItem('rc_visitor', v);
  }
  return v;
}

export function parseArxivId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  const modern = s.match(/(\d{4}\.\d{4,5})(v\d+)?/);
  if (modern) return modern[1];
  const legacy = s.match(/([a-z-]+(?:\.[A-Z]{2})?\/\d{7})/);
  return legacy ? legacy[1] : null;
}

export function arxivUrl(id: string): string {
  return `https://arxiv.org/abs/${id}`;
}

function normalize(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function quoteFound(quote: string, source: string): boolean {
  const q = normalize(quote);
  if (!q || !source) return false;
  const src = normalize(source);
  if (src.includes(q)) return true;
  const words = q.split(' ');
  if (words.length < 4) return false;
  let hit = 0;
  let total = 0;
  for (let i = 0; i + 4 <= words.length; i++) {
    total++;
    if (src.includes(words.slice(i, i + 4).join(' '))) hit++;
  }
  return hit / total >= 0.8;
}

export function citedNumbers(answer: string): number[] {
  const out = new Set<number>();
  for (const m of answer.matchAll(/\[(\d+(?:\s*[,，]\s*\d+)*)\]/g)) {
    for (const part of m[1].split(/[,，]/)) out.add(Number(part.trim()));
  }
  return [...out].filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
}

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_arxiv',
      description: 'Search arXiv. Returns a list of {id, title, authors, published, summary}.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          limit: { type: 'integer', minimum: 1, maximum: 10, description: 'Number of results, default 6' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_abstract',
      description: 'Get the abstract and metadata of one arXiv paper: {id, title, authors, published, summary}.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: 'arXiv id, e.g. 1607.01759' } },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_paper',
      description:
        'Read the full text of an arXiv paper in slices of about 9000 characters. Returns {text, next_offset, total_chars}. Call again with next_offset to continue. Fails when the paper has no HTML version.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'arXiv id' },
          offset: { type: 'integer', minimum: 0, description: 'Character offset, start with 0' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'note',
      description:
        'Save a short finding with its source to the notes panel. The quote must be copied verbatim from text returned by a tool, at most 25 words. Returns the note number to cite as [n].',
      parameters: {
        type: 'object',
        properties: {
          paper_id: { type: 'string', description: 'arXiv id of the source paper' },
          text: { type: 'string', description: 'The finding in one sentence, in the answer language' },
          quote: { type: 'string', description: 'Verbatim quote from the paper, max 25 words' },
        },
        required: ['paper_id', 'text', 'quote'],
      },
    },
  },
];

interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface RunOptions {
  goal: string;
  paperId: string | null;
  lang: Lang;
  signal: AbortSignal;
  onUpdate: (run: AgentRun) => void;
}

const langName = (lang: Lang) => (lang === 'zh' ? 'Simplified Chinese (简体中文)' : 'English');

function truncate(s: string, n: number): string {
  const clean = s.replace(/\s+/g, ' ').trim();
  return clean.length > n ? `${clean.slice(0, n - 1)}…` : clean;
}

function extractJson(raw: string): Record<string, unknown> | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parsePlan(raw: string): string[] {
  const json = extractJson(raw);
  let steps: string[] = [];
  if (json && Array.isArray(json.plan)) steps = json.plan.map((s) => String(s).trim()).filter(Boolean);
  if (!steps.length) {
    steps = raw
      .split('\n')
      .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
      .filter((l) => l.length > 3 && !l.startsWith('{') && !l.startsWith('}'));
  }
  return steps.slice(0, 5);
}

export async function runAgent({ goal, paperId, lang, signal, onUpdate }: RunOptions): Promise<AgentRun> {
  const run = emptyRun();
  const corpus: Record<string, { abstract: string; text: string; offsets: Set<number> }> = {};

  const emit = () =>
    onUpdate({
      ...run,
      plan: [...run.plan],
      events: run.events.map((e) => ({ ...e })),
      notes: [...run.notes],
      papers: { ...run.papers },
      usage: { ...run.usage },
    });

  const ensure = (id: string) => {
    if (!corpus[id]) corpus[id] = { abstract: '', text: '', offsets: new Set() };
    return corpus[id];
  };

  const rememberPaper = (p: Record<string, unknown>) => {
    const id = String(p.id ?? '');
    if (!id) return;
    run.papers[id] = {
      ...run.papers[id],
      id,
      title: String(p.title ?? run.papers[id]?.title ?? id),
      authors: Array.isArray(p.authors) ? p.authors.map(String) : run.papers[id]?.authors ?? [],
      published: String(p.published ?? run.papers[id]?.published ?? ''),
    };
    const summary = String(p.summary ?? '');
    if (summary) ensure(id).abstract = summary;
  };

  async function callLLM(messages: LLMMessage[], withTools: boolean): Promise<LLMMessage> {
    let res: Response | null = null;
    // the gateway sometimes answers "busy" (503) or the connection drops: try again a couple of times before giving up
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        res = await fetch(LLM_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            app: 'companion',
            visitor: getVisitorId(),
            messages,
            ...(withTools ? { tools: TOOLS } : {}),
            max_tokens: 2000,
          }),
          signal,
        });
      } catch (e) {
        if (signal.aborted) throw new AgentError('aborted', 'aborted');
        if (attempt === 2) throw new AgentError('other', e instanceof Error ? e.message : 'Network error');
        await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
        continue;
      }
      if (res.status < 500 || attempt === 2) break;
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
    }
    if (!res) throw new AgentError('other', 'Network error');
    if (res.status === 429) throw new AgentError('rate', 'rate limit');
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new AgentError('other', `LLM gateway ${res.status} ${truncate(body, 160)}`);
    }
    const data = (await res.json()) as {
      message?: { content?: string | null; tool_calls?: ToolCall[] };
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    run.turns += 1;
    run.usage.prompt += data.usage?.prompt_tokens ?? 0;
    run.usage.completion += data.usage?.completion_tokens ?? 0;
    run.usage.total += data.usage?.total_tokens ?? 0;
    const calls = (data.message?.tool_calls ?? []).map((c, i) => ({
      id: c.id || `call_${run.turns}_${i}`,
      type: 'function' as const,
      function: { name: c.function?.name ?? '', arguments: c.function?.arguments ?? '{}' },
    }));
    return { role: 'assistant', content: data.message?.content ?? '', ...(calls.length ? { tool_calls: calls } : {}) };
  }

  async function paperTools(body: Record<string, unknown>) {
    let res: Response;
    try {
      res = await fetch(PAPER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      });
    } catch (e) {
      if (signal.aborted) throw new AgentError('aborted', 'aborted');
      return { ok: false, status: 0, data: { error: e instanceof Error ? e.message : 'Network error' } };
    }
    if (res.status === 429) throw new AgentError('rate', 'rate limit');
    let data: Record<string, unknown> = {};
    try {
      data = (await res.json()) as Record<string, unknown>;
    } catch {
      data = { error: `Invalid response (${res.status})` };
    }
    return { ok: res.ok, status: res.status, data };
  }

  async function execTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<{ result: Record<string, unknown>; preview: string; ok: boolean }> {
    if (name === 'search_arxiv') {
      const query = String(args.query ?? '').trim();
      const limit = Math.min(10, Math.max(1, Number(args.limit) || 6));
      if (!query) return { ok: false, result: { error: 'query is required' }, preview: 'query is required' };
      const { ok, data } = await paperTools({ action: 'search', query, limit });
      if (!ok) return { ok: false, result: { error: data.error ?? 'search failed' }, preview: String(data.error ?? 'search failed') };
      const results = (Array.isArray(data.results) ? data.results : []) as Record<string, unknown>[];
      results.forEach(rememberPaper);
      const list = results.map((p) => ({
        id: p.id,
        title: p.title,
        authors: Array.isArray(p.authors) ? p.authors.slice(0, 6) : [],
        published: p.published,
        summary: truncate(String(p.summary ?? ''), 700),
      }));
      const preview = list.length
        ? `${list.length} · ${list.map((p) => `${p.id} ${truncate(String(p.title), 60)}`).join(' · ')}`
        : '0 results';
      return { ok: true, result: { results: list }, preview };
    }

    if (name === 'get_abstract') {
      const id = parseArxivId(String(args.id ?? '')) ?? String(args.id ?? '');
      const { ok, data } = await paperTools({ action: 'abstract', id });
      const paper = data.paper as Record<string, unknown> | undefined;
      if (!ok || !paper) {
        const err = String(data.error ?? 'abstract not found');
        return { ok: false, result: { error: err }, preview: err };
      }
      rememberPaper(paper);
      return {
        ok: true,
        result: paper,
        preview: `${truncate(String(paper.title), 90)} (${paper.published}) · ${truncate(String(paper.summary ?? ''), 140)}`,
      };
    }

    if (name === 'read_paper') {
      const id = parseArxivId(String(args.id ?? '')) ?? String(args.id ?? '');
      const offset = Math.max(0, Number(args.offset) || 0);
      const { ok, status, data } = await paperTools({ action: 'text', id, offset });
      if (!ok || typeof data.text !== 'string') {
        const err = String(data.error ?? `read failed (${status})`);
        if (status === 404 || /html|pdf/i.test(err)) {
          run.papers[id] = { ...(run.papers[id] ?? { id, title: id, authors: [], published: '' }), fullText: 'no' };
          return {
            ok: false,
            result: {
              error: err,
              instruction:
                'This paper has no readable HTML full text. Use get_abstract, say clearly in the answer that only the abstract was available, and cite the abstract.',
            },
            preview: err,
          };
        }
        return { ok: false, result: { error: err }, preview: err };
      }
      const c = ensure(id);
      if (!c.offsets.has(offset)) {
        c.offsets.add(offset);
        c.text += `\n${data.text}`;
      }
      run.papers[id] = { ...(run.papers[id] ?? { id, title: id, authors: [], published: '' }), fullText: 'yes' };
      if (run.papers[id].title === id) {
        const firstLine = data.text.split('\n')[0]?.trim();
        if (firstLine) run.papers[id].title = truncate(firstLine, 120);
      }
      const total = Number(data.total_chars) || 0;
      const next = typeof data.next_offset === 'number' ? data.next_offset : null;
      const end = offset + data.text.length;
      return {
        ok: true,
        result: { id, offset, next_offset: next, total_chars: total, text: data.text },
        preview: `${offset}–${end} / ${total} · ${truncate(data.text.slice(0, 400), 150)}`,
      };
    }

    if (name === 'note') {
      const paper_id = parseArxivId(String(args.paper_id ?? '')) ?? String(args.paper_id ?? '').trim();
      const text = String(args.text ?? '').trim();
      let quote = String(args.quote ?? '').trim().replace(/^["“'']+|["”'']+$/g, '');
      if (!paper_id || !text || !quote) {
        return { ok: false, result: { error: 'paper_id, text and quote are required' }, preview: 'missing fields' };
      }
      const words = quote.split(/\s+/);
      let trimmed = false;
      if (words.length > MAX_QUOTE_WORDS) {
        quote = `${words.slice(0, MAX_QUOTE_WORDS).join(' ')}…`;
        trimmed = true;
      }
      const c = corpus[paper_id];
      const plainQuote = quote.replace(/…$/, '');
      const verification: Verification = c && quoteFound(plainQuote, c.text)
        ? 'fulltext'
        : c && quoteFound(plainQuote, c.abstract)
          ? 'abstract'
          : 'unmatched';
      const note: Note = { n: run.notes.length + 1, paper_id, text, quote, verification };
      run.notes.push(note);
      const result: Record<string, unknown> = { saved: true, note_number: note.n, cite_as: `[${note.n}]`, verification };
      if (trimmed) result.warning = 'Quote was longer than 25 words and was shortened.';
      if (verification === 'unmatched')
        result.warning = 'The quote was not found verbatim in any text you have read for this paper. Claims based on it will be marked unverified.';
      if (verification === 'abstract') result.info = 'Quote matched the abstract only, not the full text.';
      return { ok: true, result, preview: `[${note.n}] ${truncate(text, 110)}` };
    }

    return { ok: false, result: { error: `Unknown tool ${name}` }, preview: `unknown tool ${name}` };
  }

  const language = langName(lang);
  const system = [
    'You are Reading Companion, a careful research agent that reads arXiv papers with students and researchers.',
    'Tools: search_arxiv, get_abstract, read_paper, note.',
    'Rules:',
    '- Execute your plan step by step. Call several independent tools in the same turn when possible.',
    '- Prefer evidence from the full text via read_paper (slices of about 9000 characters). Decide whether to read further with next_offset; read the parts needed for the goal (results, experiments, datasets, code availability).',
    '- If read_paper says there is no HTML version, say so in the answer and use the abstract only.',
    '- Save every finding you will use with note(paper_id, text, quote). The quote must be copied verbatim from tool output and be at most 25 words. Write note text in ' + language + '.',
    '- Every claim in the final answer must cite note numbers like [1] or [2][3]. Never cite anything that is not a saved note. Never invent paper ids or quotes.',
    `- You have at most ${MAX_TURNS} model turns in total, including planning and self-check. Be efficient.`,
    `- When you have enough notes, reply WITHOUT tool calls with the final answer only: concise (at most about 250 words), markdown paragraphs or bullets, written in ${language}. Do not add a separate reference list. State clearly when something is based only on the abstract.`,
  ].join('\n');

  const goalText = `Goal: ${goal}${paperId ? `\nPaper: arXiv ${paperId}` : ''}`;
  const messages: LLMMessage[] = [
    { role: 'system', content: system },
    {
      role: 'user',
      content: `${goalText}\n\nBefore using any tool, write a research plan of 3 to 5 short steps in ${language}. Reply with JSON only: {"plan": ["step 1", "step 2", "step 3"]}`,
    },
  ];

  emit();
  const planMsg = await callLLM(messages, false);
  run.plan = parsePlan(planMsg.content);
  if (!run.plan.length) run.plan = [goal];
  messages.push({ role: 'assistant', content: JSON.stringify({ plan: run.plan }) });
  messages.push({
    role: 'user',
    content: 'Plan accepted. Now execute it with the tools. Save notes with verbatim quotes, then write the final answer.',
  });
  run.stage = 'tools';
  emit();

  const readIndexes: number[] = [];
  let nudged = false;
  while (true) {
    const left = MAX_TURNS - 1 - run.turns;
    if (left <= 1) {
      messages.push({
        role: 'user',
        content: `Turn budget reached. Write the final answer now in ${language}, using only your saved notes and citing their numbers.`,
      });
      run.stage = 'answer';
      emit();
      const final = await callLLM(messages, false);
      run.answer = final.content.trim();
      break;
    }
    const msg = await callLLM(messages, true);
    const calls = msg.tool_calls ?? [];
    if (!calls.length) {
      if (!run.notes.length && !nudged && left > 3) {
        nudged = true;
        messages.push({ role: 'assistant', content: msg.content });
        messages.push({
          role: 'user',
          content: '[Automatic reminder from the tool, not a message from the user. The user has not replied. Do not mention this reminder or say the user is right.] No notes are saved yet. Read the relevant source and save notes with verbatim quotes before answering. If the question cannot be answered from arXiv papers, say so plainly in one or two sentences.',
        });
        emit();
        continue;
      }
      run.stage = 'answer';
      run.answer = msg.content.trim();
      break;
    }
    messages.push(msg);
    for (const call of calls) {
      let args: Record<string, unknown> = {};
      let parseError = false;
      try {
        args = JSON.parse(call.function.arguments || '{}') as Record<string, unknown>;
      } catch {
        parseError = true;
      }
      const event: ToolEvent = {
        id: call.id,
        turn: run.turns,
        name: call.function.name,
        args,
        status: 'running',
        preview: '',
      };
      run.events.push(event);
      emit();
      const out = parseError
        ? { ok: false, result: { error: 'Arguments were not valid JSON' }, preview: 'invalid arguments' }
        : await execTool(call.function.name, args);
      event.status = out.ok ? 'done' : 'error';
      event.preview = out.preview;
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(out.result) });
      if (call.function.name === 'read_paper' && out.ok) readIndexes.push(messages.length - 1);
      emit();
    }
    while (readIndexes.length > 2) {
      const idx = readIndexes.shift() as number;
      messages[idx] = {
        ...messages[idx],
        content: JSON.stringify({ elided: true, info: 'This slice was read earlier. Rely on your saved notes or read it again if needed.' }),
      };
    }
  }

  if (!run.answer) throw new AgentError('other', 'The agent returned an empty answer.');
  run.stage = 'selfcheck';
  emit();

  run.selfCheck = await selfCheck(run, lang, async (msgs) => callLLM(msgs, false));
  run.stage = 'done';
  emit();
  return run;
}

async function selfCheck(
  run: AgentRun,
  lang: Lang,
  call: (messages: LLMMessage[]) => Promise<LLMMessage>
): Promise<SelfCheck> {
  const language = langName(lang);
  const notesBlock = run.notes.length
    ? run.notes
        .map(
          (n) =>
            `[${n.n}] paper ${n.paper_id}${run.papers[n.paper_id]?.fullText === 'no' ? ' (no full text, abstract only)' : ''} | verification: ${n.verification} | finding: ${n.text} | quote: "${n.quote}"`
        )
        .join('\n')
    : '(no notes were saved)';

  let summary = '';
  let items: SelfCheckItem[] = [];
  try {
    const msg = await call([
      { role: 'system', content: 'You are the self-check step of a research agent. Re-read the notes and the answer critically and honestly.' },
      {
        role: 'user',
        content: `Answer:\n${run.answer}\n\nNotes:\n${notesBlock}\n\nVerification legend: fulltext = quote found in the full text that was read; abstract = quote found only in an abstract or search summary; unmatched = quote not found in any text that was read.\n\nList every claim in the answer that (a) has no citation, (b) cites a note that does not actually support it, (c) relies only on notes with verification "abstract" or "unmatched", or (d) cites a note number that does not exist. Write in ${language}. Reply with JSON only: {"summary": "one or two sentences", "items": [{"claim": "short paraphrase of the claim", "notes": [1], "reason": "why it is unverified"}]}. Use an empty items list if everything is verified.`,
      },
    ]);
    const json = extractJson(msg.content);
    if (json) {
      summary = String(json.summary ?? '');
      if (Array.isArray(json.items)) {
        items = (json.items as Record<string, unknown>[])
          .map((it) => ({
            claim: String(it.claim ?? '').trim(),
            notes: Array.isArray(it.notes) ? it.notes.map(Number).filter((x) => Number.isFinite(x)) : [],
            reason: String(it.reason ?? '').trim(),
          }))
          .filter((it) => it.claim);
      }
    }
  } catch (e) {
    if (e instanceof AgentError && e.kind === 'aborted') throw e;
  }

  const zh = lang === 'zh';
  const covered = new Set(items.flatMap((i) => i.notes));
  const sentences = run.answer.split(/(?<=[.!?。！？])\s+|\n+/);
  for (const n of citedNumbers(run.answer)) {
    if (covered.has(n)) continue;
    const note = run.notes.find((x) => x.n === n);
    const sentence = sentences.find((s) => new RegExp(`\\[(?:[\\d,，\\s]*\\b)?${n}\\b`).test(s));
    const claim = truncate((sentence ?? `[${n}]`).replace(/\[[\d,，\s]+\]/g, ''), 160) || `[${n}]`;
    if (!note) {
      items.push({ claim, notes: [n], reason: zh ? `引用 [${n}] 没有对应的笔记。` : `Citation [${n}] has no matching note.` });
    } else if (note.verification === 'abstract') {
      items.push({ claim, notes: [n], reason: zh ? '仅在摘要中找到依据，未在全文中核实。' : 'Supported by the abstract only, not checked against the full text.' });
    } else if (note.verification === 'unmatched') {
      items.push({ claim, notes: [n], reason: zh ? '笔记中的引文未在已阅读的原文中找到。' : 'The quote in this note was not found in the text that was read.' });
    }
  }
  if (!summary) {
    summary = items.length
      ? zh
        ? `有 ${items.length} 处说法无法完全核实，已标记为“未核实”。`
        : `${items.length} claim(s) could not be fully verified and are marked unverified.`
      : zh
        ? '所有被引用的说法都有全文笔记支持。'
        : 'All cited claims are backed by notes matched in the full text.';
  }
  return { summary, items };
}
