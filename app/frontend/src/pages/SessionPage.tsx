import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Copy, Loader2 } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import RunView from '@/components/RunView';
import { arxivUrl } from '@/lib/agent';
import { usePrefs } from '@/lib/prefs';
import { getSessionByShareId, type SavedSession } from '@/lib/sessions';

export default function SessionPage() {
  const { shareId = '' } = useParams();
  const { t, lang } = usePrefs();
  const [data, setData] = useState<SavedSession | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    setState('loading');
    getSessionByShareId(shareId)
      .then((s) => {
        if (!alive) return;
        setData(s);
        setState(s ? 'ready' : 'missing');
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e));
        setState('error');
      });
    return () => {
      alive = false;
    };
  }, [shareId]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt(t('copyLink'), window.location.href);
    }
  };

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-[1200px] px-5 py-10 sm:px-8 sm:py-14">
        <Link to="/" className="inline-flex h-10 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t('backHome')}
        </Link>

        {state === 'loading' && (
          <p className="mt-10 inline-flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t('loading')}
          </p>
        )}
        {state === 'missing' && <p className="mt-10 text-muted-foreground">{t('notFound')}</p>}
        {state === 'error' && <p className="mt-10 text-destructive">{t('errorGeneric', { msg: error })}</p>}

        {state === 'ready' && data && (
          <>
            <div className="mt-6 flex flex-col gap-5 border-b border-border pb-8 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <p className="caption text-primary">{t('sharedSession')}</p>
                <h1 className="mt-3 text-[30px] font-medium leading-tight tracking-tight [overflow-wrap:anywhere] sm:text-[40px]">
                  {data.record.goal}
                </h1>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {data.record.paper_id && (
                    <a href={arxivUrl(data.record.paper_id)} target="_blank" rel="noreferrer" className="font-mono hover:text-primary">
                      arXiv {data.record.paper_id}
                    </a>
                  )}
                  <span>{data.record.language === 'zh' ? '中文' : 'English'}</span>
                  {data.record.created_at && (
                    <span>{new Date(data.record.created_at).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US')}</span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={copy}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-secondary"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? t('copied') : t('copyLink')}
                </button>
                <Link
                  to="/"
                  className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  {t('newQuestion')}
                </Link>
              </div>
            </div>
            <div className="mt-8">
              <RunView run={data.run} live={false} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
