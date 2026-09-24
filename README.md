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

**Loans** is a second dashboard for informal debt in both directions — money you lent
to friends and family, and money you borrowed from them — kept separate from the
investment side. The headline figures are what you are owed, what you owe, and the net
position between them.

Each person shows both sides at once, because the same person can be on both: what
they owe you, what you owe them, and the net. Opening a person gives a **Lent out** tab
and a **Borrowed** tab, each with its own loans (amount, date, purpose, the date it was
promised back) and its own repayments, with running totals.

Repayments are not tagged to a particular loan, because working out which of four loans
a transfer covers is friction nobody wants. Instead the money is applied to the
**oldest unsettled loan on that side first**, so each loan shows as settled, part paid
or outstanding with no bookkeeping. A "worth a nudge" list collects everything overdue
or falling due in the next 30 days, in both directions — who to chase, and who to pay.
A loan can be written off (or forgiven, borrowing the other way), which keeps the
record without it counting towards a balance.

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
- **Sample portfolio** — three ventures and three borrowers with real history, to
  explore the app before entering anything of your own.
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

**Keeping the project awake.** Supabase pauses a free-tier project after about a week
with no activity. Paused is not deleted — the data stays on disk and one click in the
dashboard brings it back — but sync stops until you do. Two independent daily pings
avoid it, and they cover different failure modes:

| | Covers | Fails when |
| --- | --- | --- |
| **Local scheduler** (launchd, daily 12:30) | GitHub disabling the workflow | the laptop is off or away |
| **GitHub Action** (daily 06:40 UTC) | the laptop being away for weeks | 60 days pass with no push to the repo |

Either alone is enough; together they only both lapse if you are away for weeks *and*
have not pushed to the repository in two months. GitHub emails before it disables a
schedule, and re-enabling is one click.

### Local scheduler

On a Mac, install the scheduled ping once:

```bash
bash scripts/install-keepalive-macos.sh
```

It asks for the Project URL and anon key, saves them to
`~/.config/investment-tracker/keepalive.env` with `600` permissions, tests the ping,
and only schedules it if the test passes. From then on a launchd agent runs it daily
at 12:30 and at login. `launchd` is used rather than `cron` because it catches up on a
run the Mac slept through; `cron` silently skips it. Set `KEEPALIVE_HOUR` and
`KEEPALIVE_MINUTE` to move the time.

| | |
| --- | --- |
| Log | `~/Library/Logs/investment-tracker-keepalive.log` |
| Check it is loaded | `launchctl list \| grep investment-tracker` |
| Run it right now | `launchctl kickstart gui/$(id -u)/local.investment-tracker.keepalive` |
| Remove it | `bash scripts/uninstall-keepalive-macos.sh` |

On Linux, `scripts/keepalive.sh` works the same way from cron:

```
30 12 * * * /path/to/scripts/keepalive.sh >> ~/keepalive.log 2>&1
```

The ping reads a deliberately non-existent sync ID, so it writes nothing and the real
sync ID is never needed here or stored on disk. Credentials live outside the
repository and are never committed.

It only works while the machine is on, which is exactly what the GitHub fallback is
for.

### GitHub Action fallback

`.github/workflows/keepalive.yml` does the same ping from GitHub's runners. Switch it
on by adding two repository secrets under **Settings → Secrets and variables →
Actions**:

| Secret | Value |
| --- | --- |
| `SUPABASE_URL` | the same Project URL you pasted into the app |
| `SUPABASE_ANON_KEY` | the same anon public key |

Without them the job reports that there is nothing to ping and exits cleanly, so it
never shows up as a red failure. With them it fails loudly if the project stops
answering, which reaches you as an email rather than as silence.

Its one weakness is GitHub's rule that a repository with no pushes for 60 days has its
scheduled workflows disabled. That is why the local scheduler exists alongside it.

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
