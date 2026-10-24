import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Copy, Loader2, Square } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
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
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <section className="grid gap-10 py-10 sm:py-16 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-14">
          <div className="min-w-0">
            <p className="caption text-primary">{t('heroKicker')}</p>
            <h1 className="mt-4 text-[36px] font-medium leading-[1.1] tracking-tight sm:text-[52px] sm:leading-[1.05]">
              {t('heroTitle')}
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-7 text-muted-foreground">{t('heroSub')}</p>

            <div className="mt-10 border-t border-border pt-6">
              <p className="caption text-subtle">{t('examples')}</p>
              <ol className="mt-3">
                {examples.map((ex, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      disabled={running}
                      onClick={() => {
                        setGoal(ex);
                        setPaper('');
                        start(ex, '');
                      }}
                      className="group flex w-full items-start gap-4 border-b border-border py-4 text-left transition-colors hover:bg-secondary/60 disabled:cursor-not-allowed disabled:opacity-60 sm:px-2"
                    >
                      <span className="pt-0.5 font-mono text-sm text-subtle">{String(i + 1).padStart(2, '0')}</span>
                      <span className="min-w-0 flex-1 text-[15px] leading-6">{ex}</span>
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <form
            className="min-w-0 self-start rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(20,32,46,0.05)] sm:p-7 lg:sticky lg:top-[88px]"
            onSubmit={(e) => {
              e.preventDefault();
              start(goal, paper);
            }}
          >
            <label htmlFor="goal" className="block font-serif text-[22px] font-medium">
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
              className="mt-3 w-full resize-y rounded-[10px] border border-input bg-background px-3.5 py-3 text-[16px] leading-6 placeholder:text-subtle focus:border-primary focus:outline-none disabled:opacity-60"
            />
            <label htmlFor="paper" className="mt-5 block text-sm font-medium text-muted-foreground">
              {t('paperLabel')}
            </label>
            <input
              id="paper"
              value={paper}
              onChange={(e) => setPaper(e.target.value)}
              placeholder={t('paperPlaceholder')}
              disabled={running}
              className="mt-2 h-11 w-full rounded-[10px] border border-input bg-background px-3.5 font-mono text-sm placeholder:text-subtle focus:border-primary focus:outline-none disabled:opacity-60"
            />
            {formError && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {formError}
              </p>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              {running ? (
                <button
                  type="button"
                  onClick={() => abortRef.current?.abort()}
                  className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-card px-5 text-[15px] font-medium text-foreground hover:bg-secondary"
                >
                  <Square className="h-3.5 w-3.5" aria-hidden />
                  {t('stop')}
                </button>
              ) : (
                <button
                  type="submit"
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-[15px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  {t('start')}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
              )}
              {running && (
                <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  {t('running')}
                </span>
              )}
            </div>
          </form>
        </section>

        {run && (
          <section ref={workspaceRef} aria-live="polite" className="scroll-mt-20 border-t border-border py-10 sm:py-14">
            <p className="caption text-subtle">{t('goal')}</p>
            <h2 className="mt-2 text-[26px] font-medium leading-tight [overflow-wrap:anywhere]">{runGoal}</h2>

            {banner && (
              <div
                role="status"
                className={cn(
                  'mt-5 rounded-xl border px-4 py-3 text-[15px]',
                  banner.tone === 'error' && 'border-destructive/30 bg-destructive/10 text-destructive',
                  banner.tone === 'warning' && 'border-warning/30 bg-warning-soft text-warning',
                  banner.tone === 'info' && 'border-border bg-secondary text-muted-foreground'
                )}
              >
                {banner.text}
              </div>
            )}

            {saveState !== 'idle' && saveState !== 'error' && (
              <div className="mt-5 flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center">
                <span className="inline-flex items-center gap-2 text-[15px]">
                  {saveState === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-success" />}
                  {saveState === 'saving' ? t('saving') : t('saved')}
                </span>
                {shareUrl && (
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:justify-end">
                    <Link to={`/s/${shareId}`} className="min-w-0 truncate font-mono text-sm text-primary hover:underline">
                      {shareUrl}
                    </Link>
                    <button
                      type="button"
                      onClick={copy}
                      className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-secondary"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copied ? t('copied') : t('copyLink')}
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="mt-8">
              <RunView run={run} live={running} />
            </div>
          </section>
        )}

        <section className="border-t border-border py-10 sm:py-16">
          <h2 className="text-[26px] font-medium">{t('recent')}</h2>
          <p className="mt-2 max-w-2xl text-[15px] text-muted-foreground">{t('recentSub')}</p>
          {recent === null ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-32 animate-pulse rounded-xl border border-border bg-card" />
              ))}
            </div>
          ) : recentError ? (
            <p className="mt-6 text-sm text-destructive">{t('recentError')}</p>
          ) : recent.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">{t('recentEmpty')}</p>
          ) : (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recent.map((r) => (
                <li key={r.id}>
                  <Link
                    to={`/s/${r.share_id}`}
                    className="flex h-full flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50"
                  >
                    <p className="line-clamp-3 font-serif text-[17px] font-medium leading-6 [overflow-wrap:anywhere]">{r.goal}</p>
                    <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-4 text-xs text-muted-foreground">
                      {r.paper_id && <span className="font-mono">arXiv {r.paper_id}</span>}
                      <span>{r.language === 'zh' ? '中文' : 'EN'}</span>
                      <span>
                        {noteCount(r)} {lang === 'zh' ? '条笔记' : 'notes'}
                      </span>
                      <span>{t('tokens', { n: (r.total_tokens ?? 0).toLocaleString() })}</span>
                      {r.created_at && <span>{new Date(r.created_at).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US')}</span>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <footer className="border-t border-border">
        <p className="mx-auto max-w-[1200px] px-5 py-8 text-sm text-subtle sm:px-8">{t('footer')}</p>
      </footer>
    </div>
  );
}
