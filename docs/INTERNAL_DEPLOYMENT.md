# Running the Mubea Maintenance Inventory on a company server

**Audience:** Mubea IT (with Management for the hostname and certificate decision).
**Application:** Mubea Maintenance Inventory (the Technicien Dashboard) — tools inventory, barcode
labels, guided scanning, usage analysis and the buying guide.
**Today:** the application runs on Vercel and stores its data in a Supabase PostgreSQL database.
Both are outside the company network. This document is what is needed to run the same
application on a Mubea server, with no external dependency at runtime.

---

## 1. The request, ready to copy into an email

> Hello,
>
> I would like to install the **Mubea Maintenance Inventory** application (tools inventory,
> barcode scanning) on an internal Mubea server. The application is already in service on
> Vercel; this moves it inside the company network and removes the external hosting.
>
> To install it, we need:
>
> 1. A **Windows Server machine** that stays on, with a fixed name or IP address
>    (a shared workshop PC is enough — the application is small).
> 2. **Node.js 22 LTS (22.18 or newer) or 24 LTS**, installed with npm.
> 3. A **PostgreSQL 14 or newer** database — either an existing company instance or a local
>    installation on the same machine — plus one empty database and a user for it.
>    The current content is 11 MB (156 tools, 6 technicians, 434 movements).
> 4. An **internal hostname** for the application (for example `technicien.mubea.local`) and a
>    **TLS certificate** for it from the Mubea certificate authority.
>    HTTPS is mandatory for this application (section 3 explains why).
> 5. **IIS with ARR + URL Rewrite** (recommended) to publish that certificate and forward the
>    traffic to the application, which listens on `127.0.0.1:3000` only.
> 6. Authorisation to register the application as a **Windows service** so it starts with the
>    machine and restarts itself after a failure.
> 7. A **firewall rule** that allows the HTTPS port from the workshop network only — the
>    application must not be reachable from outside the company.
> 8. A **backup destination** (network share) for a nightly database dump, and the retention
>    you want (30 days is enough for this application).
> 9. Two answers: **(a)** is a one-time access to the npm registry allowed on the machine, or
>    should the deployment be prepared on another machine and copied over; **(b)** is Entra ID
>    sign-in expected later? Today the application uses personal access codes per technician.
>
> No internet access is required once installed. No Docker is required. No email service, no
> file server and no cloud subscription are involved.
>
> Best regards,
> Yassir AMRANI

---

## 2. What the application needs

| Component | Requirement | Why / notes |
|---|---|---|
| Operating system | Windows Server (Windows 10/11 also works) | Same family as the Portal's internal install; no Docker, so no Docker Desktop licence question |
| Runtime | Node.js **22.18+ LTS or 24 LTS** | Next.js 16 server. The portable runtime shipped with the original bundle can also be reused |
| Database | **PostgreSQL 14+**, one database, one user | Prisma ORM. 11 MB today; plan 5–10 GB of headroom |
| Memory | 300–500 MB for the application, plus the database engine | Measured footprint of the Node process is small |
| Disk | ~2 GB for the application folder (source + dependencies + build) + database + backups | `node_modules` is 736 MB, the production build 528 MB |
| Inbound port | 443 inside the company network (proxy) → `127.0.0.1:3000` (application) | The application never needs to be exposed directly |
| Internet | **Not needed at runtime** | No external calls, no web fonts, no CDN |
| Mail / SMS | Not used | The application does not send notifications |
| Attachments | Stored in the database (tool photos, when used) | No file share or object storage needed |
| Clients | Any browser (Edge, Chrome, Firefox) | Scanning uses the device camera, so workshop phones/tablets need a camera |

---

## 3. Why HTTPS is mandatory (three concrete reasons)

This is not a preference — the application is built for HTTPS end to end:

1. **The session cookie is `Secure`.** The cookie that keeps a technician signed in is issued
   with `HttpOnly; Secure; SameSite=Lax`. A browser **refuses to store or send a `Secure`
   cookie over plain HTTP**, so sign-in on `http://…` simply would not work.
2. **The application sends HSTS and `upgrade-insecure-requests`.** `next.config.ts` binds
   `Strict-Transport-Security` and a content-security policy that upgrades insecure requests.
   Serving it over HTTP contradicts its own headers.
3. **The barcode scanner needs the camera.** Browsers only allow camera access on a *secure
   context* (HTTPS, or `localhost`). On plain HTTP over the network, the scanning screen — the
   workshop's main tool — cannot open the camera at all.

If a certificate cannot be issued, the alternative is a small code change (issue the session
cookie without `Secure` and drop HSTS) and the application must then **never** leave the
intranet. That reduces the protection of the session cookie, so the certificate route is the
recommended one.

The certificate does not have to be public: a certificate from the Mubea internal authority for
an intranet name (`technicien.mubea.local`) is exactly what is needed, provided the workshop
devices trust that authority (they do, if they are on the domain).

---

## 4. Installation on Windows (no Docker)

Everything below runs on the server. Path used as an example: `C:\MubeaTechnicien`.

### 4.1 Install the runtime

Install Node.js 24 LTS (or 22.18+ LTS) with the official MSI, default options.

```powershell
node --version    # v24.x or v22.18+
npm --version
```

### 4.2 Copy the application

Copy the repository (without `node_modules` and `.next`) to `C:\MubeaTechnicien`, or clone it
with Git if Git is available on the machine.

### 4.3 Create the configuration file

Create `C:\MubeaTechnicien\.env` (this file is never committed to Git). A template is provided
in the repository as `.env.example`:

```ini
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE"
MUBEA_SESSION_SECRET="<at least 32 random characters>"
MUBEA_TECHNICIAN_CODES={"ADMIN-001":"scrypt$16384$8$1$...","1042":"scrypt$..."}
MUBEA_ACCESS_CODE_HASH=""
```

| Variable | Meaning |
|---|---|
| `DATABASE_URL` | The PostgreSQL connection string used by the application |
| `DIRECT_URL` | The same connection string is fine on a local database (on Supabase it points at the non-pooled connection) |
| `MUBEA_SESSION_SECRET` | Signs the session cookie; **32 characters minimum** or nobody can sign in. Generate with: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `MUBEA_TECHNICIAN_CODES` | Personal access codes per technician ID number, hashed with scrypt. The workshop's manager account needs its own personal code; the shared code below cannot open an administrator profile |
| `MUBEA_ACCESS_CODE_HASH` | Optional shared workshop code (hashed). Leave empty if every technician has a personal code |

**Important:** inside `.env`, every `$` of a scrypt hash must be escaped as `\$`, otherwise the
value is silently truncated and no code can ever match. Create the codes with
`node --env-file=.env scripts/create-admin.mjs "ADMIN" "ADMIN-001" "the chosen code"`; the
script prints the exact line to paste.

### 4.4 Install dependencies and prepare the database

```powershell
cd C:\MubeaTechnicien
npm ci                                  # installs exactly what package-lock.json pins
npx prisma db push                      # creates the tables in the empty database
npm run build                           # production build
```

If the machine has no access to the npm registry, run these three commands on a machine that
does (same Windows version), then copy the whole folder — including `node_modules` and
`.next` — to the server. Behind the Mubea TLS-inspection proxy, Node also needs the corporate
roots: export them once and set `NODE_EXTRA_CA_CERTS` in the same terminal.

### 4.5 Register the application as a Windows service

Use [NSSM](https://nssm.cc) (free, public domain), so the application starts with the machine
and restarts itself after a crash:

```powershell
nssm install MubeaTechnicien "C:\Program Files\nodejs\node.exe" "C:\MubeaTechnicien\node_modules\next\dist\bin\next" start -H 127.0.0.1 -p 3000
nssm set MubeaTechnicien AppDirectory C:\MubeaTechnicien
nssm set MubeaTechnicien AppStdout C:\MubeaTechnicien\logs\app.log
nssm set MubeaTechnicien AppStderr C:\MubeaTechnicien\logs\app.err.log
nssm set MubeaTechnicien AppRotateFiles 1
nssm set MubeaTechnicien Start SERVICE_AUTO_START
nssm set MubeaTechnicien AppExit Default Restart
nssm start MubeaTechnicien
```

The application only listens on `127.0.0.1:3000`; nothing on the network can reach it directly.

### 4.6 Publish HTTPS through IIS

1. Install **Application Request Routing (ARR)** and **URL Rewrite** in IIS.
2. Import the certificate for `technicien.mubea.local` and bind it to a new IIS site (port 443).
3. Point that site at `C:\MubeaTechnicien` as its physical path and add this `web.config`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="Proxy to the inventory application" stopProcessing="true">
          <match url="(.*)" />
          <action type="Rewrite" url="http://127.0.0.1:3000/{R:1}" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

4. In ARR, enable the proxy and (optionally) disable reverse-rewrite of the host header.
5. A self-issued certificate also works technically, but every workshop device would then have
   to trust it — the internal authority avoids that.

### 4.7 Firewall

Allow inbound **443** from the workshop network only. Nothing else needs to be opened; the
database port stays local to the machine.

---

## 5. Moving the current data

The application currently writes to Supabase. One short cut-over is enough:

```powershell
# On a machine with PostgreSQL client tools:
pg_dump "postgresql://…supabase direct connection…" --no-owner --no-privileges --format=custom --file=mubea_inventory.dump
pg_restore --no-owner --no-privileges --dbname "postgresql://…company server…" mubea_inventory.dump
```

- Use the **direct** connection string (Supabase dashboard → Connect), not the transaction
  pooler, for the dump.
- If the tables already exist on the target (`prisma db push` was run), restore with
  `--data-only` instead.
- Verification counts: **156 tools, 6 technicians, 434 movements**, database 11 MB.
- The printed labels stay valid: each QR code encodes the tool code (for example `MUB-001`),
  not a web address, so nothing has to be reprinted.
- Keep the Vercel + Supabase deployment untouched until the internal instance has been verified;
  agree a short window (end of shift) for the final dump and cut-over.

---

## 6. Verification checklist before declaring the move done

1. `https://technicien.mubea.local` opens from a workshop PC and shows the sign-in page.
2. A technician signs in with a personal code; the dashboard shows 156 tools and the overdue list.
3. The scanner opens the camera **from a phone or tablet** over HTTPS and records a return
   (test on the real device, not on the server).
4. Label printing works on the workshop printer.
5. A CSV/Excel export opens with the expected rows.
6. The server is restarted: the service starts by itself and the site answers.
7. The nightly backup job produces a dump, and one restore into a scratch database returns the
   same counts (156 / 6 / 434).
8. The administrator profile can create a technician and a label, and a deactivated profile can
   no longer sign in.

---

## 7. Rollback

Nothing in this move is destructive: the Supabase database is only read. If the internal
instance shows a problem, point the workshop back at the Vercel address (and stop the internal
service) until it is fixed; the two can run in parallel during the verification period, but the
workshop must use only one of them at a time, otherwise movements are split between two
databases.

---

## 8. Questions for IT to answer

| # | Question | Default if no answer |
|---|---|---|
| 1 | Which machine, and which fixed name or IP? | A workshop PC that stays on |
| 2 | Does a company PostgreSQL instance exist, or should we install one locally? | Local installation on the same machine |
| 3 | Can a certificate be issued for the intranet name? | A locally issued certificate, pushed to workshop devices |
| 4 | Who owns the service account and the nightly backup job? | IT, with the developer providing the command |
| 5 | Is Entra ID / SSO expected later? | Not needed: personal access codes today; SSO is a separate phase |
| 6 | When is the cut-over window? | End of shift, when no tool is being scanned |

---

## 9. Licences and cost

| Item | Licence | Cost |
|---|---|---|
| Node.js | MIT | Free |
| PostgreSQL | PostgreSQL licence | Free |
| NSSM | Public domain | Free |
| IIS / ARR / URL Rewrite | Included with Windows Server | Covered by the server licence |
| Docker | *Not used* | Avoids the Docker Desktop licence threshold entirely |

Total additional cost: **none**, beyond the machine the company already owns.
