// Top mouvements du PEP (par CVE) + graphe d'evolution PEP vs EPSS de la CVE selectionnee.
// Bloc "valeur" : quelles CVE ont vu leur proba d'exploit bouger, et anticipe-t-on l'exploit ?
import type { SortingState } from '@tanstack/react-table';
import type { EChartsOption } from 'echarts';

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import ReactEChartsCore from 'echarts-for-react/esm/core';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { HistoryPoint, Mover } from '../lib/types';

import { fetchHistory, fetchMovers } from '../lib/api';
import { echarts } from '../lib/echarts';
import { formatFr } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { SortableHeader } from './sortable-header';

type Direction = 'up' | 'down';
const moverCol = createColumnHelper<Mover>();

// Courbe PEP vs EPSS d'une CVE dans le temps ; ligne rouge = jour ou l'exploit devient connu.
function CveHistoryChart({ cve }: { cve: string }) {
  const { t } = useI18n();
  const [pts, setPts] = useState<HistoryPoint[]>([]);
  useEffect(() => {
    let active = true;
    void fetchHistory(cve)
      .then((r) => {
        if (active) {
          setPts(r.history);
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
  }, [cve]);
  const flip = pts.find((p) => p.label === 1);
  const option: EChartsOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['PEP', 'EPSS'], top: 0, textStyle: { fontSize: 11 } },
    grid: { left: 36, right: 16, top: 30, bottom: 26 },
    xAxis: { type: 'category', data: pts.map((p) => formatFr(p.day)), boundaryGap: false },
    yAxis: { type: 'value', min: 0, max: 1 },
    series: [
      {
        name: 'PEP',
        type: 'line',
        data: pts.map((p) => p.pep),
        smooth: true,
        connectNulls: true,
        lineStyle: { color: '#6366f1', width: 2 },
        itemStyle: { color: '#6366f1' },
        markLine: flip
          ? {
              silent: true,
              symbol: 'none',
              data: [{ xAxis: formatFr(flip.day) }],
              lineStyle: { color: '#ef4444', type: 'dashed' },
              label: { formatter: t('drift.exploit_known'), color: '#ef4444', fontSize: 10 },
            }
          : undefined,
      },
      {
        name: 'EPSS',
        type: 'line',
        data: pts.map((p) => p.epss),
        smooth: true,
        connectNulls: true,
        lineStyle: { color: '#f59e0b', width: 2 },
        itemStyle: { color: '#f59e0b' },
      },
    ],
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h4 className="font-mono text-sm font-semibold text-slate-700">{cve} — PEP vs EPSS</h4>
      <p className="mb-2 text-xs text-slate-500">{t('drift.history_hint')}</p>
      {pts.length === 0 ? (
        <p className="text-sm text-slate-400">{t('drift.movers_empty')}</p>
      ) : (
        <ReactEChartsCore echarts={echarts} option={option} style={{ height: 240 }} />
      )}
    </div>
  );
}

// Filtre de direction (Hausses/Baisses) : segmented control place AU-DESSUS du tableau.
function DirectionFilter({
  direction,
  onChange,
}: {
  direction: Direction;
  onChange: (d: Direction) => void;
}) {
  const { t } = useI18n();
  const cls = (d: Direction) =>
    d === direction
      ? 'inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700'
      : 'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100';
  return (
    <div className="flex gap-1">
      <button
        type="button"
        onClick={() => {
          onChange('up');
        }}
        className={cls('up')}
      >
        <ArrowUp className="size-3.5" aria-hidden />
        {t('drift.movers_up')}
      </button>
      <button
        type="button"
        onClick={() => {
          onChange('down');
        }}
        className={cls('down')}
      >
        <ArrowDown className="size-3.5" aria-hidden />
        {t('drift.movers_down')}
      </button>
    </div>
  );
}

// Colonnes TanStack Table (statiques : en-tetes = simples libelles, sans controle interactif).
const moverColumns = [
  moverCol.accessor('cve', {
    header: 'CVE',
    cell: (i) => <span className="font-mono text-indigo-600">{i.getValue()}</span>,
  }),
  moverCol.accessor('day', {
    header: 'Date',
    cell: (i) => <span className="text-slate-500 tabular-nums">{formatFr(i.getValue())}</span>,
  }),
  moverCol.accessor('pep', {
    header: 'PEP',
    cell: (i) => (
      <span className="font-medium text-slate-800 tabular-nums">{i.getValue().toFixed(3)}</span>
    ),
  }),
  moverCol.accessor('pep_delta', {
    header: () => <>&Delta;PEP</>,
    cell: (i) => {
      const v = i.getValue();
      return (
        <span
          className={`font-semibold tabular-nums ${v > 0 ? 'text-emerald-600' : 'text-red-600'}`}
        >
          {v > 0 ? '▲ +' : '▼ '}
          {v.toFixed(3)}
        </span>
      );
    },
  }),
  moverCol.accessor('epss', {
    header: 'EPSS',
    cell: (i) => {
      const v = i.getValue();
      return <span className="text-slate-500 tabular-nums">{v === null ? '—' : v.toFixed(3)}</span>;
    },
  }),
];

export function TopMovers() {
  const { t } = useI18n();
  const [direction, setDirection] = useState<Direction>('up');
  const [selected, setSelected] = useState<string | null>(null);
  const [rows, setRows] = useState<Mover[]>([]);
  useEffect(() => {
    let active = true;
    void fetchMovers(direction, 60, 8)
      .then((data) => {
        if (active) {
          setRows(data);

          // Selection par defaut = 1re ligne ; on conserve la selection si elle existe encore.
          setSelected((cur) =>
            cur !== null && data.some((m) => m.cve === cur) ? cur : (data[0]?.cve ?? null),
          );
        }
      })
      .catch(() => {
        if (active) {
          setRows([]);
        }
      });
    return () => {
      active = false;
    };
  }, [direction]);

  // Tri client (8 lignes, ordre serveur par defaut) -> colonnes triables comme l'autre table.
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({
    data: rows,
    columns: moverColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getRowId: (r) => `${r.cve}-${r.day}`,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-lg font-semibold text-slate-800">{t('drift.movers')}</h3>
      <p className="text-xs text-slate-500">{t('drift.movers_hint')}</p>
      {/* Filtres au-dessus du tableau ; tableau a gauche, graphe a droite (empile sur mobile). */}
      <DirectionFilter direction={direction} onChange={setDirection} />
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">{t('drift.movers_empty')}</p>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="text-xs text-slate-400">
                    {hg.headers.map((h) => (
                      <SortableHeader key={h.id} header={h} />
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => {
                      setSelected(row.original.cve);
                    }}
                    className={`cursor-pointer border-t border-slate-100 ${
                      row.original.cve === selected ? 'bg-indigo-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-2">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selected !== null && <CveHistoryChart cve={selected} />}
        </div>
      )}
    </div>
  );
}
