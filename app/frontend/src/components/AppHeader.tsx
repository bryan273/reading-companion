import { Link } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { usePrefs, type Lang } from '@/lib/prefs';
import { cn } from '@/lib/utils';

const LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'EN' },
  { id: 'zh', label: '中文' },
];

export default function AppHeader() {
  const { lang, setLang, theme, toggleTheme, t } = usePrefs();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-3 px-5 sm:px-8">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary font-serif text-lg font-semibold text-primary-foreground"
          >
            R
          </span>
          <span className="truncate font-serif text-lg font-medium tracking-tight">{t('brand')}</span>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <div role="group" aria-label={t('langLabel')} className="flex rounded-full border border-border bg-card p-0.5">
            {LANGS.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setLang(l.id)}
                aria-pressed={lang === l.id}
                className={cn(
                  'h-9 min-w-[44px] rounded-full px-3 text-sm font-medium transition-colors',
                  lang === l.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {l.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={t('toggleTheme')}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
