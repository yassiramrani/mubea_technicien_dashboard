'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Download,
  Package,
  QrCode,
  RefreshCw,
  Search,
  Wrench,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from 'recharts';
import { useTranslation } from '@/lib/LanguageContext';
import { normalizeSearch } from '@/lib/inventoryFilters';
import {
  buildPurchaseGuide,
  type GuideEntry,
  type GuideVerdict,
} from '@/lib/purchaseGuide';

type UnreturnedTool = {
  id: string;
  name: string;
  technicianName: string;
  checkedOutAt: string | null;
  isOverdue: boolean;
};
type Stats = {
  totalTechnicians: number;
  totalTools: number;
  availableTools: number;
  assignedTools: number;
  todayLogs: number;
  totalLogs: number;
  recentLogs: {
    id: string;
    action: string;
    createdAt: string;
    technician: { name: string };
    tool: { name: string };
  }[];
  usageTrend?: { date: string; taken: number; returned: number }[];
  unreturnedTools?: UnreturnedTool[];
  toolUsage?: {
    id: string;
    name: string;
    status: string;
    usageCount: number;
  }[];
  toolsByTechnician: {
    idNumber: string;
    name: string;
    toolCount: number;
    tools: string[];
  }[];
};

// How each buying-guide verdict is presented: chip colour plus translated label.
const VERDICT_CHIP: Record<GuideVerdict, string> = {
  order: 'badge-warning',
  watch: 'badge-info',
  rarely: 'badge-muted',
  never: 'badge-muted',
};
const VERDICT_LABEL: Record<
  GuideVerdict,
  'guideOrder' | 'guideWatch' | 'guideRarely' | 'guideNever'
> = {
  order: 'guideOrder',
  watch: 'guideWatch',
  rarely: 'guideRarely',
  never: 'guideNever',
};

function GuideList({ entries, emptyText }: { entries: GuideEntry[]; emptyText: string }) {
  const { t, lang } = useTranslation();

  if (entries.length === 0) {
    return <p className="text-muted guide-empty">{emptyText}</p>;
  }

  return (
    <ul className="guide-list">
      {entries.map((entry) => (
        <li className="guide-row" key={entry.id}>
          <div className="guide-head">
            <Link
              className="text-link"
              href={`/tools?search=${encodeURIComponent(entry.name)}#inventory`}
            >
              {entry.name}
            </Link>
            <span className={`badge ${VERDICT_CHIP[entry.verdict]}`}>
              {t(VERDICT_LABEL[entry.verdict])}
            </span>
          </div>
          <p className="guide-detail">
            {entry.uses.toLocaleString(lang)} {t('uses')}
            {entry.out ? ` · ${t('guideOut')}` : ''}
          </p>
        </li>
      ))}
    </ul>
  );
}

export default function OverviewPage() {
  const { t, lang } = useTranslation();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [followupFilter, setFollowupFilter] = useState<'overdue' | 'all'>(
    'overdue',
  );
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const requestId = useRef(0);

  const loadStats = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const response = await fetch('/api/stats', { cache: 'no-store' });
      if (!response.ok) throw new Error('Unable to load stats');
      const data: Stats = await response.json();
      if (id !== requestId.current) return;
      setStats(data);
      setError(false);
      setUpdatedAt(new Date());
    } catch {
      if (id === requestId.current) setError(true);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const requests = requestId;
    const timer = window.setTimeout(() => void loadStats(), 0);
    return () => {
      window.clearTimeout(timer);
      requests.current++;
    };
  }, [loadStats]);

  const formatDate = (date: string) =>
    new Intl.DateTimeFormat(lang, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Africa/Casablanca',
    }).format(new Date(date));
  const unreturned = stats?.unreturnedTools ?? [];
  const overdueCount = unreturned.filter((tool) => tool.isOverdue).length;
  const query = normalizeSearch(search).split(/\s+/).filter(Boolean);
  const followupTools = unreturned
    .filter((tool) => {
      if (followupFilter === 'overdue' && !tool.isOverdue) return false;
      const text = normalizeSearch(`${tool.name} ${tool.technicianName}`);
      return query.every((word) => text.includes(word));
    })
    .sort((a, b) => {
      const first = a.checkedOutAt
        ? new Date(a.checkedOutAt).getTime()
        : Infinity;
      const second = b.checkedOutAt
        ? new Date(b.checkedOutAt).getTime()
        : Infinity;
      return first === second
        ? a.name.localeCompare(b.name, lang, { numeric: true })
        : first < second
          ? -1
          : 1;
    });
  const utilization = stats?.totalTools
    ? Math.round((stats.assignedTools / stats.totalTools) * 100)
    : 0;
  const guide = useMemo(
    () => buildPurchaseGuide(stats?.toolUsage ?? [], 5, lang),
    [stats, lang],
  );
  const exportFollowup = async () => {
    setExporting(true);
    setExportError(false);
    try {
      const { exportToExcel } = await import('@/lib/exportToExcel');
      await exportToExcel(
        followupTools.map((tool) => ({
          [t('tool')]: tool.name,
          [t('technician')]: tool.technicianName,
          [t('checkedOut')]: tool.checkedOutAt
            ? formatDate(tool.checkedOutAt)
            : t('unknownDate'),
          [t('status')]: t(tool.isOverdue ? 'overdue' : 'assigned'),
        })),
        'Mubea_Followup',
      );
    } catch {
      setExportError(true);
    } finally {
      setExporting(false);
    }
  };
  const summary = [
    {
      label: t('totalTools'),
      value: stats?.totalTools,
      icon: Package,
      href: '/tools#inventory',
      detail: t('inventoryOverview'),
      accent: 'primary',
    },
    {
      label: t('available'),
      value: stats?.availableTools,
      icon: CheckCircle2,
      href: '/tools?status=AVAILABLE#inventory',
      detail: t('readyToUse'),
      accent: 'success',
    },
    {
      label: t('assigned'),
      value: stats?.assignedTools,
      icon: Wrench,
      href: '/tools?status=ASSIGNED#inventory',
      detail: t('currentlyCheckedOut'),
      accent: 'assigned',
    },
    {
      label: t('overdue'),
      value: stats ? overdueCount : undefined,
      icon: AlertTriangle,
      href: '/tools?status=overdue#inventory',
      detail: t('fromPreviousDays'),
      accent: 'danger',
    },
  ];

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">{t('overview')}</h1>
          <p className="page-description">{t('overviewDescription')}</p>
          {updatedAt && (
            <p className="refresh-note">
              <Clock3 size={13} aria-hidden="true" /> {t('lastUpdated')}{' '}
              {new Intl.DateTimeFormat(lang, {
                timeStyle: 'short',
                timeZone: 'Africa/Casablanca',
              }).format(updatedAt)}
            </p>
          )}
        </div>
        <div className="header-actions">
          <button
            className="btn btn-outline"
            onClick={() => void loadStats()}
            disabled={loading}
          >
            <RefreshCw size={16} aria-hidden="true" /> {t('refresh')}
          </button>
          <Link className="btn btn-primary" href="/scanner">
            <QrCode size={17} aria-hidden="true" /> {t('openScanner')}
          </Link>
        </div>
      </header>
      {error && (
        <div className="error-banner" role="alert">
          <span>
            {t('unableLoadDashboard')}
            {stats && ` ${t('showingLastLoaded')}`}
          </span>
          <button
            className="btn btn-outline"
            onClick={() => void loadStats()}
            disabled={loading}
          >
            {t('retry')}
          </button>
        </div>
      )}
      <div className="summary-strip" aria-busy={loading}>
        {summary.map(({ label, value, icon: Icon, href, detail, accent }) => (
          <Link
            className={`summary-item accent-${accent}${accent === 'danger' && overdueCount > 0 ? ' alert' : ''}`}
            href={href}
            key={label}
          >
            <span className="summary-label">
              <Icon size={16} aria-hidden="true" />
              {label}
            </span>
            <strong
              className={`summary-value${label === t('overdue') && overdueCount > 0 ? ' text-danger' : ''}`}
            >
              {value === undefined ? '—' : value.toLocaleString(lang)}
            </strong>
            <p className="summary-detail">{detail}</p>
          </Link>
        ))}
      </div>

      <div className="workspace-grid">
        <section
          className="card"
          aria-labelledby="followup-title"
          aria-busy={loading}
        >
          <div className="section-heading">
            <div>
              <h2 id="followup-title">{t('returnFollowup')}</h2>
              <p>{t('followupDescription')}</p>
            </div>
            <button
              className="btn btn-outline"
              onClick={() => void exportFollowup()}
              disabled={
                !stats || loading || error || !followupTools.length || exporting
              }
            >
              <Download size={15} aria-hidden="true" />
              {t(exporting ? 'exporting' : 'exportList')}
            </button>
          </div>
          <div className="filter-tabs" aria-label={t('followupFilter')}>
            <button
              className="filter-tab"
              aria-pressed={followupFilter === 'overdue'}
              onClick={() => setFollowupFilter('overdue')}
            >
              {t('overdue')} <span>{stats ? overdueCount : '—'}</span>
            </button>
            <button
              className="filter-tab"
              aria-pressed={followupFilter === 'all'}
              onClick={() => setFollowupFilter('all')}
            >
              {t('allAssigned')} <span>{stats ? unreturned.length : '—'}</span>
            </button>
          </div>
          <div className="inventory-toolbar">
            <div className="form-group search-field">
              <label htmlFor="followup-search" className="form-label">
                {t('searchFollowup')}
              </label>
              <div className="search-input-wrap">
                <Search size={16} aria-hidden="true" />
                <input
                  id="followup-search"
                  type="search"
                  className="form-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('followupSearchPlaceholder')}
                />
              </div>
            </div>
          </div>
          {exportError && (
            <p className="form-error" role="alert">
              {t('exportFailed')}
            </p>
          )}
          {!stats ? (
            <div className="loading-placeholder">
              {t(loading ? 'loading' : 'unableLoadDashboard')}
            </div>
          ) : followupTools.length === 0 ? (
            <div className="empty-state">
              <CheckCircle2 size={28} aria-hidden="true" />
              <strong>
                {t(
                  search
                    ? 'noMatchingTools'
                    : followupFilter === 'overdue'
                      ? 'noOverdueTools'
                      : 'allMaterialsReturned',
                )}
              </strong>
              <p>{t(search ? 'tryDifferentFilters' : 'followupEmptyHint')}</p>
              {search && (
                <button
                  className="btn btn-outline"
                  onClick={() => setSearch('')}
                >
                  {t('clearSearch')}
                </button>
              )}
            </div>
          ) : (
            <div
              className="table-scroll followup-scroll"
              role="region"
              aria-label={t('returnFollowup')}
              tabIndex={0}
            >
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">{t('tool')}</th>
                    <th scope="col">{t('technician')}</th>
                    <th scope="col">{t('checkedOut')}</th>
                  </tr>
                </thead>
                <tbody>
                  {followupTools.map((tool) => (
                    <tr
                      key={tool.id}
                      className={tool.isOverdue ? 'tool-overdue-row' : undefined}
                    >
                      <td>
                        <Link
                          className="text-link"
                          href={`/tools?search=${encodeURIComponent(tool.name)}#inventory`}
                        >
                          {tool.name}
                        </Link>
                        <div>
                          {tool.isOverdue && (
                            <span className="badge badge-danger">
                              {t('overdue')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{tool.technicianName}</td>
                      <td>
                        {tool.checkedOutAt
                          ? formatDate(tool.checkedOutAt)
                          : t('unknownDate')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="section-heading inventory-jump">
            <p aria-live="polite">
              {stats &&
                t('followupCount').replace(
                  '{count}',
                  String(followupTools.length),
                )}
            </p>
            <Link href="/tools?status=overdue#inventory" className="text-link">
              {t('openInventory')}
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </section>
        <section className="card" aria-labelledby="activity-title">
          <div className="section-heading">
            <div>
              <h2 id="activity-title">{t('recentActivity')}</h2>
              <p>
                {t('activityToday')}: {stats?.todayLogs ?? '—'}
              </p>
            </div>
            <Link className="text-link" href="/logs">
              {t('viewAll')}
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
          {!stats ? (
            <div className="loading-placeholder">
              {t(loading ? 'loading' : 'unableLoadDashboard')}
            </div>
          ) : stats.recentLogs.length === 0 ? (
            <div className="empty-state">{t('noActivity')}</div>
          ) : (
            stats.recentLogs.slice(0, 6).map((log) => (
              <div className="activity-row" key={log.id}>
                <div
                  className={`activity-symbol${log.action === 'TAKEN' ? ' activity-symbol-taken' : ' activity-symbol-returned'}`}
                >
                  {log.action === 'TAKEN' ? (
                    <ArrowUpRight size={17} aria-hidden="true" />
                  ) : (
                    <ArrowDownLeft size={17} aria-hidden="true" />
                  )}
                </div>
                <div className="activity-content">
                  <strong>{log.tool.name}</strong>
                  <p>
                    {t(log.action === 'TAKEN' ? 'taken' : 'returned')} ·{' '}
                    {log.technician.name}
                  </p>
                </div>
                <time
                  dateTime={log.createdAt}
                  title={formatDate(log.createdAt)}
                >
                  {new Intl.DateTimeFormat(lang, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Africa/Casablanca',
                  }).format(new Date(log.createdAt))}
                </time>
              </div>
            ))
          )}
        </section>
      </div>

      <div className="workspace-grid">
        <section className="card" aria-labelledby="trend-title">
          <div className="section-heading">
            <div>
              <h2 id="trend-title">{t('sevenDayTrend')}</h2>
              <p>{t('trendDescription')}</p>
            </div>
          </div>
          {!stats ? (
            <div className="loading-placeholder">
              {t(loading ? 'loading' : 'unableLoadDashboard')}
            </div>
          ) : (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.usageTrend ?? []}
                  margin={{ left: -20, right: 10, top: 10 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e2e8f0"
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    dataKey="taken"
                    name={t('taken')}
                    fill="#0055a4"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={25}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="returned"
                    name={t('returned')}
                    fill="#087f5b"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={25}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
        <section className="card" aria-labelledby="stock-title">
          <div className="section-heading">
            <h2 id="stock-title">{t('toolStatusDistribution')}</h2>
            <span className="badge badge-info">
              {stats ? `${utilization}%` : '—'} {t('utilization')}
            </span>
          </div>
          {!stats ? (
            <div className="loading-placeholder">
              {t(loading ? 'loading' : 'unableLoadDashboard')}
            </div>
          ) : (
            <>
              <div className="stock-bar" aria-hidden="true">
                <div
                  className="stock-bar-available"
                  style={{
                    width: `${stats.totalTools ? (stats.availableTools / stats.totalTools) * 100 : 0}%`,
                  }}
                />
                <div
                  className="stock-bar-assigned"
                  style={{ width: `${utilization}%` }}
                >
                  {overdueCount > 0 && stats.assignedTools > 0 && (
                    <div
                      className="stock-bar-overdue"
                      style={{
                        width: `${(overdueCount / stats.assignedTools) * 100}%`,
                      }}
                    />
                  )}
                </div>
              </div>
              <div className="stock-legend">
                <div>
                  <strong>{stats.availableTools}</strong>
                  <span>
                    <i className="legend-dot dot-available" aria-hidden="true" />
                    {t('available')}
                  </span>
                </div>
                <div>
                  <strong>{stats.assignedTools}</strong>
                  <span>
                    <i className="legend-dot dot-assigned" aria-hidden="true" />
                    {t('assigned')}
                  </span>
                </div>
                {overdueCount > 0 && (
                  <div>
                    <strong>{overdueCount}</strong>
                    <span>
                      <i className="legend-dot dot-overdue" aria-hidden="true" />
                      {t('overdue')}
                    </span>
                  </div>
                )}
              </div>
              <div className="mini-stats">
                <div>
                  <strong>{stats.totalTechnicians}</strong>
                  <span>{t('technicians')}</span>
                </div>
                <div>
                  <strong>{stats.totalLogs.toLocaleString(lang)}</strong>
                  <span>{t('totalMovements')}</span>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
      <section className="card" aria-labelledby="guide-title">
        <div className="section-heading">
          <div>
            <h2 id="guide-title">{t('buyingGuide')}</h2>
            <p>{t('buyingGuideDesc')}</p>
          </div>
        </div>
        {!stats ? (
          <div className="loading-placeholder">
            {t(loading ? 'loading' : 'unableLoadDashboard')}
          </div>
        ) : (
          <div className="guide-grid">
            <div>
              <h3 className="guide-heading">{t('mostUsed')}</h3>
              <GuideList
                entries={guide.mostUsed}
                emptyText={t('noUsageData')}
              />
            </div>
            <div>
              <h3 className="guide-heading">{t('leastUsed')}</h3>
              <GuideList
                entries={guide.leastUsed}
                emptyText={t('noUsageData')}
              />
            </div>
          </div>
        )}
      </section>
      <section className="card" aria-labelledby="technicians-title">
        <div className="section-heading">
          <h2 id="technicians-title">{t('topActiveTechnicians')}</h2>
          <Link className="text-link" href="/technicians">
            {t('viewAll')}
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
        {!stats ? (
          <div className="loading-placeholder">
            {t(loading ? 'loading' : 'unableLoadDashboard')}
          </div>
        ) : stats.toolsByTechnician.length === 0 ? (
          <p className="empty-state">{t('noTechniciansFound')}</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">{t('technician')}</th>
                  <th scope="col">{t('idNumber')}</th>
                  <th scope="col">{t('assignedTools')}</th>
                </tr>
              </thead>
              <tbody>
                {stats.toolsByTechnician.slice(0, 5).map((technician) => (
                  <tr key={technician.idNumber}>
                    <td>
                      <Link
                        className="text-link"
                        href={`/tools?search=${encodeURIComponent(technician.idNumber)}&status=ASSIGNED#inventory`}
                      >
                        {technician.name}
                      </Link>
                    </td>
                    <td>{technician.idNumber}</td>
                    <td>
                      <span className="badge badge-info">
                        {technician.toolCount}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
