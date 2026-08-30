// i18n leger FR/EN : dictionnaire + contexte + hook useI18n. Pas de dependance externe.
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

const dict = {
  fr: {
    'app.fullname': 'Predicted Exploit Probability',
    'app.subtitle': "Probabilite predite qu'un exploit public existe",
    'nav.enrich': 'Enrichir',
    'nav.analysis': 'Analyse',
    'nav.drift': 'Monitoring',
    'lang.toggle': 'Changer de langue',

    'analysis.title': 'Analyse de la valeur',
    'analysis.desc':
      "Notre PEP = signal descriptif, calibre et explicable, INDEPENDANT d'EPSS. Il trie les CVE porteuses d'exploit dans la masse qu'EPSS ne distingue pas. Complement d'EPSS, pas un predicteur de weaponisation.",

    'enrich.title': 'Enrichir des CVE',
    'enrich.desc': 'Collez ou importez 1 a 20 CVE au format JSON pour obtenir leur score PEP.',
    'enrich.placeholder': 'Collez ici un objet CVE JSON, ou une liste de CVE...',
    'enrich.upload': 'Importer un fichier .json',
    'enrich.button': 'Enrichir',
    'enrich.loading': 'Calcul en cours...',
    'enrich.empty': 'Fournissez au moins une CVE (JSON).',
    'enrich.error_parse': 'JSON invalide. Verifiez le format.',
    'enrich.error_max': 'Maximum 20 CVE par appel (utilisez la CLI au-dela).',
    'enrich.results': 'Resultats',
    'enrich.signals': 'Signaux',
    'enrich.no_signals': 'Aucun signal notable',
    'enrich.copy': 'Copier le JSON',
    'enrich.copied': 'Copie !',
    'enrich.download': 'Telecharger',
    'enrich.model': 'Modele',
    'enrich.level_low': 'Faible',
    'enrich.level_mid': 'Modere',
    'enrich.level_high': 'Eleve',

    'drift.title': 'Monitoring de drift',
    'drift.desc': 'Evolution du modele dans le temps : PSI (distribution) et Brier (performance).',
    'drift.refresh': 'Rafraichir',
    'drift.range': 'Periode',
    'drift.loading': 'Chargement...',
    'drift.empty': "Aucune donnee. Lancez d'abord le monitoring (monitor.py).",
    'drift.psi': 'PSI (drift de distribution)',
    'drift.brier': 'Brier glissant (drift de performance)',
    'drift.alerts': 'Alertes ouvertes',
    'drift.no_alerts': 'Aucune alerte ouverte.',
    'drift.threshold': 'seuil',
    'drift.retrain': 'Re-entrainement conseille',
    'drift.retrain_critical': 'Drift de distribution detecte (PSI) -- re-entrainement requis',
    'drift.dismiss': 'Masquer',
    'drift.group_truth': 'Verite terrain (donnees reelles du bundle)',
    'drift.group_model': 'Notre mesure (derivee du PEP -- notre modele)',
    'drift.n_scored': 'CVE scorees',
    'drift.n_new': 'Nouvelles CVE (periode)',
    'drift.n_flipped': 'Nouveaux exploits connus (periode)',
    'drift.n_matured': 'CVE murees (>=90j)',
    'drift.pep_up': 'PEP en hausse (periode)',
    'drift.pep_down': 'PEP en baisse (periode)',
    'drift.pep_delta_avg': 'Mouvement moyen |dPEP|',
    'drift.movers': 'Top mouvements du PEP (par CVE)',
    'drift.movers_up': 'Hausses',
    'drift.movers_down': 'Baisses',
    'drift.movers_empty': 'Aucun mouvement sur la periode.',
    'drift.movers_hint':
      'PEP eleve + EPSS bas = signal independant (complementaire a EPSS). Clic sur une CVE -> son evolution.',
    'drift.exploit_known': 'exploit connu',
    'drift.history_hint':
      "Ligne rouge = jour ou l exploit devient connu. Le PEP evolue quand la threat intel s'enrichit.",
    'lead.title': "de nos alertes precedaient l'exploit connu",
    'lead.detail': 'CVE anticipees',
    'lead.mean': 'avance moyenne',
    'lead.days': 'jours',
    'scatter.title': 'Independance : notre PEP vs EPSS',
    'scatter.hint':
      "Chaque point = une CVE. Haut-gauche (PEP eleve, EPSS bas) = signal independant, la ou EPSS n'informe pas.",
    'scatter.value': 'Signal independant (PEP haut, EPSS bas)',
    'scatter.other': 'Autres CVE',
    'scatter.empty': 'Pas encore de donnees.',
    'misses.title': "Angle mort d'EPSS : exploits CONFIRMES a EPSS bas",
    'misses.hint':
      "EPSS predit l'exploitation en conditions reelles (30j), pas l'existence d'un exploit. Ces CVE ont un exploit CONFIRME mais un EPSS bas -> notre PEP capte ce signal complementaire.",
    'misses.confirmed': 'exploits confirmes a EPSS <= 0.1',
    'misses.caught': 'flagues par notre PEP (>= 0.5)',
    'misses.exploit_date': 'Date exploit',
    'misses.search': 'Rechercher une CVE...',
    'misses.empty': 'Aucune CVE ne correspond a la recherche.',
    'misses.showing': 'Affichage de',
    'misses.of': 'sur',
    'misses.prev': 'Precedent',
    'misses.next': 'Suivant',
    'misses.page': 'Page',
  },
  en: {
    'app.fullname': 'Predicted Exploit Probability',
    'app.subtitle': 'Predicted probability that a public exploit exists',
    'nav.enrich': 'Enrich',
    'nav.analysis': 'Analysis',
    'nav.drift': 'Monitoring',
    'lang.toggle': 'Switch language',

    'analysis.title': 'Value analysis',
    'analysis.desc':
      "Our PEP = a descriptive, calibrated, explainable signal, INDEPENDENT of EPSS. It ranks exploit-bearing CVEs within the mass EPSS doesn't distinguish. Complementary to EPSS, not a weaponization predictor.",

    'enrich.title': 'Enrich CVEs',
    'enrich.desc': 'Paste or upload 1 to 20 CVEs as JSON to get their PEP score.',
    'enrich.placeholder': 'Paste a CVE JSON object here, or a list of CVEs...',
    'enrich.upload': 'Upload a .json file',
    'enrich.button': 'Enrich',
    'enrich.loading': 'Scoring...',
    'enrich.empty': 'Provide at least one CVE (JSON).',
    'enrich.error_parse': 'Invalid JSON. Check the format.',
    'enrich.error_max': 'Maximum 20 CVEs per call (use the CLI beyond that).',
    'enrich.results': 'Results',
    'enrich.signals': 'Signals',
    'enrich.no_signals': 'No notable signal',
    'enrich.copy': 'Copy JSON',
    'enrich.copied': 'Copied!',
    'enrich.download': 'Download',
    'enrich.model': 'Model',
    'enrich.level_low': 'Low',
    'enrich.level_mid': 'Medium',
    'enrich.level_high': 'High',

    'drift.title': 'Drift monitoring',
    'drift.desc': 'Model evolution over time: PSI (distribution) and Brier (performance).',
    'drift.refresh': 'Refresh',
    'drift.range': 'Period',
    'drift.loading': 'Loading...',
    'drift.empty': 'No data yet. Run the monitoring first (monitor.py).',
    'drift.psi': 'PSI (distribution drift)',
    'drift.brier': 'Rolling Brier (performance drift)',
    'drift.alerts': 'Open alerts',
    'drift.no_alerts': 'No open alert.',
    'drift.threshold': 'threshold',
    'drift.retrain': 'Retraining advised',
    'drift.retrain_critical': 'Distribution drift detected (PSI) -- retraining required',
    'drift.dismiss': 'Dismiss',
    'drift.group_truth': 'Ground truth (real bundle data)',
    'drift.group_model': 'Our measure (PEP-derived -- our model)',
    'drift.n_scored': 'CVEs scored',
    'drift.n_new': 'New CVEs (period)',
    'drift.n_flipped': 'Newly known exploits (period)',
    'drift.n_matured': 'Matured CVEs (>=90d)',
    'drift.pep_up': 'PEP up (period)',
    'drift.pep_down': 'PEP down (period)',
    'drift.pep_delta_avg': 'Avg move |dPEP|',
    'drift.movers': 'Top PEP movers (by CVE)',
    'drift.movers_up': 'Rises',
    'drift.movers_down': 'Drops',
    'drift.movers_empty': 'No movement in the period.',
    'drift.movers_hint':
      'High PEP + low EPSS = independent signal (complementary to EPSS). Click a CVE -> its trend.',
    'drift.exploit_known': 'exploit known',
    'drift.history_hint':
      'Red line = day the exploit became known. PEP evolves as threat intel enriches.',
    'lead.title': 'of our alerts preceded the known exploit',
    'lead.detail': 'CVEs anticipated',
    'lead.mean': 'avg lead',
    'lead.days': 'days',
    'scatter.title': 'Independence: our PEP vs EPSS',
    'scatter.hint':
      'Each dot = a CVE. Top-left (high PEP, low EPSS) = independent signal where EPSS is uninformative.',
    'scatter.value': 'Independent signal (high PEP, low EPSS)',
    'scatter.other': 'Other CVEs',
    'scatter.empty': 'No data yet.',
    'misses.title': 'EPSS blind spot: CONFIRMED exploits with low EPSS',
    'misses.hint':
      'EPSS predicts in-the-wild exploitation (30d), not exploit existence. These CVEs have a CONFIRMED exploit but low EPSS -> our PEP captures this complementary signal.',
    'misses.confirmed': 'confirmed exploits with EPSS <= 0.1',
    'misses.caught': 'flagged by our PEP (>= 0.5)',
    'misses.exploit_date': 'Exploit date',
    'misses.search': 'Search a CVE...',
    'misses.empty': 'No CVE matches the search.',
    'misses.showing': 'Showing',
    'misses.of': 'of',
    'misses.prev': 'Previous',
    'misses.next': 'Next',
    'misses.page': 'Page',
  },
} as const;

type Lang = keyof typeof dict;
type Key = keyof (typeof dict)['fr'];

type I18nValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: Key) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('fr');
  const value = useMemo<I18nValue>(() => ({ lang, setLang, t: (key) => dict[lang][key] }), [lang]);
  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n doit etre utilise dans un I18nProvider');
  }
  return ctx;
}
