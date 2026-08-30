// Explorateur "Angle mort d'EPSS" : exploits confirmes (label=1) a EPSS bas, triables /
// cherchables par CVE / pagines cote serveur (100k+ lignes). Table = TanStack Table en mode
// headless (on garde notre markup Tailwind), branchee sur /epss-misses (tri/filtre/page en SQL).
import type { OnChangeFn, PaginationState, SortingState } from '@tanstack/react-table';

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { EpssMisses, MissRow, MissSort } from '../lib/types';

import { fetchEpssMisses } from '../lib/api';
import { formatFr } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { SortableHeader } from './sortable-header';

const MISS_PAGE_SIZE = 12;
const columnHelper = createColumnHelper<MissRow>();

// Couleur de la criticite CVSS : >=9 critique, >=7 eleve, sinon neutre.
function cvssColor(v: number | null): string {
  if (v === null) {
    return 'text-slate-400';
  }
  if (v >= 9) {
    return 'text-red-600';
  }
  if (v >= 7) {
    return 'text-amber-600';
  }
  return 'text-slate-600';
}

// Definition declarative des colonnes (mode headless : on garde notre markup).
// L'id de chaque colonne == la cle de tri cote serveur (whitelist de /epss-misses).
// tabular-nums aligne les chiffres colonne par colonne (idiome barkahub).
function useMissColumns() {
  const { t } = useI18n();
  return useMemo(
    () => [
      columnHelper.accessor('cve', {
        header: 'CVE',
        cell: (i) => <span className="font-mono text-slate-700">{i.getValue()}</span>,
      }),
      columnHelper.accessor('cvss', {
        header: 'CVSS',
        cell: (i) => {
          const v = i.getValue();
          return (
            <span className={`font-semibold tabular-nums ${cvssColor(v)}`}>
              {v === null ? '—' : v.toFixed(1)}
            </span>
          );
        },
      }),
      columnHelper.accessor('pep', {
        header: 'PEP',
        cell: (i) => (
          <span className="font-semibold text-indigo-700 tabular-nums">
            {i.getValue().toFixed(3)}
          </span>
        ),
      }),
      columnHelper.accessor('epss', {
        header: 'EPSS',
        cell: (i) => <span className="text-amber-600 tabular-nums">{i.getValue().toFixed(4)}</span>,
      }),
      columnHelper.accessor('exploit_date', {
        header: t('misses.exploit_date'),
        cell: (i) => <span className="text-slate-500 tabular-nums">{formatFr(i.getValue())}</span>,
      }),
    ],
    [t],
  );
}

// Pied de pagination : "X-Y sur N" + boutons Prev/Next (chevrons lucide, comme barkahub).
function MissPagination({
  from,
  to,
  total,
  page,
  pageCount,
  onPrev,
  onNext,
}: {
  from: number;
  to: number;
  total: number;
  page: number;
  pageCount: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
      <span>
        {t('misses.showing')}{' '}
        <span className="font-semibold text-slate-700 tabular-nums">{from}</span>–
        <span className="font-semibold text-slate-700 tabular-nums">{to}</span> {t('misses.of')}{' '}
        <span className="font-semibold text-slate-700 tabular-nums">{total.toLocaleString()}</span>
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={onPrev}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="size-3.5" aria-hidden />
          {t('misses.prev')}
        </button>
        <span className="tabular-nums">
          {t('misses.page')} {page} / {pageCount}
        </span>
        <button
          type="button"
          disabled={page >= pageCount}
          onClick={onNext}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t('misses.next')}
          <ChevronRight className="size-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

export function EpssMissesTable() {
  const { t } = useI18n();
  const columns = useMissColumns();
  const [data, setData] = useState<EpssMisses | null>(null);
  const [loading, setLoading] = useState(true); // etat de chargement (idiome barkahub, dans l'ecran)
  const [search, setSearch] = useState(''); // saisie brute (immediate)
  const [q, setQ] = useState(''); // requete debouncee (envoyee a l'API)
  const [sorting, setSorting] = useState<SortingState>([{ id: 'cvss', desc: true }]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: MISS_PAGE_SIZE,
  });

  // Debounce de la recherche : 300ms sans frappe avant de requeter, et retour page 1.
  useEffect(() => {
    const id = setTimeout(() => {
      setQ(search.trim());
      setPagination((p) => ({ ...p, pageIndex: 0 }));
    }, 300);
    return () => {
      clearTimeout(id);
    };
  }, [search]);

  // Requete serveur a chaque changement de tri / page / recherche (Postgres fait le travail).
  useEffect(() => {
    const s = sorting[0];
    const sort = (s?.id ?? 'cvss') as MissSort;
    const order: 'asc' | 'desc' = s ? (s.desc ? 'desc' : 'asc') : 'desc';
    let active = true;
    setLoading(true);
    void fetchEpssMisses({
      q,
      sort,
      order,
      page: pagination.pageIndex + 1,
      pageSize: MISS_PAGE_SIZE,
    })
      .then((d) => {
        if (active) {
          setData(d);
        }
      })
      .catch(() => {
        if (active) {
          setData(null);
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
  }, [q, sorting, pagination]);

  // Un changement de tri renvoie en page 1 (sinon on lirait la page N du nouveau tri).
  const onSortingChange: OnChangeFn<SortingState> = (updater) => {
    setSorting((old) => (typeof updater === 'function' ? updater(old) : updater));
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  };

  const table = useReactTable({
    data: data?.rows ?? [],
    columns,
    state: { sorting, pagination },
    onSortingChange,
    onPaginationChange: setPagination,
    rowCount: data?.total ?? 0, // total serveur -> getPageCount() correct
    manualSorting: true,
    manualPagination: true,
    manualFiltering: true,
    getCoreRowModel: getCoreRowModel(),
  });

  // On ne masque le bloc que si la toute premiere requete ne remonte aucun exploit confirme.
  if (data === null || data.n_confirmed_low_epss === 0) {
    return null;
  }

  const total = data.total;
  const from = total === 0 ? 0 : pagination.pageIndex * MISS_PAGE_SIZE + 1;
  const to = Math.min((pagination.pageIndex + 1) * MISS_PAGE_SIZE, total);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700">{t('misses.title')}</h3>
      <p className="mb-2 text-xs text-slate-500">{t('misses.hint')}</p>
      <p className="mb-3 text-sm text-slate-700">
        <span className="text-lg font-bold text-indigo-700">
          {data.n_confirmed_low_epss.toLocaleString()}
        </span>{' '}
        {t('misses.confirmed')} ·{' '}
        <span className="text-lg font-bold text-emerald-600">
          {data.n_we_caught.toLocaleString()}
        </span>{' '}
        {t('misses.caught')}
      </p>

      <input
        type="search"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
        }}
        placeholder={t('misses.search')}
        className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-indigo-400 sm:w-72"
      />

      <div className="relative overflow-x-auto rounded-lg border border-slate-100">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 text-xs text-slate-400">
            {t('drift.loading')}
          </div>
        )}
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
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-center text-slate-400">
                  {t('misses.empty')}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <MissPagination
        from={from}
        to={to}
        total={total}
        page={pagination.pageIndex + 1}
        pageCount={table.getPageCount()}
        onPrev={() => {
          table.previousPage();
        }}
        onNext={() => {
          table.nextPage();
        }}
      />
    </div>
  );
}
