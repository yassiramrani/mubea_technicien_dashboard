'use client';

import { useState, useEffect, useCallback } from 'react';
import { exportToExcel } from '@/lib/exportToExcel';
import { useTranslation } from '@/lib/LanguageContext';
import { canManageProfiles } from '@/lib/permissions';
import {
  DEFAULT_TECHNICIAN_ROLE,
  ROLE_LABEL_KEY,
  TECHNICIAN_ROLES,
  normalizeTechnicianRole,
  type TechnicianRole,
} from '@/lib/technicianRoles';


// Turns the machine-readable reason a route refused into the sentence to display.
async function refusalReason(response: Response): Promise<string> {
  const payload: unknown = await response.json().catch(() => null);

  return typeof payload === 'object' && payload !== null
    ? String((payload as { error?: unknown }).error ?? '')
    : '';
}

type Technician = {
  id: string;
  name: string;
  idNumber: string;
  role: string;
  tools: Array<{ name: string }>;
};

export default function TechniciansPage() {
  const { t } = useTranslation();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [name, setName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [role, setRole] = useState<TechnicianRole>(DEFAULT_TECHNICIAN_ROLE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [roleMessage, setRoleMessage] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [mayManageProfiles, setMayManageProfiles] = useState(false);

  const fetchTechnicians = useCallback(async () => {
    try {
      const res = await fetch('/api/technicians');
      const data = await res.json();
      if (!res.ok || !Array.isArray(data)) throw new Error('Unable to load technicians');
      setTechnicians(data);
      setError(false);
    } catch (error) {
      setError(true);
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchTechnicians(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchTechnicians]);

  // Whether this session may add or change a profile. The server decides it and refuses the
  // writes in any case; this only decides whether the controls are worth drawing.
  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await fetch('/api/auth/session');

        if (!response.ok) {
          return;
        }

        const data: unknown = await response.json();

        if (!active || typeof data !== 'object' || data === null) {
          return;
        }

        const { role } = data as { role?: unknown };

        setMayManageProfiles(canManageProfiles(typeof role === 'string' ? role : undefined));
      } catch {
        // The list stays visible; the server refuses the writes in any case.
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const handleAddTechnician = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !idNumber) return;

    setFormMessage('');

    try {
      const res = await fetch('/api/technicians', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, idNumber, role }),
      });

      if (!res.ok) {
        const reason = await refusalReason(res);
        setFormMessage(reason === 'adminOnly' ? t('adminGrantRefused') : t('technicianAddFailed'));
        return;
      }

      setName('');
      setIdNumber('');
      setRole(DEFAULT_TECHNICIAN_ROLE);
      fetchTechnicians();
    } catch (error) {
      console.error(error);
      setFormMessage(t('technicianAddFailed'));
    }
  };

  const handleRoleChange = async (technicianId: string, newRole: string) => {
    setRoleMessage('');
    try {
      const res = await fetch('/api/technicians', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: technicianId, role: newRole }),
      });

      if (!res.ok) {
        const reason = await refusalReason(res);
        setRoleMessage(reason === 'adminOnly' ? t('adminGrantRefused') : t('roleUpdateFailed'));
        fetchTechnicians();
        return;
      }

      setTechnicians((current) => current.map((tech) => (
        tech.id === technicianId ? { ...tech, role: newRole } : tech
      )));
      setRoleMessage(t('roleUpdated'));
    } catch (error) {
      console.error(error);
      setRoleMessage(t('roleUpdateFailed'));
      fetchTechnicians();
    }
  };

  const handleExportExcel = () => {
    const data = technicians.map(tech => ({
      ID: tech.id,
      Name: tech.name,
      IDNumber: tech.idNumber,
      Profile: normalizeTechnicianRole(tech.role),
      AssignedToolsCount: tech.tools.length,
      AssignedToolsNames: tech.tools.map((tool) => tool.name).join(', '),
    }));
    exportToExcel(data, 'Mubea_Technicians');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>{t('techniciansManagement')}</h1>
        <button onClick={handleExportExcel} className="btn btn-primary" disabled={technicians.length === 0}>
          {t('exportExcel')}
        </button>
      </div>
      
        {error && <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{t('unableLoadTechnicians')}</p>}
      {mayManageProfiles ? (
        <div className="card" style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>{t('addNewTechnician')}</h3>
          <form onSubmit={handleAddTechnician} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '180px' }}>
              <label className="form-label">{t('name')}</label>
              <input 
                type="text" 
                className="form-input" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Doe"
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '180px' }}>
              <label className="form-label">{t('idNumber')}</label>
              <input 
                type="text" 
                className="form-input" 
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                placeholder="e.g. EMP-001"
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '220px' }}>
              <label className="form-label" htmlFor="new-technician-role">{t('technicianRole')}</label>
              <select
                id="new-technician-role"
                className="form-input"
                value={role}
                onChange={(e) => setRole(normalizeTechnicianRole(e.target.value))}
              >
                {TECHNICIAN_ROLES.map((value) => (
                  <option key={value} value={value}>
                    {t(ROLE_LABEL_KEY[value])}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn btn-primary" style={{ height: '38px' }}>
              {t('addTechnician')}
            </button>
          </form>
          <p className="text-muted" style={{ marginTop: '0.75rem', fontSize: '0.8rem' }}>{t('roleLabelerHint')}</p>
          <p className="text-muted" style={{ marginTop: '0.25rem', fontSize: '0.8rem' }}>{t('roleAdminHint')}</p>
          {formMessage && <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--danger)' }}>{formMessage}</p>}
        </div>
      ) : (
        <div className="card" style={{ marginBottom: '2rem' }}>
          <p className="text-muted" style={{ margin: 0 }}>{t('profilesAdminOnly')}</p>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>{t('techniciansList')}</h3>
        {roleMessage && <p style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>{roleMessage}</p>}
        {loading ? (
          <p>{t('loading')}</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('name')}</th>
                <th>{t('idNumber')}</th>
                <th>{t('technicianRole')}</th>
                <th>{t('assignedTools')}</th>
              </tr>
            </thead>
            <tbody>
              {technicians.map((tech) => (
                <tr key={tech.id}>
                  <td>{tech.name}</td>
                  <td>{tech.idNumber}</td>
                  <td>
                    {mayManageProfiles ? (
                      <select
                        className="form-input"
                        style={{ minWidth: '210px', padding: '0.3rem 0.5rem' }}
                        value={normalizeTechnicianRole(tech.role)}
                        onChange={(e) => void handleRoleChange(tech.id, e.target.value)}
                        aria-label={`${t('technicianRole')} — ${tech.name}`}
                      >
                        {TECHNICIAN_ROLES.map((value) => (
                          <option key={value} value={value}>
                            {t(ROLE_LABEL_KEY[value])}
                          </option>
                        ))}
                      </select>
                    ) : (
                      t(ROLE_LABEL_KEY[normalizeTechnicianRole(tech.role)])
                    )}
                  </td>
                  <td>
                    <span className="badge badge-info">{tech.tools.length}</span>
                  </td>
                </tr>
              ))}
              {technicians.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center' }}>{t('noTechnicians')}</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
