export type ParetoSource = {
  name: string;
  usageCount: number;
  isOverdue?: boolean;
};

export type ParetoRow = {
  name: string;
  uses: number;
  cumulative: number;
  /** True when the tool has an outstanding overdue return; those bars are drawn in red. */
  overdue: boolean;
};

/** Share of all scans the "vital few" tools are expected to cover. */
export const PARETO_TARGET_SHARE = 80;

/**
 * Ranks tools by recorded scans (descending) and tracks the cumulative share of
 * all activity. Tools past the `limit` are grouped into a single row labelled
 * with `othersLabel`, where `{count}` is replaced by the number of grouped tools.
 */
export function buildPareto(
  tools: readonly ParetoSource[],
  limit: number,
  othersLabel: string,
) {
  const ranked = tools
    .filter((tool) => tool.usageCount > 0)
    .sort((a, b) => b.usageCount - a.usageCount);
  const totalUses = ranked.reduce((sum, tool) => sum + tool.usageCount, 0);

  // "Vital few": number of most-used tools needed to cover the target share.
  let vitalFew = 0;
  let running = 0;
  for (const tool of ranked) {
    running += tool.usageCount;
    vitalFew += 1;
    if (running / totalUses >= PARETO_TARGET_SHARE / 100) break;
  }

  const shown = limit > 0 ? ranked.slice(0, limit) : ranked;
  const rest = ranked.slice(shown.length);

  const rows: Omit<ParetoRow, 'cumulative'>[] = shown.map((tool) => ({
    name: tool.name,
    uses: tool.usageCount,
    overdue: tool.isOverdue === true,
  }));
  if (rest.length > 0) {
    // The grouped row mixes overdue and on-time tools, so it is never red.
    rows.push({
      name: othersLabel.replace('{count}', String(rest.length)),
      uses: rest.reduce((sum, tool) => sum + tool.usageCount, 0),
      overdue: false,
    });
  }

  let cumulativeUses = 0;
  const data: ParetoRow[] = rows.map((row) => {
    cumulativeUses += row.uses;
    return {
      ...row,
      cumulative:
        totalUses > 0 ? Math.round((cumulativeUses / totalUses) * 1000) / 10 : 0,
    };
  });

  return { data, totalUses, vitalFew };
}
