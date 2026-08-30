// Bascule FR/EN.
import { useI18n } from '../lib/i18n';

export function LangToggle() {
  const { lang, setLang, t } = useI18n();
  return (
    <button
      type="button"
      onClick={() => {
        setLang(lang === 'fr' ? 'en' : 'fr');
      }}
      aria-label={t('lang.toggle')}
      className="rounded-md border border-slate-300 px-2.5 py-1 text-sm font-medium text-slate-600 hover:bg-slate-100"
    >
      {lang === 'fr' ? 'EN' : 'FR'}
    </button>
  );
}
