import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import SuiteTopBar from '@/components/SuiteTopBar';
import { usePrefs } from '@/lib/prefs';

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

export default function AppShell({ children }: { children: ReactNode }) {
  const { t, lang, setLang, theme, toggleTheme } = usePrefs();
  const { pathname, hash } = useLocation();
  useHashScroll();

  const nav = [
    { label: t('navAsk'), to: '/#ask', active: pathname === '/' && hash !== '#recent' },
    { label: t('recent'), to: '/#recent', active: pathname === '/' && hash === '#recent' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SuiteTopBar appId="companion" brand={t('brand')} letter="C" homeTo="/#ask" nav={nav} dark={theme === 'dark'} onToggleDark={toggleTheme} lang={lang} onLang={setLang} />
      <main className="mx-auto w-full max-w-[1160px] px-5 pb-16 pt-8 sm:px-8 sm:pt-10">{children}</main>
    </div>
  );
}
