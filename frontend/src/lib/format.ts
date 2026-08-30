// Date ISO (AAAA-MM-JJ, format stocke/API) -> affichage francais JJ/MM/AAAA. null/vide -> '—'.
export function formatFr(iso: string | null): string {
  if (iso === null || iso === '') {
    return '—';
  }
  const [y, m, d] = iso.split('-');
  if (y === undefined || m === undefined || d === undefined) {
    return iso;
  }
  return `${d}/${m}/${y}`;
}
