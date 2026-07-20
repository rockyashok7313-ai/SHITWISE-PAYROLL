# ShiftWise Payroll & Attendance

## Core Features
- **Hybrid Shift Dashboard** — Toggle between 12-hour and 9-hour shift presets for quick daily attendance logging and status tracking, with an operations overview showing recent verified shift history and live payout calculations.
- **Bulk Attendance Entry** — Mass-log attendance for an entire team by month/year, with per-entry editing, CSV export, and automatic recalculation of gross pay, incentives, advances, and loan deductions.
- **Precision Salary Calculator** — Automatic calculation of time-based earnings from shift duration × hourly rate, plus incentives, minus weekly advances and loan deductions, denominated in INR.
- **AI Payroll Audit Assistant** — On-demand AI analysis (Gemini, via a server-side Supabase Edge Function) of real attendance history to flag unusual shift patterns, potential payroll discrepancies with rupee estimates, and a forward labor-cost forecast. Runs against the signed-in user's actual employee/attendance data — not sample data.
- **Employee Profile Hub** — Manage individual employee records: name, role, gender, default shift type, hourly rate, mobile number, and bank details (bank name, account number, IFSC code) for payroll disbursement, with photo upload.
- **Multi-Company Support** — A single account can manage multiple factory units/companies, each with independent employees, attendance, and configuration, switchable from the sidebar.
- **Daily Logs & Reporting** — Monthly/yearly payroll reports per employee with Paid/Unpaid status tracking, CSV and Excel (.xlsx) export, and printable salary slips.
- **Offline-Resilient Sync** — Cloud (Supabase) is the source of truth; the browser keeps a local read-only cache so the dashboard still loads recent data if the network drops, without risking silently overwriting newer cloud data.
- **Auto-Backup** — A daily local JSON export of all cached company/employee/attendance data as an extra safety net, separate from the cloud database.

## User Roles & Access
Single role today: any authenticated user is a full admin over the companies they own. Ready to extend with row-scoped roles (e.g. read-only "accountant" or "supervisor" logins) later since ownership is already modeled at the database level.

## Tech Stack & Architecture
- **Frontend**: Next.js 15 (App Router), React 19, TypeScript (strict, no error suppression), Tailwind CSS + shadcn/ui component library, Radix primitives, Recharts, react-hook-form + zod.
- **Hosting model**: Static export (output: 'export') — no Node.js server required at runtime, deployable to any static host (Firebase Hosting, Vercel static, Cloudflare Pages, S3+CDN, etc.).
- **Database & Auth**: Supabase (Postgres + Supabase Auth, email/password). Client talks to Supabase directly from the browser via the anon key, protected entirely by Row Level Security — there is no custom backend API layer for CRUD.
- **AI**: Google Gemini (gemini-2.5-flash), called from a Supabase Edge Function (Deno) so the API key never reaches the browser. The client invokes it via supabase.functions.invoke(), which is automatically authenticated with the caller's session.
- **State**: Component-level React state, synced to Supabase on every mutating action; localStorage used only as an offline read cache and for UI preferences (active company, last backup date).

## Data Model
- **companies**: `id` (text, pk), `owner_id` (uuid, fk -> auth.users) -- ownership boundary for RLS, `name`, `unit`, `standard_shift_hours`, `factory_shift_hours`, `default_incentive`, `currency`, `financial_year`
- **employees**: `id` (text, pk), `company_id` (fk -> companies), `name`, `role`, `gender`, `shift`, `rate`, `status`, `mobile`, `bank_name`, `account_number`, `ifsc_code`, `photo_url`
- **attendance**: `id` (text, pk), `company_id` (fk -> companies), `employee_id` (fk -> employees), `date`, `shift`, `hours`, `rate`, `incentive`, `weekly_advance`, `loan`, `is_modified`

*Full schema with indexes: `supabase_schema.sql`. Migration path for an already-populated database: `supabase_migration_ownership.sql`.*

## Security Model
- **Row Level Security everywhere**. Every table's policies resolve back to `companies.owner_id = auth.uid()`, so a signed-in user can only ever see or modify data belonging to companies they created — including via self-signup. This is enforced at the database layer, not in application code, so it holds even if a client bug tried to query another tenant's data.
- **No secrets in source**. Supabase URL/anon key come from environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`); the Gemini API key lives only as a Supabase Edge Function secret, never bundled into client code.
- **Auth guard**: client-side session check on load, redirecting unauthenticated users to `/login`; combined with RLS as the actual data-access boundary (the UI guard is a UX convenience, not the security boundary).

## Style Guidelines
- **Primary color**: Electric Cobalt #6082F2 — digital precision, technical reliability.
- **Background**: Deep Ink Slate #0F1115 — high-contrast dark mode, premium dashboard feel.
- **Accent color**: Bright Cyan #00E5FF — success indicators, active shift status, financial highlights.
- **Headline font**: Space Grotesk (geometric sans-serif, machined/scientific feel). Body font: Inter (readability for dense financial tables).
- **Iconography**: Minimalist, stroke-based icons (lucide-react) with subtle rounded edges.
- **Layout**: Dense, modular grid focused on table views and data density — payroll managers should see high-level stats without excessive scrolling.
- **Motion**: Swift, linear transitions on data updates — emphasize speed and immediate feedback on shift-type toggles and rate changes.
- **Currency formatting**: INR throughout, ₹ symbol, en-IN locale grouping (e.g. ₹1,42,000).

## Current Status
Functionally complete for single-team/small-factory use with real multi-tenant data isolation, real (non-mocked) AI auditing, and a clean production build (npm run typecheck, npm run lint, npm run build all pass with no error suppression).

## Known Limitations / Roadmap
- Single flat "admin" role per company — no read-only or supervisor-level accounts yet.
- No clock-in/out timestamp capture — attendance is logged as total hours per shift, not punch times, which limits how precise the AI audit's "unusual pattern" detection can be.
- No automated tests (unit/e2e) yet — verification currently relies on typecheck/lint/build passing plus manual QA.
- No audit log of who changed what — worth adding if this will have multiple logins per company (e.g. owner + accountant).
