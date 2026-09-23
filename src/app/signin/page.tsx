'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { useTranslation } from '@/lib/LanguageContext';
import './signin.css';

/**
 * The sign-in screen. It is the only page reachable without a session, and it shows the bare
 * minimum: a name to pick and a code to type.
 */

type TechnicianOption = {
  id: string;
  name: string;
};

function SignInForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [technicianId, setTechnicianId] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const messageFor = useCallback(
    (errorKey: string | undefined): string => {
      switch (errorKey) {
        case 'wrongCode':
          return t('signInWrong');
        case 'tooManyAttempts':
          return t('signInTooMany');
        case 'notConfigured':
          return t('signInNotConfigured');
        default:
          return t('signInUnavailable');
      }
    },
    [t],
  );

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await fetch('/api/auth/technicians');
        const data: unknown = response.ok ? await response.json() : null;

        if (!active) {
          return;
        }

        if (Array.isArray(data)) {
          setTechnicians(data as TechnicianOption[]);
        } else {
          setError(t('signInUnavailable'));
        }
      } catch {
        if (active) {
          setError(t('signInUnavailable'));
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [t]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setBusy(true);

    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technicianId, code }),
      });

      if (response.ok) {
        // Only a path inside the application is honoured: an address coming from the query
        // string must never be able to send someone to another site after signing in.
        const next = searchParams.get('next');
        const destination = next?.startsWith('/') && !next.startsWith('//') ? next : '/';

        router.replace(destination);
        return;
      }

      const payload: unknown = await response.json().catch(() => null);
      const errorKey =
        typeof payload === 'object' && payload !== null
          ? (payload as { error?: string }).error
          : undefined;

      setError(messageFor(errorKey));
    } catch {
      setError(t('signInUnavailable'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="signin-page">
      <form className="card signin-card" onSubmit={submit}>
        <div className="signin-header">
          <ShieldCheck size={30} aria-hidden="true" />
          <div>
            <h1>{t('signInTitle')}</h1>
            <p className="text-muted">{t('signInSubtitle')}</p>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="technicianId">{t('signInProfile')}</label>
          <select
            id="technicianId"
            value={technicianId}
            onChange={(event) => setTechnicianId(event.target.value)}
            required
          >
            <option value="">{t('signInChoose')}</option>
            {technicians.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="code">{t('signInCode')}</label>
          <input
            id="code"
            type="password"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        {error ? (
          <p className="signin-error" role="alert">
            {error}
          </p>
        ) : null}

        <button
          className="btn btn-primary signin-submit"
          type="submit"
          disabled={busy || !technicianId || !code}
        >
          <KeyRound size={18} aria-hidden="true" />
          {busy ? t('signInWorking') : t('signInSubmit')}
        </button>

        <p className="text-muted signin-note">{t('signInNote')}</p>
      </form>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
