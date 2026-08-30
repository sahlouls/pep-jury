// Page Enrich : coller/importer 1..20 CVE JSON -> jauge PEP + signaux + JSON enrichi.
import { useState, type ChangeEvent } from 'react';

import type { EnrichedCve } from '../lib/types';

import { PepGauge } from '../components/pep-gauge';
import { SignalChips } from '../components/signal-chips';
import { enrichCves } from '../lib/api';
import { useI18n } from '../lib/i18n';

const MAX_CVES = 20;

function ResultCard({ cve }: { cve: EnrichedCve }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const pep = cve.specific?.pep;
  const json = JSON.stringify(cve, null, 2);
  const id = cve.itemId ?? 'CVE';
  if (!pep) {
    return null;
  }

  function copy() {
    void navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 1500);
    });
  }
  function download() {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${id}.pep.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <article className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[200px_1fr]">
      <div className="flex flex-col items-center">
        <PepGauge value={pep.score} />
        <span className="font-mono text-sm font-semibold text-slate-700">{id}</span>
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        <SignalChips signals={pep.signals} />
        <pre className="max-h-64 w-full overflow-auto rounded-lg bg-slate-900 p-3 text-xs whitespace-pre text-slate-100">
          {json}
        </pre>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={copy}
            className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            {copied ? t('enrich.copied') : t('enrich.copy')}
          </button>
          <button
            type="button"
            onClick={download}
            className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            {t('enrich.download')}
          </button>
        </div>
      </div>
    </article>
  );
}

function ResultsList({ results }: { results: EnrichedCve[] }) {
  const { t } = useI18n();
  if (results.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-slate-800">{t('enrich.results')}</h2>
      {results.map((cve, index) => (
        <ResultCard key={cve.itemId ?? String(index)} cve={cve} />
      ))}
    </div>
  );
}

export function EnrichPage() {
  const { t } = useI18n();
  const [raw, setRaw] = useState('');
  const [results, setResults] = useState<EnrichedCve[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setError(null);
    const trimmed = raw.trim();
    if (!trimmed) {
      setError(t('enrich.empty'));
      return;
    }
    let payload: unknown;
    try {
      payload = JSON.parse(trimmed);
    } catch {
      setError(t('enrich.error_parse'));
      return;
    }
    if (Array.isArray(payload) && payload.length > MAX_CVES) {
      setError(t('enrich.error_max'));
      return;
    }
    setLoading(true);
    try {
      setResults(await enrichCves(payload));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      void file.text().then(setRaw);
    }
  }

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-5 p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('enrich.title')}</h1>
        <p className="mt-1 text-slate-500">{t('enrich.desc')}</p>
      </div>
      <textarea
        value={raw}
        onChange={(event) => {
          setRaw(event.target.value);
        }}
        placeholder={t('enrich.placeholder')}
        className="h-40 w-full rounded-lg border border-slate-300 p-3 font-mono text-sm focus:border-indigo-500 focus:outline-none"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            void run();
          }}
          disabled={loading}
          className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? t('enrich.loading') : t('enrich.button')}
        </button>
        <label className="cursor-pointer text-sm font-medium text-indigo-600 hover:underline">
          {t('enrich.upload')}
          <input type="file" accept=".json,application/json" onChange={onFile} className="hidden" />
        </label>
      </div>
      {error !== null && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}
      <ResultsList results={results} />
    </section>
  );
}
