# Fair Savings

**Family Weekly Savings & Loan Management System**

A premium, fintech-style dashboard for running a community weekly-savings and loan
group — inspired by Razorpay, Groww, Notion, PhonePe Business, and Apple's design
language. Built with Next.js 15, TypeScript, Tailwind, Express, Prisma, and
PostgreSQL. Bilingual (English / ಕನ್ನಡ), dark & light mode, glassmorphism UI.

> **Deploying without a local setup?** See [`DEPLOYMENT.md`](./DEPLOYMENT.md) —
> push through the GitHub website, use a free hosted Postgres (Neon), and deploy
> the backend to Railway and frontend to Vercel, all with auto-deploy on commit.
> The instructions below are for running it on your own machine instead.

---

## 1. What's included

**Backend** (`/backend`) — Express + TypeScript + Prisma + PostgreSQL
- JWT auth for two roles: Admin and Member (members never self-register)
- Full member CRUD: create (auto-generates `KD001`, `KD002`…), edit, deactivate,
  reset password, QR card generation
- **Family linking**: one payer can be linked to many children; each child keeps a
  fully separate savings/loan/fine/transaction record
- **Batch family payment**: `POST /api/collections/pay-family` lets an admin pay for
  several linked children in a single request/screen
- 52-week savings cycle tracking, settlement marking
- Loan engine: issue loan → simple-interest total + EMI schedule, EMI payments,
  automatic 1% missed-EMI penalty, loan renewal with fresh interest on the
  outstanding balance
- Append-only transactions ledger (nothing is ever deleted)
- Notifications (single + broadcast), Settings, Audit log
- Reports: PDF member statement (PDFKit), Excel collection report (ExcelJS)
- Prisma schema with all 13 tables from the spec + seed script with a demo
  family (Mahadev Mang → Darshan, Bhavya, Omkar) matching the product brief

**Frontend** (`/frontend`) — Next.js 15 App Router + TypeScript + Tailwind
- Split-screen glassmorphic login (role auto-detected from credentials)
- Admin dashboard: 8 summary cards + weekly collection / savings growth / loan
  status charts (Recharts)
- Members page: search, add (with generated credentials modal), deactivate,
  reset password, delete
- **Family batch payment screen**: pick a payer, tick which linked children are
  paying this week, edit amounts per child, submit as one collection
- Loans, Penalties, Transactions, Reports, Notifications, Settings pages
- Member self-service dashboard: savings progress bar, loan balance, fines,
  PDF statement download
- Full English/Kannada translation via a lightweight dictionary + context
  (no external i18n library needed) and dark/light theme, both persisted in cookies

## 2. What's scaffolded vs. stubbed

This is a complete, runnable full-stack foundation — not every leaf feature in the
spec has a finished UI. Fully working end-to-end: auth, members, family linking,
batch weekly collection, loan issue/EMI/penalty/renewal, dashboard analytics,
notifications, settings, PDF/Excel export for statements & collections. Marked as
"coming soon" in the UI (but easy to extend using the existing patterns): Savings
Report / Loan Report / Yearly Report PDFs, photo upload storage (S3/Cloudinary),
scheduled Friday reminder + missed-EMI cron jobs (the API endpoints to trigger
them already exist — `apply-missed-penalty`, `notifications/broadcast` — you just
need a scheduler, e.g. `node-cron` or a hosted cron hitting those routes weekly).

## 3. Project structure

```
fair-savings/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # all 13 tables
│   │   └── seed.ts             # sample admin + demo family + sample loan
│   ├── src/
│   │   ├── config/prisma.ts
│   │   ├── middleware/         # auth, role guards, error handler
│   │   ├── routes/             # auth, members, family, collections, loans,
│   │   │                       # transactions, notifications, settings,
│   │   │                       # dashboard, reports
│   │   ├── utils/              # jwt/password helpers, finance calculations
│   │   ├── app.ts
│   │   └── server.ts
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── login/
    │   │   ├── admin/          # dashboard, members, collections, loans,
    │   │   │                   # penalties, reports, notifications,
    │   │   │                   # transactions, settings
    │   │   └── member/         # dashboard, loans, notifications
    │   ├── components/         # Sidebar, Navbar, StatCard, AuthGuard
    │   ├── contexts/           # Auth, Theme
    │   ├── i18n/                # EN/KN dictionaries + LanguageContext
    │   └── lib/api.ts          # axios client with JWT injection
    ├── .env.example
    └── package.json
```

## 4. Installation

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ (local install, or a hosted instance like Neon/Supabase/Railway)

### Backend

```bash
cd backend
cp .env.example .env
# edit .env: set DATABASE_URL to your Postgres connection string, and JWT_SECRET

npm install
npx prisma migrate dev --name init   # creates all tables
npm run prisma:seed                  # creates admin + demo family + sample loan
npm run dev                          # starts API on http://localhost:5000
```

Seed output prints the admin login. Defaults (override via `.env`):
- Admin: `admin` / `Admin@123`
- Demo members: `KD001` (Mahadev Mang, payer) / `KD002`–`KD004` (children) — all
  use password `Member@123`

### Frontend

```bash
cd frontend
cp .env.example .env.local
# edit .env.local: set NEXT_PUBLIC_API_URL to your backend URL (default http://localhost:5000/api)

npm install
npm run dev     # starts app on http://localhost:3000
```

Open `http://localhost:3000`, sign in as admin or as a demo member.

### Production build

```bash
# backend
npm run build && npm start

# frontend
npm run build && npm start
```

## 5. Environment variables

**backend/.env**
| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Long random string for signing tokens |
| `JWT_EXPIRES_IN` | Token lifetime, default `7d` |
| `PORT` | API port, default `5000` |
| `CORS_ORIGIN` | Frontend origin allowed to call the API |
| `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` | Used only by `prisma:seed` |

**frontend/.env.local**
| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL of the backend API, e.g. `http://localhost:5000/api` |

## 6. Key design decisions

- **Simple interest loans**: `totalRepayment = principal × (1 + rate/100)`,
  `weeklyEmi = totalRepayment / durationWeeks` — matches the spec's worked example
  (₹10,000 @ 10% / 11 weeks → ₹11,000 total, ₹1,000/week).
- **Missed EMI penalty**: 1% of the missed EMI amount, configurable in Settings.
- **Loan renewal**: outstanding balance becomes the new principal, fresh interest
  applied, EMI schedule restarts; the original loan is marked `RENEWED` and linked
  via `parentLoanId`.
- **Family payments**: `FamilyRelationship` is one-child-to-one-payer (a child has
  exactly one payer; a payer can have many children). Each child still has its own
  `Savings`, `Loan`, `Penalty`, `Transaction` rows — the payer is only recorded as
  `collectedBy` on the `WeeklyCollection` row.
- **Transactions are append-only** — no update/delete routes are exposed, per the
  spec's "nothing should ever be deleted."

## 7. Extending this further

- Add `node-cron` (or a hosted cron job) to call `POST /loans/:id/apply-missed-penalty`
  weekly for loans with an overdue EMI, and `POST /notifications/broadcast` every
  Thursday for the Friday collection reminder.
- Wire `uploadPhoto` to S3/Cloudinary and store the URL on `Member.photoUrl`.
- Add the remaining report types by copying the pattern in
  `backend/src/routes/reports.routes.ts`.
