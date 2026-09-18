# Investment Tracker

A personal tracker for money put into businesses, property and other ventures — and
for what comes back out. No accounts, no server, no sign-in: everything is stored in
your browser and nothing is sent anywhere.

## What it does

**Home** lists every investment type you've set up — a business, a plot of land, a
fund — each showing how much has gone in, how much has come back, the net position
and when it was last touched. A donut shows where the capital sits; a bar chart shows
money in and out month by month. Totals for the whole portfolio sit pinned at the
bottom of the page.

**Opening an investment type** shows every entry inside it: how much, on what date,
for what item, in which expense category and how it was paid, with the running total
in the table footer. A second tab lists returns — profit shares, dividends, rent,
interest, a sale. A breakdown tab charts spend by category, month-by-month flow,
the biggest line items and returns by type. Total invested, returns received,
current value and net sit at the bottom.

**Reports** gives a month-by-month cash-flow table, the spend mix by expense category
and by sector, and a full ledger of every transaction — filterable by year and
exportable to CSV.

### Beyond the basics

- **XIRR** — annualised, date-weighted return per venture and across the portfolio,
  so a return earned over six months isn't compared with one earned over six years.
- **Current value** — record what a stake is worth today and unrealised gain flows
  into net position, ROI and XIRR.
- **Capital targets** — set a target per venture and the card shows a funding bar.
- **Status** — active, planned or closed, with filtering on the home page.
- **Search and sort** by name, category, amount invested, returns, ROI or recency.
- **CSV export** for investments, returns and a portfolio summary.
- **JSON backup and restore**, so data survives a cleared browser or a new machine.
- **Sample portfolio** to explore the app before entering anything real.
- **Light and dark themes**, currency and locale settings, and a layout that works
  on a phone.

## Access code

The site asks for a four-digit code before it shows anything. The code is set in
`src/lib/lock.ts` as a SHA-256 digest — change the digest there to change the code
(`node -e "console.log(require('crypto').createHash('sha256').update('1234').digest('hex'))"`).

The unlock lasts **30 minutes of inactivity**. Any tap, key or scroll pushes the
deadline out; leave the app alone for half an hour and it locks itself, whether the
tab was closed or left sitting open. The **Lock** button in the header locks it
immediately.

Be clear-eyed about what this is: the app is a static bundle, so the check runs in
the browser and anyone who opens devtools can step past it. Hashing the code keeps
it from being read straight out of the source, but a four-digit code brute-forces
instantly. Treat it as a curtain that keeps a casual visitor out, not as security.

## Where the data lives

In `localStorage` by default — per-browser and per-device, cleared when you clear site
data. Turn on **cloud sync** and it also lives in a Supabase project you own, so the
same picture shows up on every device you pair.

### Setting up cloud sync

1. Create a free project at [supabase.com](https://supabase.com) (no card needed).
2. Open **SQL Editor → New query**, paste [`supabase/schema.sql`](supabase/schema.sql)
   and run it.
3. In the app: **Settings → Cloud sync**, paste the **Project URL** and **anon public
   key** from *Project Settings → API*, and hit **Connect**. A random sync ID is
   generated for you.
4. On the Mac, hit **Pair another device** and scan the QR with your phone (or open the
   copied link there). The phone pulls your data down and stays in step from then on.

**How it syncs.** Local changes push about a second and a half after you stop typing.
Each device pulls when it starts, when you switch back to its tab, and once a minute.
If the same row was edited on two devices since their last sync, the most recent edit
wins and the app says so rather than merging silently — so a backup is still worth
taking before big changes.

**Seeing the raw data.** In Supabase, **Table Editor → `snapshots`** shows one row per
sync ID — the whole portfolio is a single JSON document in the `data` column, not a
table per entity, so the editor is not much to look at. [`supabase/queries.sql`](supabase/queries.sql)
has ready-made SQL that unpacks it into readable tables of ventures, investments,
returns and per-venture totals. Paste one into the SQL editor and run it.

**How private it is.** The anon key ships inside the app and is meant to be public, so
it is not what protects you. The `snapshots` table has row-level security with no
policies at all — the anon key cannot read or list it directly. The only way in is two
`security definer` functions that require your **sync ID**, which is 160 random bits and
never appears in this repository. Keep the sync ID (and the pairing QR/link, which
contains it) to yourself and your data stays yours.

## Running it locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
npm run preview  # serve the built bundle
```

## Hosting

Live at **https://mohankrishna22.github.io/Investment_tracker/**.

The app is a static bundle, deployed to GitHub Pages by
`.github/workflows/deploy.yml` on every push to the default branch. Pages is
configured under **Settings → Pages → Source: GitHub Actions**.

Two things to know if the deploy ever fails:

- The `github-pages` environment only accepts deployments from the repository's
  **default branch** — a run from any other branch is rejected before it starts.
- Pages on the free tier only serves **public** repositories; a private one needs
  GitHub Pro, Team or Enterprise. Your investment data is unaffected either way,
  since it only ever exists in your own browser.

## Stack

React 18, TypeScript and Vite. Charts are hand-written SVG with a colour palette
checked for colour-blind separation and contrast in both themes. No backend, no
analytics, no third-party requests at runtime.
