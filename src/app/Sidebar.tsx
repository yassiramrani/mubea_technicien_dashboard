'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  FileText,
  Languages,
  LayoutDashboard,
  LogOut,
  QrCode,
  Users,
  Wrench,
  Menu,
  X,
} from 'lucide-react';
import { useTranslation } from '@/lib/LanguageContext';
import { canAccess, isFullAccessRole, type Section } from '@/lib/permissions';
import {
  ROLE_SHORT_LABEL_KEY,
  normalizeTechnicianRole,
  type TechnicianRole,
} from '@/lib/technicianRoles';

type SignedInProfile = {
  name: string;
  role: TechnicianRole;
};

export default function Sidebar() {
  const { lang, setLang, t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<SignedInProfile | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  const signInScreen = pathname === '/signin';

  // Which profile is signed in. It labels the navigation and says what that profile grants;
  // what a profile may actually read is decided by the server, never here.
  useEffect(() => {
    if (signInScreen) {
      return;
    }

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

        const { name, role } = data as { name?: unknown; role?: unknown };

        if (typeof name === 'string') {
          setProfile({ name, role: normalizeTechnicianRole(role) });
        }
      } catch {
        // The navigation stays usable without the name and the profile badge.
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [signInScreen]);

  // The sign-in screen is reached before there is a session: showing the navigation there
  // would only offer links that bounce straight back to it.
  if (signInScreen) {
    return null;
  }

  const signOut = async () => {
    setSigningOut(true);
    setSignOutError(false);
    try {
      const response = await fetch('/api/auth/signout', { method: 'POST' });
      if (!response.ok) throw new Error('Sign out failed');
      // push and refresh together: the URL changes and the server-rendered pages are fetched
      // again, so nothing that belonged to the session stays on screen.
      router.push('/signin');
      router.refresh();
    } catch {
      setSignOutError(true);
    } finally {
      setSigningOut(false);
    }
  };

  const links: {
    href: string;
    label: string;
    icon: typeof LayoutDashboard;
    section: Section;
  }[] = [
    {
      href: '/',
      label: t('overview'),
      icon: LayoutDashboard,
      section: 'dashboard',
    },
    {
      href: '/technicians',
      label: t('technicians'),
      icon: Users,
      section: 'technicians',
    },
    { href: '/tools', label: t('tools'), icon: Wrench, section: 'tools' },
    { href: '/scanner', label: t('scanner'), icon: QrCode, section: 'scanner' },
    { href: '/logs', label: t('logsReports'), icon: FileText, section: 'logs' },
  ];

  // While role access is not enforced this keeps every link, so the workshop sees exactly the
  // navigation it has today; the day the switch is turned on, the list follows the sections
  // the signed-in profile is listed for.
  const visibleLinks = links.filter(({ section }) =>
    canAccess(profile?.role, section),
  );

  return (
    <aside className={`sidebar${mobileOpen ? ' sidebar-open' : ''}`}>
      <div className="sidebar-brand">
        <div className="brand-mark" aria-hidden="true">
          <Wrench size={22} />
        </div>
        <div>
          <h2 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>
            {t('brandTitle')}
          </h2>
          <p className="text-muted" style={{ fontSize: '0.875rem' }}>
            {t('brandSubtitle')}
          </p>
        </div>
      </div>
      <button
        className="btn btn-outline mobile-nav-toggle"
        type="button"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-expanded={mobileOpen}
        aria-controls="main-navigation"
        aria-label={t(mobileOpen ? 'closeNavigation' : 'openNavigation')}
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
      <nav
        id="main-navigation"
        className="sidebar-nav"
        aria-label={t('navigation')}
      >
        {visibleLinks.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setMobileOpen(false)}
            aria-current={pathname === href ? 'page' : undefined}
            className={`btn sidebar-link${pathname === href ? ' sidebar-link-active' : ''}`}
          >
            <Icon size={19} aria-hidden="true" /> {label}
          </Link>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button
          type="button"
          onClick={() => setLang(lang === 'en' ? 'fr' : 'en')}
          className="btn btn-outline sidebar-language"
          style={{ justifyContent: 'center' }}
          aria-label={t('switchLang')}
        >
          <Languages size={18} /> {t('switchLang')}
        </button>
        {profile ? (
          <div
            style={{
              marginTop: '1rem',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              backgroundColor: 'var(--bg-main)',
              textAlign: 'center',
            }}
          >
            <p
              className="text-muted"
              style={{ fontSize: '0.75rem', margin: 0 }}
            >
              {t('signedInAs')}
            </p>
            <p style={{ fontWeight: 600, margin: '0.1rem 0 0.35rem' }}>
              {profile.name}
            </p>
            <span
              className={
                isFullAccessRole(profile.role)
                  ? 'badge badge-success'
                  : 'badge badge-info'
              }
            >
              {t(ROLE_SHORT_LABEL_KEY[profile.role])}
            </span>
            {isFullAccessRole(profile.role) ? (
              <p
                className="text-muted"
                style={{ fontSize: '0.75rem', margin: '0.4rem 0 0' }}
              >
                {t('fullAccess')}
              </p>
            ) : null}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => void signOut()}
          disabled={signingOut}
          className="btn btn-outline sidebar-link"
          style={{ justifyContent: 'center', marginTop: '0.75rem' }}
        >
          <LogOut size={18} /> {t('signOut')}
        </button>
        {signOutError && (
          <p className="form-error" role="alert">
            {t('signOutFailed')}
          </p>
        )}
      </div>
    </aside>
  );
}
