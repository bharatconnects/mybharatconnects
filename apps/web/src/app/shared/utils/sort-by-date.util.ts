export type DateSortOrder = 'desc' | 'asc';

/**
 * Sorts by `updatedAt`, falling back to `createdAt` when a record has no
 * `updatedAt` (or vice versa when sorting by createdAt). Used to back the
 * "Newest first / Oldest first" filter on every list view.
 */
export interface HasDates {
  updatedAt?: string;
  createdAt?: string;
}

export function sortByDate<T extends HasDates>(
  items: T[],
  order: DateSortOrder,
  field: 'updatedAt' | 'createdAt' = 'updatedAt',
): T[] {
  const fallbackField = field === 'updatedAt' ? 'createdAt' : 'updatedAt';
  return [...items].sort((a, b) => {
    const aDate = new Date(a[field] ?? a[fallbackField] ?? 0).getTime();
    const bDate = new Date(b[field] ?? b[fallbackField] ?? 0).getTime();
    return order === 'desc' ? bDate - aDate : aDate - bDate;
  });
}
