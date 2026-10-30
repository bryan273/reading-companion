import { useMemo, type ReactNode } from 'react';
import Markdown from 'markdown-to-jsx';
import { AlertTriangle, Check, ExternalLink, Loader2, X } from 'lucide-react';
import { arxivUrl, MAX_TURNS, type AgentRun, type Note, type Stage, type ToolEvent } from '@/lib/agent';
import { usePrefs, type StringKey } from '@/lib/prefs';
import { cn } from '@/lib/utils';

type StepState = 'pending' | 'active' | 'done';

const ORDER: Stage[] = ['plan', 'tools', 'answer', 'selfcheck', 'done'];

function stateFor(current: Stage, step: Stage, live: boolean): StepState {
  const ci = ORDER.indexOf(current);
  const si = ORDER.indexOf(step);
  if (ci > si) return 'done';
  if (ci === si) return live ? 'active' : 'done';
  return 'pending';
}

function Step({
  id,
  index,
  title,
  state,
  children,
  last,
}: {
  id: string;
  index: number;
  title: string;
  state: StepState;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <li id={id} className="relative flex scroll-mt-20 gap-3.5">
      {!last && <span aria-hidden className="absolute left-[14px] top-8 h-[calc(100%-26px)] w-px bg-border" />}
      <span
        aria-hidden
        className={cn(
          'relative z-10 mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[12px] font-semibold',
          state === 'done' && 'border-primary bg-primary text-primary-foreground',
          state === 'active' && 'border-primary bg-primary-soft text-accent-foreground',
          state === 'pending' && 'border-border bg-card text-subtle'
        )}
      >
        {state === 'done' ? <Check className="h-3.5 w-3.5" /> : state === 'active' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : index}
      </span>
      <div className="min-w-0 flex-1 pb-7">
        <h3 className={cn('mb-2.5 text-[15px] leading-7', state === 'pending' && 'text-subtle')}>{title}</h3>
        {children}
      </div>
    </li>
  );
}

function formatArg(v: unknown): string {
  if (typeof v === 'string') return `"${v}"`;
  return JSON.stringify(v);
}

function ToolRow({ e }: { e: ToolEvent }) {
  const { t } = usePrefs();
  return (
    <li className="fade-in rounded-[12px] border border-border bg-card p-3">
      <div className="flex items-start gap-2">
        <span className="mt-1 shrink-0">
          {e.status === 'running' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-label={t('running')} />
          ) : e.status === 'done' ? (
            <Check className="h-3.5 w-3.5 text-success" aria-label={t('done')} />
          ) : (
            <X className="h-3.5 w-3.5 text-destructive" aria-label="error" />
          )}
        </span>
        <div className="min-w-0 flex-1 font-mono text-[12.5px] leading-5 [overflow-wrap:anywhere]">
          <span className="font-medium text-accent-foreground">{e.name}</span>
          <span className="text-muted-foreground">(</span>
          {Object.entries(e.args).map(([k, v], i) => (
            <span key={k}>
              {i > 0 && <span className="text-muted-foreground">, </span>}
              <span className="text-muted-foreground">{k}=</span>
              <span>{formatArg(v).slice(0, 160)}</span>
            </span>
          ))}
          <span className="text-muted-foreground">)</span>
        </div>
        <span className="shrink-0 pt-0.5 text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">
          {t('turn')} {e.turn}
        </span>
      </div>
      {e.preview && (
        <p
          className={cn(
            'mt-2 line-clamp-3 border-t border-border pt-2 text-[13px] leading-5 [overflow-wrap:anywhere]',
            e.status === 'error' ? 'text-destructive' : 'text-muted-foreground'
          )}
        >
          {e.preview}
        </p>
      )}
    </li>
  );
}

const VERIFY_KEY: Record<Note['verification'], StringKey> = {
  fulltext: 'vFulltext',
  abstract: 'vAbstract',
  unmatched: 'vUnmatched',
};

export function NotesPanel({ run }: { run: AgentRun }) {
  const { t } = usePrefs();
  const sources = [...new Set(run.notes.map((n) => n.paper_id))];
  return (
    <aside id="stage-notes-panel" aria-labelledby="notes-title" className="card scroll-mt-20 p-5">
      <h2 id="notes-title" className="text-[16px]">
        {t('notesTitle')}
      </h2>
      {run.notes.length === 0 ? (
        <p className="mt-2.5 text-[13.5px] text-muted-foreground">{t('notesEmpty')}</p>
      ) : (
        <ol className="mt-3 divide-y divide-border">
          {run.notes.map((n) => (
            <li key={n.n} id={`note-${n.n}`} className="fade-in scroll-mt-24 py-3.5 first:pt-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[13px] font-medium text-accent-foreground">[{n.n}]</span>
                <a
                  href={arxivUrl(n.paper_id)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-[12px] text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
                >
                  arXiv {n.paper_id}
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
                <span
                  className={cn(
                    'badge',
                    n.verification === 'fulltext'
                      ? 'bg-success-soft text-success'
                      : 'bg-warning-soft text-warning'
                  )}
                >
                  {t(VERIFY_KEY[n.verification])}
                </span>
              </div>
              <p className="mt-1.5 text-[13.5px] leading-6 [overflow-wrap:anywhere]">{n.text}</p>
              <blockquote className="mt-1.5 border-l-2 border-border pl-2.5 text-[13px] italic leading-5 text-muted-foreground [overflow-wrap:anywhere]">
                “{n.quote}”
              </blockquote>
            </li>
          ))}
        </ol>
      )}
      {sources.length > 0 && (
        <div className="mt-1 border-t border-border pt-3.5">
          <p className="eyebrow">{t('sources')}</p>
          <ul className="mt-2 space-y-1.5">
            {sources.map((id) => {
              const p = run.papers[id];
              return (
                <li key={id} className="text-[13px] leading-5 [overflow-wrap:anywhere]">
                  <a href={arxivUrl(id)} target="_blank" rel="noreferrer" className="font-medium hover:text-primary hover:underline">
                    {p?.title && p.title !== id ? p.title : `arXiv ${id}`}
                  </a>
                  <span className="text-muted-foreground">
                    {' '}
                    · {id}
                    {p?.published ? ` · ${p.published.slice(0, 4)}` : ''}
                    {p?.fullText === 'no' ? ` · ${t('noHtml')}` : ''}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </aside>
  );
}

function AnswerBody({ run }: { run: AgentRun }) {
  const { t } = usePrefs();
  const unverified = useMemo(() => {
    const s = new Set<number>();
    run.notes.forEach((n) => n.verification !== 'fulltext' && s.add(n.n));
    run.selfCheck?.items.forEach((i) => i.notes.forEach((n) => s.add(n)));
    return s;
  }, [run.notes, run.selfCheck]);

  const source = useMemo(
    () =>
      run.answer.replace(/\[(\d+(?:\s*[,，]\s*\d+)*)\]/g, (_m, group: string) =>
        group
          .split(/[,，]/)
          .map((x) => `<cite data-n="${x.trim()}"></cite>`)
          .join('')
      ),
    [run.answer]
  );

  const Cite = ({ 'data-n': dn }: { 'data-n'?: string }) => {
    const n = Number(dn);
    const note = run.notes.find((x) => x.n === n);
    const flagged = unverified.has(n) || !note;
    return (
      <span className="whitespace-nowrap">
        <a
          href={note ? arxivUrl(note.paper_id) : `#note-${n}`}
          target={note ? '_blank' : undefined}
          rel="noreferrer"
          title={note ? `arXiv ${note.paper_id}: “${note.quote}”` : t('missingNote')}
          className="mx-0.5 rounded px-0.5 font-mono text-[0.82em] font-medium text-primary no-underline hover:bg-primary-soft"
        >
          [{n}]
        </a>
        {flagged && (
          <span className="ml-0.5 rounded-full bg-warning-soft px-1.5 py-px align-middle text-[10.5px] font-semibold text-warning">
            {t('unverified')}
          </span>
        )}
      </span>
    );
  };

  return (
    <div className="answer">
      <Markdown options={{ overrides: { cite: { component: Cite } } }}>{source}</Markdown>
    </div>
  );
}

export default function RunView({ run, live }: { run: AgentRun; live: boolean }) {
  const { t } = usePrefs();
  const s = (step: Stage) => stateFor(run.stage, step, live);
  const fullCount = run.notes.filter((n) => n.verification === 'fulltext').length;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:gap-8">
      <div className="min-w-0">
        <div className="mb-5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[12px] text-muted-foreground">
          <span>{t('turns', { n: run.turns, max: MAX_TURNS })}</span>
          {run.usage.total > 0 && <span>{t('tokens', { n: run.usage.total.toLocaleString() })}</span>}
        </div>
        <ol>
          <Step id="stage-plan" index={1} title={t('stagePlan')} state={s('plan')}>
            {run.plan.length ? (
              <ol className="space-y-1.5">
                {run.plan.map((p, i) => (
                  <li key={i} className="flex gap-2.5 text-[13.5px] leading-6">
                    <span className="font-mono text-[12px] text-subtle">{String(i + 1).padStart(2, '0')}</span>
                    <span className="min-w-0 [overflow-wrap:anywhere]">{p}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-[13.5px] text-muted-foreground">{t('planDrafting')}</p>
            )}
          </Step>
          <Step id="stage-tools" index={2} title={t('stageTools')} state={s('tools')}>
            {run.events.length ? (
              <ul className="space-y-2">
                {run.events.map((e) => (
                  <ToolRow key={e.id} e={e} />
                ))}
              </ul>
            ) : (
              <p className="text-[13.5px] text-muted-foreground">{t('toolsWaiting')}</p>
            )}
          </Step>
          <Step
            id="stage-notes"
            index={3}
            title={t('stageNotes')}
            state={run.notes.length ? 'done' : s('tools') === 'done' ? 'done' : 'pending'}
          >
            <p className="text-[13.5px] text-muted-foreground">
              {run.notes.length ? t('notesSummary', { n: run.notes.length, f: fullCount }) : t('notesNone')}
            </p>
          </Step>
          <Step id="stage-answer" index={4} title={t('stageAnswer')} state={s('answer')}>
            {run.answer ? <AnswerBody run={run} /> : <p className="text-[13.5px] text-muted-foreground">{t('answerWaiting')}</p>}
          </Step>
          <Step id="stage-selfcheck" index={5} title={t('stageSelfcheck')} state={s('selfcheck')} last>
            {run.selfCheck ? (
              <div
                className={cn(
                  'rounded-[14px] border p-3.5',
                  run.selfCheck.items.length ? 'border-warning/30 bg-warning-soft' : 'border-border bg-card'
                )}
              >
                <p className="text-[13.5px] leading-6">{run.selfCheck.summary || t('checkAllGood')}</p>
                {run.selfCheck.items.length > 0 && (
                  <ul className="mt-2.5 space-y-2">
                    {run.selfCheck.items.map((it, i) => (
                      <li key={i} className="flex gap-2 text-[13px] leading-5">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
                        <span className="min-w-0 [overflow-wrap:anywhere]">
                          <span className="mr-1.5 inline-block rounded-full bg-card px-1.5 py-px align-middle text-[10.5px] font-semibold text-warning">
                            {t('unverified')}
                          </span>
                          <span className="font-semibold">{it.claim}</span>
                          {it.notes.length > 0 && (
                            <span className="font-mono text-accent-foreground"> {it.notes.map((n) => `[${n}]`).join('')}</span>
                          )}
                          {it.reason && <span className="text-muted-foreground"> — {it.reason}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p className="text-[13.5px] text-muted-foreground">{t('checkWaiting')}</p>
            )}
          </Step>
        </ol>
      </div>
      <div className="min-w-0 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto">
        <NotesPanel run={run} />
      </div>
    </div>
  );
}
