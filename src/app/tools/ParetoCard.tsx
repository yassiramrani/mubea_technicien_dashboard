'use client';

import { useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTranslation } from '@/lib/LanguageContext';
import { buildPareto, PARETO_TARGET_SHARE, type ParetoSource } from '@/lib/pareto';

const BAR_COLOR = '#0055A4'; // Mubea blue
const CUMULATIVE_COLOR = '#f59e0b';
const OVERDUE_COLOR = '#c23535'; // Same red as the overdue badges
const TARGET_SHARE = PARETO_TARGET_SHARE;

// How many individual bars are shown before the rest is grouped into "Other tools".
const LIMIT_OPTIONS = [10, 15, 20];

/**
 * Pareto analysis of tool usage: tools are ranked by their number of recorded
 * scans (descending) and the line tracks the cumulative share of all activity.
 * The 80% reference line marks the "vital few" tools that drive most of the
 * daily work - the classic 80/20 view a manager asks for.
 *
 * Tools with an outstanding overdue return are drawn as red bars, so the risky
 * equipment inside the busiest tools is visible at a glance.
 */
export default function ParetoCard({ tools, loading }: { tools: ParetoSource[]; loading?: boolean }) {
  const { t } = useTranslation();
  const [limit, setLimit] = useState(15);

  const analysis = useMemo(
    () => buildPareto(tools, limit, t('paretoOthers')),
    [tools, limit, t],
  );

  const inventoryShare = tools.length > 0 ? Math.round((analysis.vitalFew / tools.length) * 100) : 0;

  return (
    <div className="card" style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ marginBottom: '0.25rem' }}>{t('paretoTitle')}</h3>
          <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: 0 }}>{t('paretoSubtitle')}</p>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor="pareto-limit">{t('paretoShowTop')}</label>
          <select
            id="pareto-limit"
            className="form-input"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            style={{ minWidth: '150px' }}
          >
            {LIMIT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {t('paretoTopN').replace('{count}', String(option))}
              </option>
            ))}
            <option value={0}>{t('paretoAllTools')}</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-muted">{t('loading')}</p>
      ) : analysis.totalUses === 0 ? (
        <p className="text-muted">{t('paretoNoData')}</p>
      ) : (
        <>
          <p style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            {t('paretoVitalFew')
              .replace('{count}', String(analysis.vitalFew))
              .replace('{percent}', String(inventoryShare))}
          </p>
          <div style={{ height: 340 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={analysis.data} margin={{ top: 8, right: 16, bottom: 64, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={70}
                  tick={{ fontSize: 11 }}
                />
                <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  tickFormatter={(value: number) => `${value}%`}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip />
                <Legend verticalAlign="top" height={32} />
                <ReferenceLine
                  yAxisId="right"
                  y={TARGET_SHARE}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  label={{ value: `${TARGET_SHARE}%`, position: 'insideTopRight', fill: '#ef4444', fontSize: 11 }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="uses"
                  name={t('uses')}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={48}
                >
                  {analysis.data.map((row) => (
                    <Cell
                      key={row.name}
                      fill={row.overdue ? OVERDUE_COLOR : BAR_COLOR}
                    />
                  ))}
                </Bar>
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="cumulative"
                  name={t('paretoCumulative')}
                  unit="%"
                  stroke={CUMULATIVE_COLOR}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="pareto-note">
            <span className="legend-dot dot-overdue" aria-hidden="true" />
            {t('paretoOverdueNote')}
          </p>
        </>
      )}
    </div>
  );
}
