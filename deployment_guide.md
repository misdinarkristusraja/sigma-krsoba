# SIGMA — Deployment Guide

**Sistem Informasi Penjadwalan & Manajemen Misdinar**  
Paroki Kristus Raja Solo Baru

---

## Stack

| Layer | Service |
|-------|---------|
| Frontend | React 18 + Vite → Vercel |
| Database | Supabase (PostgreSQL + Auth + RLS + Storage) |
| Edge Functions | Supabase Functions (Deno) |
| CI/CD | Vercel Git integration |

---

## Prerequisites

- Node.js ≥ 18
- Supabase CLI (`npm i -g supabase`)
- Vercel CLI (`npm i -g vercel`) — optional, Git deploy works without it
- Git access to this repo

---

## 1. Supabase Setup

### 1a. Create project

1. Go to [supabase.com](https://supabase.com) → New project
2. Note **Project URL** and **anon key** (Project Settings → API)
3. Note **service_role key** (keep secret — only for Edge Functions)

### 1b. Run migrations

Run in order in **SQL Editor** (Supabase Dashboard → SQL Editor):

```
supabase/migrations/00000000000000_init.sql
supabase/migrations/00000000000001_rls_security_hardening.sql
```

Both are idempotent — safe to re-run.

Alternatively via CLI:

```bash
supabase db push
```

### 1c. Deploy Edge Functions

```bash
supabase functions deploy admin-reset-password
supabase functions deploy cron-rekap
supabase functions deploy fetch-gcatholic
supabase functions deploy supabase-ping
```

### 1d. Set Edge Function secrets

In **Supabase Dashboard → Settings → Edge Functions → Secrets**, add:

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | Your project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (never anon key) |

### 1e. Storage buckets

Create these buckets in **Storage**:

| Bucket | Public | Purpose |
|--------|--------|---------|
| `surat` | No | Upload surat pernyataan (PDF) |
| `foto` | No | Foto profil anggota |

---

## 2. Environment Variables

### For local development

Create `.env.local` in project root:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
VITE_APP_URL=http://localhost:5173
VITE_MYID_SALT=your-custom-salt-here
```

> `.env.local` is gitignored — never commit it.

### For Vercel (production / preview)

**Vercel Dashboard → Project → Settings → Environment Variables:**

| Variable | Environment | Value |
|----------|-------------|-------|
| `VITE_SUPABASE_URL` | Production, Preview, Development | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Production, Preview, Development | Supabase anon key |
| `VITE_APP_URL` | Production | `https://sigma-kr.vercel.app` |
| `VITE_MYID_SALT` | Production, Preview, Development | Random string (e.g. `sigma-krsoba-2025`) |

After adding variables → **Redeploy** the project.

---

## 3. Vercel Deployment

### Option A: Git integration (recommended)

1. Import repo in Vercel
2. Framework: **Vite** (auto-detected)
3. Build command: `npm run build`
4. Output directory: `dist`
5. Add env vars (section 2 above)
6. Deploy → every push to `main` auto-deploys

### Option B: Manual deploy via CLI

```bash
npm run build
vercel --prod
```

### SPA routing

`vercel.json` already configures catch-all rewrite to `index.html` — no extra setup needed.

### Security headers

`vercel.json` sets:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `CSP` (restricts to `*.supabase.co`)
- `Permissions-Policy: camera=(self)` (for QR scanner)
- 1-year cache on `/assets/*` (hashed filenames)

---

## 4. Post-Deploy Checklist

- [ ] Login page loads at `/login`
- [ ] Register at `/daftar` — submit form, check pending in Supabase `registrations` table
- [ ] Admin can approve registration (runs `admin_approve_registration` RPC)
- [ ] QR scan page accessible for Pelatih/Pengurus role
- [ ] `admin-reset-password` Edge Function reachable — test via AdminPage → Mass Reset
- [ ] Supabase Realtime enabled for `notifications` table (Dashboard → Realtime)

---

## 5. Supabase Auth Configuration

**Dashboard → Authentication → Settings:**

| Setting | Value |
|---------|-------|
| Email confirmations | **Disabled** (admin-managed accounts) |
| Site URL | Your Vercel domain |
| Redirect URLs | `https://sigma-kr.vercel.app/**` |
| JWT expiry | 3600 (1 hour) recommended |

---

## 6. First Admin Account

After running migration, create the first admin manually:

```sql
-- 1. Create auth user (replace values)
SELECT extensions.pgcrypto.crypt('temp-password-here', extensions.pgcrypto.gen_salt('bf'));

-- Or use Supabase Dashboard → Authentication → Users → Invite user
```

Then in SQL Editor:

```sql
-- 2. Insert into public.users
INSERT INTO public.users (
  id, nickname, myid, nama_lengkap, nama_panggilan,
  role, status, email
) VALUES (
  '<uuid from auth.users>',
  'admin',
  'ADMIN00001',
  'Nama Admin Lengkap',
  'Admin',
  'Administrator',
  'Active',
  'admin@email.com'
);
```

---

## 7. Realtime Setup

Enable Realtime for the `notifications` table:

**Dashboard → Database → Replication → 0 Tables → Add `notifications`**

This powers the notification bell (`NotificationBell.tsx`).

---

## 8. Cron Jobs (optional)

The `cron-rekap` Edge Function recalculates streaks. Schedule via:

```sql
-- Supabase cron via pg_cron extension (if enabled)
SELECT cron.schedule(
  'rekap-mingguan',
  '0 1 * * 1',  -- Every Monday 01:00 UTC
  $$SELECT net.http_post(
    url := 'https://<project>.supabase.co/functions/v1/cron-rekap',
    headers := '{"Authorization": "Bearer <service_role_key>"}'::jsonb
  )$$
);
```

---

## 9. Local Development

```bash
npm install
# Create .env.local (see section 2)
npm run dev
```

App runs at `http://localhost:5173`.

TypeScript check:

```bash
npx tsc --noEmit
```

Build check:

```bash
npm run build
```

---

## 10. Rollback

### Frontend rollback
Vercel Dashboard → Deployments → click previous deployment → **Promote to Production**

### Database rollback
Migrations are additive. To undo `00000000000001_rls_security_hardening.sql`:

```sql
-- Drop policies added by hardening migration
DROP POLICY IF EXISTS users_select_public ON users;
DROP POLICY IF EXISTS users_update_self_restricted ON users;
DROP POLICY IF EXISTS scan_read_self ON scan_records;
DROP POLICY IF EXISTS notif_staff_insert ON notifications;
DROP POLICY IF EXISTS rl_deny_direct ON ratelimit_login_attempts;
DROP VIEW IF EXISTS users_public;
DROP TABLE IF EXISTS ratelimit_login_attempts;
DROP FUNCTION IF EXISTS trg_users_no_self_promote();
DROP FUNCTION IF EXISTS trg_swap_no_self_approve();
-- Re-apply original policies from 00000000000000_init.sql as needed
```

---

## 11. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Blank screen after deploy | Stale service worker (PWA) | Hard refresh `Ctrl+Shift+R` or clear site data |
| `❌ ENV vars belum diset` on startup | Missing Vercel env vars | Add vars in Vercel → Redeploy |
| `User not allowed` on password change | RPC `change_my_password` missing | Run migration `00000000000000_init.sql` |
| Mass Reset: `401 Unauthorized` | Edge Function not deployed or bad secret | `supabase functions deploy admin-reset-password`, check `SUPABASE_SERVICE_ROLE_KEY` secret |
| QR scan: camera blocked | HTTPS required for `getUserMedia` | Deploy is HTTPS ✓; localhost also works |
| `RATE_LIMIT` on login | >10 login attempts/minute from same IP hash | Wait 1 minute, or clear `ratelimit_login_attempts` table |
| Realtime not working | Table not enabled for replication | Dashboard → Database → Replication → enable `notifications` |

---

## 12. Key URLs (after deploy)

| Path | Description |
|------|-------------|
| `/login` | Login page |
| `/daftar` | Self-registration |
| `/dashboard` | Main app (authenticated) |
| `/scan` | QR scan (Pelatih/Pengurus only) |
| `/admin` | Admin panel (Administrator only) |
| `/public` | Public schedule (no auth) |

---

---

## 13. Deployed Project Info

| Item | Value |
|------|-------|
| Vercel URL | https://sigma-kr.vercel.app |
| Supabase project | `vxwvlfbjcgwwhpxggedi` (sigmakr-db, ap-southeast-2) |
| Vercel project | `misdinarkristusrajas-projects/sigma-kr` |

### Manual step required — admin functions (SET ROLE)

The 3 functions that write to `auth.*` could not be deployed via CLI (Supabase API blocks `SET ROLE`).
Run `supabase/manual_setrole_functions.sql` manually in **Supabase Dashboard → SQL Editor**:

- `admin_reset_password(UUID, TEXT)` — password reset for 1 user
- `admin_provision_all()` — mass password provision
- `admin_approve_registration(UUID, VARCHAR, TEXT)` — approve pending registration

Without this step, AdminPage → Reset Password and registration approval will fail.

---

*Last updated: 2026-05-20*

NOTE:
Dashboard Aksi Cepat — "Video Tutorial" button dengan href="#". Nanti tinggal ganti # di DashboardPage.tsx:397 dengan URL YouTube-nya