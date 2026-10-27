import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Copy, Loader2, Square } from 'lucide-react';
import AppShell from '@/components/AppShell';
import RunView from '@/components/RunView';
import { AgentError, emptyRun, parseArxivId, runAgent, type AgentRun } from '@/lib/agent';
import { usePrefs } from '@/lib/prefs';
import { listRecentSessions, noteCount, saveSession, type SessionRecord } from '@/lib/sessions';
import { cn } from '@/lib/utils';

type Banner = { tone: 'error' | 'warning' | 'info'; text: string } | null;

export default function Index() {
  const { t, lang } = usePrefs();
  const [goal, setGoal] = useState('');
  const [paper, setPaper] = useState('');
  const [formError, setFormError] = useState('');
  const [run, setRun] = useState<AgentRun | null>(null);
  const [runGoal, setRunGoal] = useState('');
  const [running, setRunning] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [shareId, setShareId] = useState('');
  const [copied, setCopied] = useState(false);
  const [recent, setRecent] = useState<SessionRecord[] | null>(null);
  const [recentError, setRecentError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const workspaceRef = useRef<HTMLElement | null>(null);

  const loadRecent = useCallback(async () => {
    try {
      setRecent(await listRecentSessions(12));
      setRecentError(false);
    } catch {
      setRecentError(true);
      setRecent([]);
    }
  }, []);

  useEffect(() => {
    loadRecent();
    return () => abortRef.current?.abort();
  }, [loadRecent]);

  const start = async (goalText: string, paperText: string) => {
    const g = goalText.trim();
    if (!g) {
      setFormError(t('goalRequired'));
      return;
    }
    let paperId: string | null = null;
    if (paperText.trim()) {
      paperId = parseArxivId(paperText);
      if (!paperId) {
        setFormError(t('paperInvalid'));
        return;
      }
    }
    setFormError('');
    setBanner(null);
    setSaveState('idle');
    setShareId('');
    setRunGoal(g);
    setRunning(true);
    const controller = new AbortController();
    abortRef.current = controller;
    setRun(emptyRun());
    requestAnimationFrame(() => workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));

    let finished: AgentRun | null = null;
    try {
      finished = await runAgent({ goal: g, paperId, lang, signal: controller.signal, onUpdate: setRun });
    } catch (e) {
      if (e instanceof AgentError && e.kind === 'rate') setBanner({ tone: 'warning', text: t('rateLimit') });
      else if (e instanceof AgentError && e.kind === 'aborted') setBanner({ tone: 'info', text: t('aborted') });
      else setBanner({ tone: 'error', text: t('errorGeneric', { msg: e instanceof Error ? e.message : String(e) }) });
      setRun((r) => (r ? { ...r, stage: r.stage === 'done' ? 'done' : r.stage } : r));
    } finally {
      setRunning(false);
      abortRef.current = null;
    }

    if (finished) {
      setSaveState('saving');
      try {
        const id = await saveSession(finished, g, paperId, lang);
        setShareId(id);
        setSaveState('saved');
        loadRecent();
      } catch (e) {
        setSaveState('error');
        setBanner({ tone: 'error', text: t('saveFailed', { msg: e instanceof Error ? e.message : String(e) }) });
      }
    }
  };

  const shareUrl = shareId ? `${window.location.origin}/s/${shareId}` : '';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt(t('copyLink'), shareUrl);
    }
  };

  const examples = [t('ex1'), t('ex2'), t('ex3')];

  return (
    <AppShell>
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)] xl:gap-10">
        <div className="min-w-0">
          <p className="eyebrow text-accent-foreground">{t('heroKicker')}</p>
          <h1 className="mt-2.5 text-[30px] leading-[1.08] sm:text-[40px]">{t('heroTitle')}</h1>
          <p className="mt-4 max-w-[54ch] text-[15px] leading-7 text-muted-foreground sm:text-[16px]">{t('heroSub')}</p>

          <div id="examples" className="mt-8 scroll-mt-20">
            <p className="eyebrow">{t('examples')}</p>
            <ol className="mt-3 overflow-hidden rounded-[16px] border border-border bg-card">
              {examples.map((ex, i) => (
                <li key={i} className="border-b border-border last:border-b-0">
                  <button
                    type="button"
                    disabled={running}
                    onClick={() => {
                      setGoal(ex);
                      setPaper('');
                      start(ex, '');
                    }}
                    className="group flex w-full items-start gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="mt-0.5 font-mono text-[12px] text-subtle">{String(i + 1).padStart(2, '0')}</span>
                    <span className="min-w-0 flex-1 text-[13.5px] leading-6">{ex}</span>
                    <ArrowRight
                      className="mt-1 h-4 w-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                      aria-hidden
                    />
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <form
          id="ask"
          className="card h-fit scroll-mt-20 p-5 sm:p-6 xl:sticky xl:top-6"
          onSubmit={(e) => {
            e.preventDefault();
            start(goal, paper);
          }}
        >
          <label htmlFor="goal" className="block text-[16px] font-bold tracking-[-0.02em]">
            {t('goalLabel')}
          </label>
          <textarea
            id="goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder={t('goalPlaceholder')}
            rows={4}
            maxLength={1000}
            disabled={running}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                start(goal, paper);
              }
            }}
            className="field mt-2.5 resize-y"
          />
          <label htmlFor="paper" className="mt-4 block text-[12.5px] font-semibold text-muted-foreground">
            {t('paperLabel')}
          </label>
          <input
            id="paper"
            value={paper}
            onChange={(e) => setPaper(e.target.value)}
            placeholder={t('paperPlaceholder')}
            disabled={running}
            className="field mt-1.5 font-mono text-[13px]"
          />
          {formError && (
            <p role="alert" className="mt-2.5 text-[13px] font-medium text-destructive">
              {formError}
            </p>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            {running ? (
              <button type="button" onClick={() => abortRef.current?.abort()} className="btn btn-ghost btn-lg">
                <Square className="h-3.5 w-3.5" aria-hidden />
                {t('stop')}
              </button>
            ) : (
              <button type="submit" className="btn btn-primary btn-lg">
                {t('start')}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            )}
            {running && (
              <span className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {t('running')}
              </span>
            )}
          </div>
        </form>
      </div>

      {run && (
        <section ref={workspaceRef} aria-live="polite" className="mt-10 scroll-mt-20">
          <div className="card p-5 sm:p-6">
            <p className="eyebrow">{t('goal')}</p>
            <h2 className="mt-1.5 text-[19px] leading-snug [overflow-wrap:anywhere]">{runGoal}</h2>

            {banner && (
              <div
                role="status"
                className={cn(
                  'mt-4 rounded-[12px] border px-3.5 py-2.5 text-[13.5px]',
                  banner.tone === 'error' && 'border-destructive/30 bg-destructive-soft text-destructive',
                  banner.tone === 'warning' && 'border-warning/30 bg-warning-soft text-warning',
                  banner.tone === 'info' && 'border-border bg-secondary text-muted-foreground'
                )}
              >
                {banner.text}
              </div>
            )}

            {saveState !== 'idle' && saveState !== 'error' && (
              <div className="mt-3.5 flex flex-col gap-2.5 rounded-[12px] border border-border bg-secondary px-3.5 py-2.5 sm:flex-row sm:items-center">
                <span className="inline-flex items-center gap-2 text-[13.5px]">
                  {saveState === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-success" />}
                  {saveState === 'saving' ? t('saving') : t('saved')}
                </span>
                {shareUrl && (
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:justify-end">
                    <Link to={`/s/${shareId}`} className="min-w-0 truncate font-mono text-[12.5px] text-primary hover:underline">
                      {shareUrl}
                    </Link>
                    <button type="button" onClick={copy} className="btn btn-ghost h-9 px-3 text-[12.5px]">
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? t('copied') : t('copyLink')}
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6">
              <RunView run={run} live={running} />
            </div>
          </div>
        </section>
      )}

      <section id="recent" className="mt-12 scroll-mt-20">
        <h2 className="text-[19px]">{t('recent')}</h2>
        <p className="mt-1.5 max-w-[62ch] text-[13.5px] text-muted-foreground">{t('recentSub')}</p>
        {recent === null ? (
          <div className="mt-4 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[132px] animate-pulse rounded-[16px] border border-border bg-card" />
            ))}
          </div>
        ) : recentError ? (
          <p className="mt-4 text-[13.5px] font-medium text-destructive">{t('recentError')}</p>
        ) : recent.length === 0 ? (
          <p className="mt-4 text-[13.5px] text-muted-foreground">{t('recentEmpty')}</p>
        ) : (
          <ul className="mt-4 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/s/${r.share_id}`}
                  className="card flex h-full flex-col p-4 transition-colors hover:border-primary"
                >
                  <p className="line-clamp-3 text-[14px] font-semibold leading-6 [overflow-wrap:anywhere]">{r.goal}</p>
                  <div className="mt-auto flex flex-wrap gap-x-2.5 gap-y-1 pt-3 font-mono text-[11px] text-muted-foreground">
                    {r.paper_id && <span>arXiv {r.paper_id}</span>}
                    <span>{r.language === 'zh' ? '中文' : 'EN'}</span>
                    <span>
                      {noteCount(r)} {lang === 'zh' ? '条笔记' : 'notes'}
                    </span>
                    <span>{t('tokens', { n: (r.total_tokens ?? 0).toLocaleString() })}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="mt-12 border-t border-border pt-6">
        <p className="text-[12.5px] text-subtle">{t('footer')}</p>
      </footer>
    </AppShell>
  );
}
