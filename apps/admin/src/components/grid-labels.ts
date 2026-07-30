'use client';

import { useMemo } from 'react';
import type { DataGridLabels } from '@axa/platform';
import { useI18n } from './i18n-provider';

/**
 * School's localisation for the Platform DataGrid's chrome.
 *
 * The grid ships English defaults because it cannot know a product's catalogue, and School is
 * bilingual with an RTL locale — so every grid has to be handed its strings. Doing that once here
 * rather than at each call site is what keeps "Loading rows…" from drifting into three spellings,
 * and it means a new grid is localised by construction instead of by remembering to be.
 *
 * The three functional labels take a template with a placeholder rather than being concatenated at
 * the call site, because Arabic does not put the count and the noun in the same order English
 * does. `{n} rows` and `{n} صفاً` are both a single translatable string; `t('…') + ' ' + n` is not.
 */
export function useGridLabels(): DataGridLabels {
  const { t } = useI18n();
  return useMemo(() => {
    const fill = (key: string, token: string, value: string) => t(key).replace(`{${token}}`, value);
    return {
      search: t('grid.search'),
      searchPlaceholder: t('grid.searchPlaceholder'),
      columns: t('grid.columns'),
      selectAll: t('grid.selectAll'),
      selectRow: (name) => fill('grid.selectRow', 'name', name),
      sortedAscending: t('grid.sortedAscending'),
      sortedDescending: t('grid.sortedDescending'),
      notSorted: t('grid.notSorted'),
      resizeColumn: (name) => fill('grid.resizeColumn', 'name', name),
      rowCount: (count) => fill('grid.rowCount', 'n', String(count)),
      loading: t('grid.loading'),
      empty: t('grid.empty'),
      actions: t('grid.actions'),
    };
  }, [t]);
}
