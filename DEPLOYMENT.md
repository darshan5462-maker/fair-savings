# Deploying Fair Savings — No Local Setup Required

This guide skips `localhost` entirely. Everything runs on free hosted services,
and you push code through the GitHub website — no git terminal commands needed.

You'll use 3 services, all free to start:
1. **Neon** — hosted PostgreSQL database
2. **Render** — runs the backend API
3. **Vercel** — runs the frontend website

---

## Step 1 — Put the project on GitHub (web only)

1. Go to [github.com/new](https://github.com/new) and create a new **empty** repository
   (don't check "add README") — e.g. name it `fair-savings`.
2. On the new repo's page, click **"uploading an existing file"**.
3. Unzip `fair-savings.zip` on your computer. Open the `fair-savings` folder so
   you see the `backend` and `frontend` folders directly inside it.
4. Drag **both** the `backend` folder and `frontend` folder (and `README.md`)
   straight into the GitHub upload box in your browser. Chrome/Edge support
   dragging whole folders — GitHub will preserve the folder structure.
5. Scroll down, write a commit message like "Initial commit", and click
   **"Commit changes"**.

Your repo now has `backend/`, `frontend/`, and `README.md` at the root — that
layout matters for Steps 3 and 4 below.

> Anytime you want to update the live site later, just open the file in GitHub's
> web editor (the pencil icon), edit it, and commit — Railway and Vercel will
> automatically redeploy.

---

## Step 2 — Create the database (Neon)

1. Go to [neon.tech](https://neon.tech) and sign up (GitHub login works).
2. Click **Create a project**. Name it `fair-savings`, keep default region/Postgres version.
3. Once created, go to the **Dashboard** → **Connection Details**.
4. Copy the connection string that looks like:
   ```
   postgresql://neondb_owner:xxxxx@ep-something-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
   Save this somewhere — you'll paste it into Railway in Step 3 as `DATABASE_URL`.

(Supabase or Railway's own Postgres add-on both also work if you prefer — any
managed PostgreSQL gives you the same kind of connection string.)

---

## Step 3 — Deploy the backend (Render)

1. Go to [render.com](https://render.com) and sign up with GitHub.
2. Click **New +** → **Web Service** → connect your `fair-savings` repo.
3. Configure it:
   | Field | Value |
   |---|---|
   | Root Directory | `backend` |
   | Environment | `Node` |
   | Build Command | `npm install && npm run build` |
   | Start Command | `npm start` |
   | Instance Type | Free |
4. Scroll to **Environment Variables** and add:
   | Key | Value |
   |---|---|
   | `DATABASE_URL` | the Neon connection string from Step 2 |
   | `JWT_SECRET` | any long random string, e.g. `f8a92c...` (mash your keyboard) |
   | `JWT_EXPIRES_IN` | `7d` |
   | `NODE_ENV` | `production` |
   | `CORS_ORIGIN` | leave blank for now — you'll fill this in after Step 4 |
5. Click **Create Web Service**. Render runs the build, then `npm start`, which
   runs `prisma migrate deploy` before booting — your database tables get
   created automatically on first deploy.
6. Once deployed, your service gets a URL like
   `https://fair-savings-backend.onrender.com`. This is your API base — the
   frontend will call `<that-url>/api`.

### Seed the demo admin + demo family
Render's free tier doesn't include shell access, so seed over HTTP instead:

1. On your Render service → **Environment**, add one more variable:
   | Key | Value |
   |---|---|
   | `SEED_SECRET` | any random string, e.g. `seedme123xyz` |
2. Save — Render redeploys.
3. Visit this URL in your browser once (swap in your own domain and secret):
   ```
   https://fair-savings-backend.onrender.com/api/dev/seed?secret=seedme123xyz
   ```
   You should get back a JSON response confirming the admin and demo family
   were created. It's safe to visit more than once — it won't duplicate data.
4. **Afterward, delete the `SEED_SECRET` variable** on Render (or change it to
   something else) so the endpoint stops responding — it's meant as a one-time
   setup step, not a permanent open route.

> **Note:** this same seeding logic also runs locally via `npm run prisma:seed`
> if you ever do have shell/terminal access to the backend (e.g. testing on
> your own machine, or a future paid Render plan).

> **Free tier note:** Render's free web services spin down after 15 minutes of
> inactivity and take ~30–60 seconds to wake up on the next request. That's
> expected — it's not a bug. Upgrade to a paid instance later if you need it
> always-on.

---

## Step 4 — Deploy the frontend (Vercel)

1. Go to [vercel.com](https://vercel.com) and sign up with GitHub.
2. Click **Add New → Project**, pick your `fair-savings` repo.
3. In **Configure Project**, set **Root Directory** to `frontend`.
4. Add an environment variable:
   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://<your-render-domain>/api` (from Step 3.6) |
5. Click **Deploy**. Vercel builds and gives you a live URL like
   `https://fair-savings.vercel.app`.

---

## Step 5 — Connect the two (CORS)

Go back to Render → your backend service → **Environment** → set:
```
CORS_ORIGIN = https://fair-savings.vercel.app
```
(use your actual Vercel URL). Render redeploys automatically when you save an
environment variable.

---

## You're live

Visit your Vercel URL and sign in:
- Admin: `admin` / `Admin@123`
- Demo member: `KD001` / `Member@123`

**To ship future changes:** edit files in the GitHub web UI (or drag-and-drop
replacement files into the repo) and commit — both Render and Vercel are
connected to your GitHub repo and redeploy automatically on every commit,
exactly like your other projects.

---

## Notes

- Change `JWT_SECRET` to something private before going live for real users —
  don't reuse example values.
- After the first deploy, change the admin password (or re-seed with your own
  `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` Railway variables before seeding).
- Neon's free tier pauses idle databases after inactivity — the first request
  after a pause takes a few seconds to wake up. This is normal and fine for a
  small deployment.
