import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { usePrefs, type Lang } from '@/lib/prefs';
import { cn } from '@/lib/utils';

const APP_LINKS: { href: string; key: 'navAsk' | 'stagePlan' | 'stageTools' | 'stageNotes' | 'stageAnswer' | 'stageSelfcheck' | 'recent' }[] = [
  { href: '/#ask', key: 'navAsk' },
  { href: '/#stage-plan', key: 'stagePlan' },
  { href: '/#stage-tools', key: 'stageTools' },
  { href: '/#stage-notes', key: 'stageNotes' },
  { href: '/#stage-answer', key: 'stageAnswer' },
  { href: '/#stage-selfcheck', key: 'stageSelfcheck' },
  { href: '/#recent', key: 'recent' },
];

const SUITE_LINKS = [
  { href: 'https://paperexplainer-aiid.pub.atoms.world', key: 'navPaperExplainer' },
  { href: 'https://paperrepro-aiid.atoms.world/repro/index.html', key: 'navReproAgent' },
  { href: 'https://paperrepro-aiid.atoms.world/repro/bench.html', key: 'navBenchmark' },
  { href: 'https://reprosuite-aiid.atoms.world', key: 'navAllApps' },
] as const;

const LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'EN' },
  { id: 'zh', label: '中文' },
];

function useHashScroll() {
  const location = useLocation();
  const [pending, setPending] = useState<string | null>(location.hash);
  useEffect(() => {
    setPending(location.hash);
  }, [location]);
  useEffect(() => {
    if (!pending) return;
    const id = pending.replace('#', '');
    const timer = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [pending]);
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const { t, lang, setLang, theme, toggleTheme } = usePrefs();
  const { pathname, hash } = useLocation();
  const navigate = useNavigate();

  const isActive = (href: string) => {
    const [path, target] = href.split('#');
    const targetHash = target ? `#${target}` : '';
    if (!targetHash) return pathname === path;
    return pathname === path && hash === targetHash;
  };

  return (
    <div className="flex h-full flex-col">
      <button
        type="button"
        onClick={() => {
          navigate('/');
          window.scrollTo({ top: 0, behavior: 'smooth' });
          onNavigate?.();
        }}
        className="flex w-full items-center gap-2.5 px-4 py-5 text-left"
      >
        <span
          aria-hidden
          className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-[#101014] text-[15px] font-extrabold text-white ring-1 ring-white/10"
        >
          C
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-bold leading-tight">{t('brand')}</span>
          <span className="mt-0.5 block truncate text-[11.5px] font-normal text-subtle">{t('partOfSuite')}</span>
        </span>
      </button>

      <nav aria-label={t('brand')} className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <p className="nav-heading pt-1">{t('brand')}</p>
        <ul className="space-y-0.5">
          {APP_LINKS.map((item) => (
            <li key={item.href}>
              <Link
                to={item.href}
                data-active={isActive(item.href)}
                aria-current={isActive(item.href) ? 'page' : undefined}
                onClick={onNavigate}
                className="nav-item"
              >
                {t(item.key)}
              </Link>
            </li>
          ))}
        </ul>

        <p className="nav-heading">{t('navSuite')}</p>
        <ul className="space-y-0.5">
          {SUITE_LINKS.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                target="_blank"
                rel="noreferrer"
                onClick={onNavigate}
                className="nav-item justify-between text-muted-foreground hover:text-foreground"
              >
                <span className="truncate">{t(item.key)}</span>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-70" aria-label={t('openNewTab')} />
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-auto border-t border-border p-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? t('toLight') : t('toDark')}
            title={theme === 'dark' ? t('toLight') : t('toDark')}
            className="btn btn-ghost h-9 w-10 shrink-0 px-0 text-[15px]"
          >
            <span aria-hidden>{theme === 'dark' ? '☀' : '☾'}</span>
          </button>
          <div
            role="group"
            aria-label={t('langLabel')}
            className="flex flex-1 rounded-full border border-border bg-card p-0.5"
          >
            {LANGS.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setLang(l.id)}
                aria-pressed={lang === l.id}
                className={cn(
                  'h-8 flex-1 rounded-full px-2 text-[12.5px] font-semibold transition-colors',
                  lang === l.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const { t } = usePrefs();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useHashScroll();

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="min-h-screen bg-background">
      <aside
        aria-label={t('brand')}
        className="fixed inset-y-0 left-0 z-40 hidden w-[248px] border-r border-border bg-card nav:block"
      >
        <SidebarBody />
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur nav:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('menu')}
          aria-expanded={open}
          className="btn btn-ghost h-9 w-9 shrink-0 px-0"
        >
          <Menu className="h-4 w-4" aria-hidden />
        </button>
        <span className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className="grid h-6 w-6 shrink-0 place-items-center rounded-[7px] bg-[#101014] text-[12px] font-extrabold text-white ring-1 ring-white/10"
          >
            C
          </span>
          <span className="truncate text-[13.5px] font-bold">{t('brand')}</span>
        </span>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 nav:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 flex w-[268px] max-w-[86vw] flex-col border-r border-border bg-card shadow-[0_8px_24px_rgba(16,24,40,0.18)]">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('closeMenu')}
              className="btn btn-ghost absolute right-2 top-4 h-9 w-9 px-0"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
            <SidebarBody onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="nav:pl-[248px]">
        <main className="mx-auto w-full max-w-[1080px] px-5 pb-16 pt-8 sm:px-8 sm:pt-10">{children}</main>
      </div>
    </div>
  );
}
