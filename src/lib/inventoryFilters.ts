export type InventoryStatus = 'all' | 'AVAILABLE' | 'ASSIGNED' | 'overdue';
export type InventorySort = 'name' | 'oldest' | 'usage';
export type LabelFilter = 'all' | 'pending' | 'printed';

type SearchableTool = {
  name: string;
  qrCode: string;
  status: string;
  technician: { name: string; idNumber?: string } | null;
  isOverdue: boolean;
  checkedOutAt: string | null;
  labelPrinted: boolean;
  usageCount: number;
};

export function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim();
}

/** Filter before pagination and export, so both use the same inventory view. */
export function filterInventory<T extends SearchableTool>(
  tools: readonly T[],
  {
    search,
    status,
    label,
    sort,
    lang,
  }: {
    search: string;
    status: InventoryStatus;
    label: LabelFilter;
    sort: InventorySort;
    lang: string;
  },
): T[] {
  const words = normalizeSearch(search).split(/\s+/).filter(Boolean);
  return tools
    .filter((tool) => {
      if (
        status === 'overdue'
          ? !tool.isOverdue
          : status !== 'all' && tool.status !== status
      )
        return false;
      if (label === 'pending' && tool.labelPrinted) return false;
      if (label === 'printed' && !tool.labelPrinted) return false;
      const text = normalizeSearch(
        [
          tool.name,
          tool.qrCode,
          tool.technician?.name,
          tool.technician?.idNumber,
        ]
          .filter(Boolean)
          .join(' '),
      );
      return words.every((word) => text.includes(word));
    })
    .sort((a, b) => {
      if (sort === 'usage' && a.usageCount !== b.usageCount)
        return b.usageCount - a.usageCount;
      if (sort === 'oldest') {
        const checkedOut = (tool: T) =>
          tool.status === 'ASSIGNED' && tool.checkedOutAt
            ? new Date(tool.checkedOutAt).getTime()
            : Number.POSITIVE_INFINITY;
        const first = checkedOut(a),
          second = checkedOut(b);
        if (first !== second) return first < second ? -1 : 1;
      }
      return a.name.localeCompare(b.name, lang, {
        numeric: true,
        sensitivity: 'base',
      });
    });
}
