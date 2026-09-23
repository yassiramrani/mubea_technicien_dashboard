import type { NextConfig } from 'next';

/**
 * Security headers, applied to every response.
 *
 * Until now the application served none of them: a browser was given no instruction at all,
 * which is why the page could be framed by any site and why nothing limited what could run
 * inside it.
 *
 * Two deliberate choices, stated rather than hidden:
 *
 *  - `script-src` and `style-src` keep `'unsafe-inline'`. Next.js injects its own bootstrap
 *    script and the tool pages carry an inline print stylesheet. Removing it means moving to
 *    per-request nonces, which is the next step, not something to pretend is already done.
 *  - the camera stays allowed (`Permissions-Policy: camera=(self)`), because the scanner uses
 *    it. A policy that breaks the workshop's main tool would be turned off, and a header that
 *    gets removed protects nobody.
 */

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  // Tool photographs are stored as data URLs and the exports build blob URLs.
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig: NextConfig = {
  // Announcing the framework in a response header only helps someone choosing a target.
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
