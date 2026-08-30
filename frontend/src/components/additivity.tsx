// Nuage PEP vs EPSS : montre que notre signal est INDEPENDANT d'EPSS (haut-gauche = PEP eleve,
// EPSS bas). L'explorateur "angle mort d'EPSS" (table triable/pagine) vit dans ./epss-misses-table.
// NB : la carte "lead-time" a ete retiree -- c'etait un artefact du label statique (cf. comprendre S14.1).
import type { EChartsOption } from 'echarts';

import ReactEChartsCore from 'echarts-for-react/esm/core';
import { useEffect, useState } from 'react';

import type { ScatterPoint } from '../lib/types';

import { fetchScatter } from '../lib/api';
import { echarts } from '../lib/echarts';
import { useI18n } from '../lib/i18n';

const VALUE_PEP = 0.5; // seuils du quadrant : PEP eleve + EPSS bas (signal independant d'EPSS)
const VALUE_EPSS = 0.1;

export function AdditivityScatter() {
  const { t } = useI18n();
  const [pts, setPts] = useState<ScatterPoint[]>([]);
  useEffect(() => {
    let active = true;
    void fetchScatter(800)
      .then((d) => {
        if (active) {
          setPts(d);
        }
      })
      .catch(() => {
        if (active) {
          setPts([]);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  const isValue = (p: ScatterPoint) => p.pep >= VALUE_PEP && p.epss < VALUE_EPSS;

  // point = { name: CVE, value: [EPSS, PEP] } -> le nom sert au tooltip pour identifier la CVE
  const toPoint = (p: ScatterPoint) => ({ name: p.cve, value: [p.epss, p.pep] });
  const valuePts = pts.filter(isValue).map(toPoint);
  const otherPts = pts.filter((p) => !isValue(p)).map(toPoint);
  const option: EChartsOption = {
    tooltip: {
      trigger: 'item',
      formatter: (params) => {
        const d = params as unknown as { name?: string; value?: readonly number[] };
        const epss = d.value?.[0] ?? 0;
        const pep = d.value?.[1] ?? 0;
        return `<b>${d.name ?? ''}</b><br/>PEP ${pep.toFixed(3)} &middot; EPSS ${epss.toFixed(3)}`;
      },
    },
    legend: { data: [t('scatter.other'), t('scatter.value')], top: 0, textStyle: { fontSize: 11 } },
    grid: { left: 44, right: 18, top: 30, bottom: 40 },
    xAxis: { type: 'value', name: 'EPSS', min: 0, max: 1, nameLocation: 'middle', nameGap: 24 },
    yAxis: { type: 'value', name: 'PEP', min: 0, max: 1 },
    series: [
      {
        name: t('scatter.other'),
        type: 'scatter',
        data: otherPts,
        symbolSize: 5,
        itemStyle: { color: '#cbd5e1' },
      },
      {
        name: t('scatter.value'),
        type: 'scatter',
        data: valuePts,
        symbolSize: 6,
        itemStyle: { color: '#6366f1' },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: '#94a3b8', type: 'dashed' },
          data: [{ yAxis: VALUE_PEP }, { xAxis: VALUE_EPSS }],
        },
      },
    ],
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700">{t('scatter.title')}</h3>
      <p className="mb-2 text-xs text-slate-500">{t('scatter.hint')}</p>
      {pts.length === 0 ? (
        <p className="text-sm text-slate-400">{t('scatter.empty')}</p>
      ) : (
        <ReactEChartsCore echarts={echarts} option={option} style={{ height: 300 }} />
      )}
    </div>
  );
}
