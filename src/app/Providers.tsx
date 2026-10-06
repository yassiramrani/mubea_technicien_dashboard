'use client';

import { LanguageProvider, useTranslation } from '@/lib/LanguageContext';

function SkipLink() {
  const { t } = useTranslation();
  return <a href="#main-content" className="skip-link">{t('skipToContent')}</a>;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return <LanguageProvider><SkipLink />{children}</LanguageProvider>;
}
