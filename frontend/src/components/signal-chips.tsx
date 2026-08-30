// Chips des signaux d'explicabilite (mots-cles de vuln, profil RCE...).
import { useI18n } from '../lib/i18n';

export function SignalChips({ signals }: { signals: string[] }) {
  const { t } = useI18n();
  if (signals.length === 0) {
    return <span className="text-sm text-slate-400">{t('enrich.no_signals')}</span>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {signals.map((signal) => (
        <span
          key={signal}
          className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200"
        >
          {signal}
        </span>
      ))}
    </div>
  );
}
