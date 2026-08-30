// En-tete de colonne triable partage par les tables (convention barkahub).
// Icone lucide selon l'etat : ArrowUp (asc), ArrowDown (desc), ChevronsUpDown attenue (inactif).
// Une colonne non triable (enableSorting: false) rend juste son libelle, sans bouton.
import type { Header } from '@tanstack/react-table';

import { flexRender } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';

export function SortableHeader<T>({ header }: { header: Header<T, unknown> }) {
  const dir = header.column.getIsSorted();
  const label = flexRender(header.column.columnDef.header, header.getContext());
  return (
    <th className="px-4 py-2 font-medium">
      {header.column.getCanSort() ? (
        <button
          type="button"
          onClick={header.column.getToggleSortingHandler()}
          className={`inline-flex items-center gap-1 hover:text-indigo-600 ${
            dir ? 'text-indigo-600' : ''
          }`}
        >
          {label}
          {dir === 'asc' ? (
            <ArrowUp className="size-3.5" aria-hidden />
          ) : dir === 'desc' ? (
            <ArrowDown className="size-3.5" aria-hidden />
          ) : (
            <ChevronsUpDown className="size-3.5 opacity-40" aria-hidden />
          )}
        </button>
      ) : (
        label
      )}
    </th>
  );
}
