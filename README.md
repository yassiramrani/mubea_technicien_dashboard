# Mubea Maintenance Inventory

Tools inventory dashboard built with Next.js, TypeScript, and Prisma.

The project is organized as a web application with QR-code tooling and a Vercel-ready deployment setup.

## Development

```bash
npm install
npm run dev
```

Build the production bundle with `npm run build`.

## Inventory search and return follow-up

- Search tools by name, label code, technician name or ID. Search ignores accents and combines words.
- Filter by availability, assignment, overdue status and label printing status. Sort by name, oldest checkout or usage count.
- Browse 25, 50 or 100 tools per page. Select-all applies to the current page; changing search or filters clears the selection. The selection count includes other pages.
- Export results includes all matching tools across pages, with their assignment, checkout date and overdue status.
- The overview starts with overdue returns, sorted by checkout time. Search by tool or technician, switch to all assigned tools, or export the follow-up list.
- Use the scanner to record a return. Refresh the overview to load the latest assignments. Checkout dates use the workshop’s Casablanca timezone.
- Label printing, adding tools and Pareto analysis remain available in expandable sections on the inventory page.

Run `npm test` for inventory filtering and sorting checks (Node.js 22.18+ or 24+).

## Profiles

Signing in takes a profile and its access code. The profile decides what the session may do.

| Profile | What it is for |
| --- | --- |
| `TECHNICIAN` | Takes and returns tools with the scanner. |
| `LABELER` | Identification only: renames tools and attaches their photos. A scan never records a movement. |
| `ADMIN` | The manager profile. Reaches every section — dashboard, Pareto analysis, technician and tool management, scanner and reports — and is the only profile allowed to grant or remove `ADMIN`. |

### Creating the administrator profile

The same script creates the profile and generates its code:

```bash
node --env-file=.env scripts/create-admin.mjs                  # name ADMIN, ID number ADMIN-001
node --env-file=.env scripts/create-admin.mjs "ADMIN" "ADMIN-001" "the chosen code"
```

It prints the profile it created, the code, and the single line to paste into `.env.local`:

```
MUBEA_TECHNICIAN_CODES={"ADMIN-001":"scrypt\$16384\$8\$1\$…"}
```

> **The dollar signs must be escaped with a backslash.** A code is a `scrypt$N$r$p$salt$hash`
> value, and the environment loader reads an unescaped `$…` as a reference to another variable
> and strips it — the hash then loads as `scrypt6384…` and no code can ever match. Quoting the
> value does not help; only the `\` does. This applies to `MUBEA_ACCESS_CODE_HASH` too, and to
> every deployment environment (Vercel, etc.), not just a local file.

Restart the application afterwards: the environment is read at startup.

The profile can also be created from the **Technicians** page, with the **Administrator**
profile.

### Who may manage profiles

Only an administrator may add a profile or change one — including changing anybody's role. This
holds whatever `ENFORCE_ROLE_ACCESS` is set to: it is a rule about a single action, not about
reaching a page. On the **Technicians** page every other profile sees the list read-only.

One exception, deliberately narrow and only for *creating*: while a deployment has no
administrator at all, the first one may be created, otherwise it could never acquire one. It
closes by itself as soon as the first administrator exists.

An administrator needs a personal code: the shared workshop code (`MUBEA_ACCESS_CODE_HASH`) is
deliberately refused for it, because it is a code the whole floor knows and accepting it would
let anyone sign in as the manager.

### Restricting the other profiles

`src/lib/permissions.ts` holds `ENFORCE_ROLE_ACCESS`, `false` today: every signed-in profile reaches
every section, so the administrator profile adds access without taking any away.

Setting it to `true` serves each section only to the profiles listed in `ROLE_SECTIONS` beside it —
administrators everywhere, technicians and identification profiles on the scanner. The guard is
already wired into `/api/stats`, `/api/logs`, `/api/technicians` and `/api/tools`; the pages keep
rendering and simply show no data, because they read those endpoints.
