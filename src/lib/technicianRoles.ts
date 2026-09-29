// Profiles.
//
// A profile is a record whose role decides what the signed-in person may do. The session only
// carries the identifier of that record; the role is read from the database on every request,
// so changing a profile applies at once instead of at the next sign-in.
//
//   TECHNICIAN - takes and returns tools with the scanner;
//   LABELER    - identification only: renames tools and attaches their photos;
//   ADMIN      - the manager profile: reaches every section, and is the only profile allowed
//                to hand the ADMIN role to somebody else.
export const TECHNICIAN_ROLES = ['TECHNICIAN', 'LABELER', 'ADMIN'] as const;

export type TechnicianRole = (typeof TECHNICIAN_ROLES)[number];

export const DEFAULT_TECHNICIAN_ROLE: TechnicianRole = 'TECHNICIAN';

/** Identification-only profile: renames tools and attaches their photos. */
export const LABELER_ROLE: TechnicianRole = 'LABELER';

/** Manager profile: full access to every section. */
export const ADMIN_ROLE: TechnicianRole = 'ADMIN';

/** Bulk-imported tools are named `component-001`, `component-002`, … */
export const PLACEHOLDER_NAME_PREFIX = 'component-';

/** Dictionary keys naming each profile inside a menu. */
export const ROLE_LABEL_KEY = {
  TECHNICIAN: 'roleTechnician',
  LABELER: 'roleLabeler',
  ADMIN: 'roleAdmin',
} as const;

/** Dictionary keys naming each profile on a badge. */
export const ROLE_SHORT_LABEL_KEY = {
  TECHNICIAN: 'roleTechnicianShort',
  LABELER: 'roleLabelerShort',
  ADMIN: 'roleAdminShort',
} as const;

export function isTechnicianRole(value: unknown): value is TechnicianRole {
  return typeof value === 'string' && (TECHNICIAN_ROLES as readonly string[]).includes(value);
}

/**
 * Turns whatever the database holds into one of the known profiles. Without it, an unknown
 * value would silently be treated as "not a labeler", which is a decision nobody made.
 */
export function normalizeTechnicianRole(value: unknown): TechnicianRole {
  return isTechnicianRole(value) ? value : DEFAULT_TECHNICIAN_ROLE;
}

export function isLabeler(role: string | null | undefined): boolean {
  return role === LABELER_ROLE;
}

export function isAdmin(role: string | null | undefined): boolean {
  return role === ADMIN_ROLE;
}
