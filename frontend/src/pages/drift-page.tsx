// Page Monitoring de drift : courbes PSI + Brier glissant (ECharts) + alertes + compteurs.
import type { EChartsOption } from 'echarts';

import ReactEChartsCore from 'echarts-for-react/esm/core';
import { useCallback, useEffect, useState } from 'react';

import type { DriftAlert, DriftDaily, DriftResponse } from '../lib/types';

import { fetchDrift } from '../lib/api';
import { echarts } from '../lib/echarts';
import { formatFr } from '../lib/format';
import { useI18n } from '../lib/i18n';

const DRIFT_DAYS = 90; // fenetre d'historique demandee a l'API (assez large pour tous les bundles)

function DriftLineChart({
  label,
  days,
  values,
  color,
  threshold,
  thresholdLabel,
}: {
  label: string;
  days: string[];
  values: (number | null)[];
  color: string;
  threshold?: number;
  thresholdLabel?: string;
}) {
  const option: EChartsOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 44, right: 18, top: 16, bottom: 28 },
    xAxis: { type: 'category', data: days, boundaryGap: false },
    yAxis: { type: 'value' },
    series: [
      {
        type: 'line',
        data: values,
        smooth: true,
        connectNulls: true,
        lineStyle: { color, width: 2 },
        itemStyle: { color },
        areaStyle: { color, opacity: 0.08 },
        markLine:
          threshold === undefined
            ? undefined
            : {
                silent: true,
                symbol: 'none',
                data: [{ yAxis: threshold }],
                lineStyle: { color: '#ef4444', type: 'dashed' },
                label: { formatter: thresholdLabel ?? '', position: 'insideEndTop' },
              },
      },
    ],
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold text-slate-700">{label}</h3>
      <ReactEChartsCore echarts={echarts} option={option} style={{ height: 240 }} />
    </div>
  );
}

function CountersRow({ daily }: { daily: DriftDaily[] }) {
  const { t } = useI18n();
  const latest = daily.at(-1);
  if (latest === undefined) {
    return null;
  }

  // scored/matured = etat du dernier jour ; new/flipped = cumul sur toute la periode affichee
  // (sinon les evenements des jours passes -- ex. 2 exploits apparus -- seraient invisibles).
  const sum = (pick: (d: DriftDaily) => number) => daily.reduce((acc, d) => acc + pick(d), 0);
  const items = [
    { label: t('drift.n_scored'), value: latest.n_scored },
    { label: t('drift.n_new'), value: sum((d) => d.n_new) },
    { label: t('drift.n_flipped'), value: sum((d) => d.n_flipped) },
    { label: t('drift.n_matured'), value: latest.n_matured },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-2xl font-bold text-slate-900">{item.value}</div>
          <div className="text-xs text-slate-500">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

function ModelCounters({ daily }: { daily: DriftDaily[] }) {
  const { t } = useI18n();
  if (daily.length === 0) {
    return null;
  }
  const sum = (pick: (d: DriftDaily) => number) => daily.reduce((acc, d) => acc + pick(d), 0);
  const deltas = daily.map((d) => d.pep_delta_avg).filter((v): v is number => v !== null);
  const avg = deltas.length > 0 ? deltas.reduce((a, b) => a + b, 0) / deltas.length : null;
  const items = [
    { label: t('drift.pep_up'), value: String(sum((d) => d.n_pep_up)), color: 'text-emerald-600' },
    { label: t('drift.pep_down'), value: String(sum((d) => d.n_pep_down)), color: 'text-red-600' },
    {
      label: t('drift.pep_delta_avg'),
      value: avg === null ? '—' : avg.toFixed(4),
      color: 'text-slate-900',
    },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
          <div className="text-xs text-slate-500">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

function AlertsTable({ alerts }: { alerts: DriftAlert[] }) {
  const { t } = useI18n();
  if (alerts.length === 0) {
    return <p className="text-sm text-slate-400">{t('drift.no_alerts')}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-red-200">
      <table className="w-full text-left text-sm">
        <tbody>
          {alerts.map((alert) => (
            <tr key={`${alert.day}-${alert.metric}`} className="border-b border-red-100 bg-red-50">
              <td className="px-4 py-2 font-mono text-red-700">{formatFr(alert.day)}</td>
              <td className="px-4 py-2 font-medium text-red-700">{alert.metric}</td>
              <td className="px-4 py-2 text-red-700">
                {alert.value} &gt; {alert.threshold}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DateRange({
  from,
  to,
  min,
  max,
  onFrom,
  onTo,
}: {
  from: string;
  to: string;
  min: string;
  max: string;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
}) {
  const { t } = useI18n();
  const cls = 'rounded-md border border-slate-300 px-2 py-1 text-sm';
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
      <span className="font-medium">{t('drift.range')}</span>
      <input
        type="date"
        value={from}
        min={min}
        max={max}
        className={cls}
        onChange={(event) => {
          onFrom(event.target.value);
        }}
      />
      <span>&rarr;</span>
      <input
        type="date"
        value={to}
        min={min}
        max={max}
        className={cls}
        onChange={(event) => {
          onTo(event.target.value);
        }}
      />
    </div>
  );
}

function DriftBody({ data }: { data: DriftResponse }) {
  const { t } = useI18n();
  const daily = data.daily;
  const minDay = daily[0]?.day ?? '';
  const maxDay = daily.at(-1)?.day ?? '';
  const [from, setFrom] = useState(minDay);
  const [to, setTo] = useState(maxDay);
  const [dismissed, setDismissed] = useState(false);

  // Filtre client : tout le dashboard (courbes + compteurs) reflete la plage [from, to].
  const view = daily.filter((point) => point.day >= from && point.day <= to);
  const latest = view.at(-1);
  const days = view.map((point) => formatFr(point.day));
  const brierThreshold = data.open_alerts.find((a) => a.metric === 'brier_rolling')?.threshold;

  // Rouge = drift de DISTRIBUTION (alerte PSI) : critique, non fermable. Jaune = retrain conseille : fermable.
  const psiAlert = data.open_alerts.some((a) => a.metric === 'psi');
  const retrainWarn = latest?.retrain_flag === true && !psiAlert;
  return (
    <>
      <DateRange from={from} to={to} min={minDay} max={maxDay} onFrom={setFrom} onTo={setTo} />
      {psiAlert && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-800 ring-1 ring-red-300">
          {t('drift.retrain_critical')}
        </div>
      )}
      {retrainWarn && !dismissed && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 ring-1 ring-amber-200">
          <span>{t('drift.retrain')}</span>
          <button
            type="button"
            onClick={() => {
              setDismissed(true);
            }}
            aria-label={t('drift.dismiss')}
            className="rounded px-2 text-amber-600 hover:bg-amber-100"
          >
            &times;
          </button>
        </div>
      )}
      <h3 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
        {t('drift.group_truth')}
      </h3>
      <CountersRow daily={view} />
      <h3 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
        {t('drift.group_model')}
      </h3>
      <ModelCounters daily={view} />
      <div className="grid gap-4 lg:grid-cols-2">
        <DriftLineChart
          label={t('drift.psi')}
          days={days}
          values={view.map((point) => point.psi)}
          color="#6366f1"
          threshold={0.2}
          thresholdLabel={`${t('drift.threshold')} 0.2`}
        />
        <DriftLineChart
          label={t('drift.brier')}
          days={days}
          values={view.map((point) => point.brier_rolling)}
          color="#0ea5e9"
          threshold={brierThreshold}
          thresholdLabel={
            brierThreshold === undefined
              ? undefined
              : `${t('drift.threshold')} ${String(brierThreshold)}`
          }
        />
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold text-slate-800">{t('drift.alerts')}</h3>
        <AlertsTable alerts={data.open_alerts} />
      </div>
    </>
  );
}

// Hook de donnees : setState uniquement dans les callbacks des promesses (jamais dans le corps
// synchrone de l'effet) -> conforme react-hooks/set-state-in-effect.
function useDrift() {
  const [data, setData] = useState<DriftResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const onError = useCallback((err: unknown) => {
    setError(err instanceof Error ? err.message : String(err));
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    void fetchDrift(DRIFT_DAYS)
      .then(setData)
      .catch(onError)
      .finally(() => {
        setLoading(false);
      });
  }, [onError]);

  useEffect(() => {
    let active = true;
    void fetchDrift(DRIFT_DAYS)
      .then((res) => {
        if (active) {
          setData(res);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          onError(err);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [onError]);

  return { data, error, loading, refresh };
}

export function DriftPage() {
  const { t } = useI18n();
  const { data, error, loading, refresh } = useDrift();
  const empty = !loading && error === null && (data?.daily.length ?? 0) === 0;

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-5 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('drift.title')}</h1>
          <p className="mt-1 text-slate-500">{t('drift.desc')}</p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          {t('drift.refresh')}
        </button>
      </div>

      {loading && data === null && <p className="text-slate-400">{t('drift.loading')}</p>}
      {error !== null && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}
      {empty && <p className="text-slate-400">{t('drift.empty')}</p>}
      {data !== null && <DriftBody data={data} />}
    </section>
  );
}
