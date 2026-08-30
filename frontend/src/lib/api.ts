// Client API du service PEP. Base configurable via VITE_API_URL (defaut : back local).
import type {
  DriftResponse,
  EnrichedCve,
  EpssMisses,
  HistoryResponse,
  LeadTime,
  MissSort,
  Mover,
  ScatterPoint,
} from './types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

// Extrait le message d'erreur { detail } renvoye par FastAPI, sinon un texte generique.
async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: string };
    return body.detail ?? `Erreur ${String(res.status)}`;
  } catch {
    return `Erreur ${String(res.status)}`;
  }
}

// POST /enrich : 1..20 CVE (objet ou liste) -> memes JSON enrichis de specific.pep.
export async function enrichCves(payload: unknown): Promise<EnrichedCve[]> {
  const res = await fetch(`${API_URL}/enrich`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  const data = (await res.json()) as EnrichedCve | EnrichedCve[];
  return Array.isArray(data) ? data : [data];
}

// GET /drift?days=N
export async function fetchDrift(days = 30): Promise<DriftResponse> {
  const res = await fetch(`${API_URL}/drift?days=${String(days)}`);
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  return (await res.json()) as DriftResponse;
}

// GET /movers : top hausses/baisses du PEP
export async function fetchMovers(
  direction: 'up' | 'down',
  days = 60,
  limit = 8,
): Promise<Mover[]> {
  const res = await fetch(
    `${API_URL}/movers?direction=${direction}&days=${String(days)}&limit=${String(limit)}`,
  );
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  return (await res.json()) as Mover[];
}

// GET /leadtime
export async function fetchLeadTime(threshold = 0.5, days = 120): Promise<LeadTime> {
  const res = await fetch(
    `${API_URL}/leadtime?threshold=${String(threshold)}&days=${String(days)}`,
  );
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  return (await res.json()) as LeadTime;
}

// GET /scatter
export async function fetchScatter(limit = 800): Promise<ScatterPoint[]> {
  const res = await fetch(`${API_URL}/scatter?limit=${String(limit)}`);
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  return (await res.json()) as ScatterPoint[];
}

// GET /epss-misses : tri / recherche par CVE / pagination cote serveur
export async function fetchEpssMisses(opts: {
  q?: string;
  sort?: MissSort;
  order?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
  epssMax?: number;
  pepMin?: number;
}): Promise<EpssMisses> {
  const p = new URLSearchParams({
    epss_max: String(opts.epssMax ?? 0.1),
    pep_min: String(opts.pepMin ?? 0.5),
    q: opts.q ?? '',
    sort: opts.sort ?? 'cvss',
    order: opts.order ?? 'desc',
    page: String(opts.page ?? 1),
    page_size: String(opts.pageSize ?? 15),
  });
  const res = await fetch(`${API_URL}/epss-misses?${p.toString()}`);
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  return (await res.json()) as EpssMisses;
}

// GET /history/{cve}
export async function fetchHistory(cveId: string): Promise<HistoryResponse> {
  const res = await fetch(`${API_URL}/history/${encodeURIComponent(cveId)}`);
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  return (await res.json()) as HistoryResponse;
}
