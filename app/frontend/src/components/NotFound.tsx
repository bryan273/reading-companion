import { Link } from 'react-router-dom';
import { SuiteFooter } from './SuiteFooter';
import './suite-topbar.css';

const T = {
  en: { h: 'This page does not exist', p: 'The link may be old or mistyped. Go back to the start, or open another Paperlit app.', home: 'Back to the start', hub: 'All apps' },
  zh: { h: '找不到这个页面', p: '链接可能已过期或输入有误。请回到起点，或打开 Paperlit 的其他应用。', home: '回到起点', hub: '全部应用' },
} as const;

/** Friendly 404 shared by every app of the suite. */
export default function NotFound({ appId }: { appId: string }) {
  const lang = (document.documentElement.lang || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
  const t = T[lang] ?? T.en;
  return (
    <div className="sfn-page">
      <main className="sfn" id="top">
        <p className="sfn-code" aria-hidden>404</p>
        <h1>{t.h}</h1>
        <p>{t.p}</p>
        <div className="sfn-act">
          <Link to="/" className="sfc-btn sfn-primary">{t.home}</Link>
          <a className="sfn-link" href="https://bryan273.github.io/repro-suite/hub/">{t.hub}</a>
        </div>
      </main>
      <SuiteFooter lang={lang} appId={appId} />
    </div>
  );
}
