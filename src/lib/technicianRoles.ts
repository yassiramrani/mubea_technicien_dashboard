// Technician profiles.
//
// The app has no authentication: a "profile" is a technician record whose role
// decides what the scanner page does once a label is read.
export const TECHNICIAN_ROLES = ['TECHNICIAN', 'LABELER'] as const;

export type TechnicianRole = (typeof TECHNICIAN_ROLES)[number];

export const DEFAULT_TECHNICIAN_ROLE: TechnicianRole = 'TECHNICIAN';

/** Identification-only profile: renames tools and attaches their photos. */
export const LABELER_ROLE: TechnicianRole = 'LABELER';

/** Bulk-imported tools are named `component-001`, `component-002`, … */
export const PLACEHOLDER_NAME_PREFIX = 'component-';

export function isTechnicianRole(value: unknown): value is TechnicianRole {
  return typeof value === 'string' && (TECHNICIAN_ROLES as readonly string[]).includes(value);
}

export function isLabeler(role: string | null | undefined): boolean {
  return role === LABELER_ROLE;
}
