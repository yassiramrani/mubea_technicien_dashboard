export type UsageTool = {
  id: string;
  name: string;
  status: string;
  usageCount: number;
};

export type GuideVerdict = 'order' | 'watch' | 'rarely' | 'never';

export type GuideEntry = {
  id: string;
  name: string;
  uses: number;
  /** True while the tool is out with a technician. */
  out: boolean;
  /**
   * `order` - busy tool that is out right now, another unit is worth planning.
   * `watch` - busy tool, but availability looks fine.
   * `rarely` - little recorded use, do not order.
   * `never` - never scanned, do not order.
   */
  verdict: GuideVerdict;
};

/**
 * Builds the buying guide: the busiest tools (candidates for an extra unit when
 * they are also out with a technician) and the least used tools (candidates for
 * "do not order"). The two lists never overlap, so a small inventory cannot show
 * the same tool on both sides.
 */
export function buildPurchaseGuide(
  tools: readonly UsageTool[],
  limit = 5,
  lang = 'en',
) {
  const byName = (a: UsageTool, b: UsageTool) =>
    a.name.localeCompare(b.name, lang, { sensitivity: 'base', numeric: true });

  const used = tools
    .filter((tool) => tool.usageCount > 0)
    .sort((a, b) => b.usageCount - a.usageCount || byName(a, b));
  const mostUsed: GuideEntry[] = used.slice(0, limit).map((tool) => {
    const out = tool.status === 'ASSIGNED';
    return {
      id: tool.id,
      name: tool.name,
      uses: tool.usageCount,
      out,
      verdict: out ? 'order' : 'watch',
    };
  });

  const shown = new Set(mostUsed.map((entry) => entry.id));
  const leastUsed: GuideEntry[] = [...tools]
    .filter((tool) => !shown.has(tool.id))
    .sort((a, b) => a.usageCount - b.usageCount || byName(a, b))
    .slice(0, limit)
    .map((tool) => ({
      id: tool.id,
      name: tool.name,
      uses: tool.usageCount,
      out: tool.status === 'ASSIGNED',
      verdict: tool.usageCount === 0 ? 'never' : 'rarely',
    }));

  return { mostUsed, leastUsed };
}
