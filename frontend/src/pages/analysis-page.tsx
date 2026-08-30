// Page Analyse : preuve de valeur de notre PEP (independant, complementaire sur la zone aveugle d'EPSS).
// Independance (nuage PEP vs EPSS), angle mort d'EPSS (exploits confirmes a EPSS bas),
// et mouvements du PEP par CVE dans le temps.
import { AdditivityScatter } from '../components/additivity';
import { EpssMissesTable } from '../components/epss-misses-table';
import { TopMovers } from '../components/top-movers';
import { useI18n } from '../lib/i18n';

export function AnalysisPage() {
  const { t } = useI18n();
  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-5 p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('analysis.title')}</h1>
        <p className="mt-1 text-slate-500">{t('analysis.desc')}</p>
      </div>
      <AdditivityScatter />
      <EpssMissesTable />
      <TopMovers />
    </section>
  );
}
