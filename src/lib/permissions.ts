/**
 * Who may reach what.
 *
 * The application has one door — the session check in `proxy.ts` — and every signed-in profile
 * passes through it. This module describes the division of the application into *sections* and
 * the profiles allowed in each one, so that the rule lives in a single place instead of being
 * repeated in every page and every route handler.
 *
 * The section names follow the pages: `dashboard` is `/`, `technicians` is `/technicians`,
 * `tools` is `/tools` (the Pareto analysis is a card on that page, not a section of its own),
 * `scanner` is `/scanner` and `logs` is `/logs`.
 */

import { ADMIN_ROLE, isTechnicianRole, type TechnicianRole } from './technicianRoles';

export const SECTIONS = ['dashboard', 'technicians', 'tools', 'scanner', 'logs'] as const;

export type Section = (typeof SECTIONS)[number];

/**
 * The switch.
 *
 * `false` — every signed-in profile reaches every section. This is what the workshop has today
 * and what the manager asked to keep: the administrator profile *adds* access, it does not take
 * any away from the technicians and the identification profiles.
 *
 * `true`  — a section is only served to the profiles listed for it in `ROLE_SECTIONS` below.
 * Turning it on closes the dashboard, the tool inventory (Pareto analysis included), the
 * technician management and the reports to everyone but an administrator; technicians and
 * identification profiles keep the scanner. That is a real change of behaviour for the people
 * on the floor, which is exactly why it is one line and deliberately off.
 *
 * What it covers: the data endpoints (`/api/stats`, `/api/logs`, the writing routes of
 * `/api/technicians` and `/api/tools`). Pages keep rendering — they are client components that
 * read those endpoints, so a profile without access sees the page's normal error card and no
 * data. The data is what matters; the page is only its frame.
 */
export const ENFORCE_ROLE_ACCESS: boolean = false;

/**
 * The sections each profile is meant to reach, once `ENFORCE_ROLE_ACCESS` is turned on.
 *
 * The administrator reaches everything. A technician and an identification profile reach the
 * scanner: that is where their work happens.
 */
export const ROLE_SECTIONS: Record<TechnicianRole, readonly Section[]> = {
  ADMIN: SECTIONS,
  TECHNICIAN: ['scanner'],
  LABELER: ['scanner'],
};

/** The sections a profile is listed for, or none when the value is not a known profile. */
export function sectionsFor(role: string | null | undefined): readonly Section[] {
  return isTechnicianRole(role) ? ROLE_SECTIONS[role] : [];
}

/**
 * Whether a profile may reach a section. While the switch is off the answer is always yes, so
 * the interface can call this to decide what to display without changing anything.
 */
export function canAccess(role: string | null | undefined, section: Section): boolean {
  if (!ENFORCE_ROLE_ACCESS) {
    return true;
  }

  return sectionsFor(role).includes(section);
}

/** The manager profile: the one that reaches every section. */
export function isFullAccessRole(role: string | null | undefined): boolean {
  return role === ADMIN_ROLE;
}
