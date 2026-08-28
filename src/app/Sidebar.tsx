'use client';

import Link from 'next/link';
import { FileText, Languages, LayoutDashboard, QrCode, Users, Wrench } from 'lucide-react';
import { useTranslation } from '@/lib/LanguageContext';

export default function Sidebar() {
  const { lang, setLang, t } = useTranslation();
  const links = [
    { href: '/', label: t('overview'), icon: LayoutDashboard },
    { href: '/technicians', label: t('technicians'), icon: Users },
    { href: '/tools', label: t('tools'), icon: Wrench },
    { href: '/scanner', label: t('scanner'), icon: QrCode },
    { href: '/logs', label: t('logsReports'), icon: FileText },
  ];

  return (
    <aside className="sidebar">
      <div>
        <h2 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Mubea</h2>
        <p className="text-muted" style={{ fontSize: '0.875rem' }}>{t('toolManagement')}</p>
      </div>
      <button
        type="button"
        onClick={() => setLang(lang === 'en' ? 'fr' : 'en')}
        className="btn btn-primary"
        style={{ justifyContent: 'center' }}
        aria-label={t('switchLang')}
      >
        <Languages size={18} /> {t('switchLang')}
      </button>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {links.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="btn btn-outline" style={{ justifyContent: 'flex-start' }}>
            <Icon size={18} /> {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
