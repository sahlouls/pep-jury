// Types partages avec l'API (src/cve_exploit/api.py).

// Objet PEP injecte dans specific.pep par POST /enrich.
export type PepObject = {
  score: number;
  modelVersion: string;
  computedAt: string;
  signals: string[];
};

// CVE enrichie : JSON quelconque + le champ specific.pep. On ne type que ce qu'on lit.
export type EnrichedCve = Record<string, unknown> & {
  itemId?: string;
  specific?: { pep?: PepObject };
};

// GET /drift
export type DriftDaily = {
  day: string;
  psi: number | null;
  brier_rolling: number | null;
  n_scored: number;
  n_new: number;
  n_flipped: number;
  n_matured: number;
  n_pep_up: number;
  n_pep_down: number;
  pep_delta_avg: number | null;
  retrain_flag: boolean;
};

export type DriftAlert = {
  day: string;
  metric: string;
  value: number;
  threshold: number;
};

export type DriftResponse = {
  daily: DriftDaily[];
  open_alerts: DriftAlert[];
};

// GET /movers : top mouvements du PEP (notre mesure)
export type Mover = {
  cve: string;
  day: string;
  pep: number;
  pep_delta: number;
  epss: number | null;
  label: number | null;
};

// GET /leadtime : anticipation de notre PEP vs le jour "exploit connu"
export type LeadTime = {
  threshold: number;
  n_flipped_cves: number;
  n_scored: number;
  n_anticipated: number;
  pct_anticipated: number;
  mean_lead_days: number | null;
  median_lead_days: number | null;
};

// GET /scatter : nuage PEP vs EPSS (independance)
export type ScatterPoint = { cve: string; pep: number; epss: number };

// GET /epss-misses : exploits confirmes (label=1) avec EPSS bas (angle mort d'EPSS)
export type MissRow = {
  cve: string;
  pep: number;
  epss: number;
  exploit_date: string | null;
  cvss: number | null;
};

export type MissSort = 'cve' | 'pep' | 'epss' | 'cvss' | 'exploit_date';

export type EpssMisses = {
  epss_max: number;
  pep_min: number;
  n_confirmed_low_epss: number; // stat globale (independante de la recherche)
  n_we_caught: number;
  total: number; // nb de lignes du jeu filtre (pour la pagination)
  page: number;
  page_size: number;
  rows: MissRow[];
};

// GET /history/{cve}
export type HistoryPoint = { day: string; pep: number; epss: number | null; label: number | null };

export type HistoryResponse = {
  cve: string;
  current: { pep: number; label: number | null; model_version: string; updated_at: string } | null;
  history: HistoryPoint[];
};
