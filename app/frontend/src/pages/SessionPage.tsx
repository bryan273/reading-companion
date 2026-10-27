import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Copy, Loader2 } from 'lucide-react';
import AppShell from '@/components/AppShell';
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
    <AppShell>
      <Link
        to="/"
        className="inline-flex h-9 items-center gap-1.5 rounded-full px-2 text-[13px] font-semibold text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        {t('backHome')}
      </Link>

      {state === 'loading' && (
        <p className="mt-6 inline-flex items-center gap-2 text-[13.5px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t('loading')}
        </p>
      )}
      {state === 'missing' && <p className="mt-6 text-[13.5px] text-muted-foreground">{t('notFound')}</p>}
      {state === 'error' && <p className="mt-6 text-[13.5px] font-medium text-destructive">{t('errorGeneric', { msg: error })}</p>}

      {state === 'ready' && data && (
        <>
          <div className="card mt-4 flex flex-col gap-4 p-5 sm:p-6">
            <div className="min-w-0">
              <p className="eyebrow text-accent-foreground">{t('sharedSession')}</p>
              <h1 className="mt-2 text-[24px] leading-tight [overflow-wrap:anywhere] sm:text-[30px]">{data.record.goal}</h1>
              <div className="mt-3 flex flex-wrap gap-x-3.5 gap-y-1 font-mono text-[12px] text-muted-foreground">
                {data.record.paper_id && (
                  <a href={arxivUrl(data.record.paper_id)} target="_blank" rel="noreferrer" className="hover:text-primary">
                    arXiv {data.record.paper_id}
                  </a>
                )}
                <span>{data.record.language === 'zh' ? '中文' : 'English'}</span>
                {data.record.created_at && (
                  <span>{new Date(data.record.created_at).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US')}</span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={copy} className="btn btn-ghost">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? t('copied') : t('copyLink')}
              </button>
              <Link to="/" className="btn btn-primary">
                {t('newQuestion')}
              </Link>
            </div>
          </div>
          <div className="card mt-4 p-5 sm:p-6">
            <RunView run={data.run} live={false} />
          </div>
        </>
      )}
    </AppShell>
  );
}
