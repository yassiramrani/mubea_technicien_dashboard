'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FileText, Languages, LayoutDashboard, LogOut, QrCode, Users, Wrench } from 'lucide-react';
import { useTranslation } from '@/lib/LanguageContext';

export default function Sidebar() {
  const { lang, setLang, t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();

  // The sign-in screen is reached before there is a session: showing the navigation there
  // would only offer links that bounce straight back to it.
  if (pathname === '/signin') {
    return null;
  }

  const signOut = async () => {
    await fetch('/api/auth/signout', { method: 'POST' });
    // push and refresh together: the URL changes and the server-rendered pages are fetched
    // again, so nothing that belonged to the session stays on screen.
    router.push('/signin');
    router.refresh();
  };

  const links = [
    { href: '/', label: t('overview'), icon: LayoutDashboard },
    { href: '/technicians', label: t('technicians'), icon: Users },
    { href: '/tools', label: t('tools'), icon: Wrench },
    { href: '/scanner', label: t('scanner'), icon: QrCode },
    { href: '/logs', label: t('logsReports'), icon: FileText },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h2 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>{t('brandTitle')}</h2>
        <p className="text-muted" style={{ fontSize: '0.875rem' }}>{t('brandSubtitle')}</p>
      </div>
      <button
        type="button"
        onClick={() => setLang(lang === 'en' ? 'fr' : 'en')}
        className="btn btn-primary sidebar-language"
        style={{ justifyContent: 'center' }}
        aria-label={t('switchLang')}
      >
        <Languages size={18} /> {t('switchLang')}
      </button>
      <nav className="sidebar-nav">
        {links.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="btn btn-outline sidebar-link">
            <Icon size={18} /> {label}
          </Link>
        ))}
      </nav>
      <button
        type="button"
        onClick={() => void signOut()}
        className="btn btn-outline sidebar-link"
        style={{ justifyContent: 'center', marginTop: '0.75rem' }}
      >
        <LogOut size={18} /> {t('signOut')}
      </button>
    </aside>
  );
}
