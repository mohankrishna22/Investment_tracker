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
`src/lib/lock.ts` as a SHA-256 digest — change the digest there to change the code.
"Stay unlocked on this device" remembers the unlock in `localStorage`; leaving it
unticked means the code is asked for again next time the tab is closed. The **Lock**
button in the header clears it on demand.

Be clear-eyed about what this is: the app is a static bundle, so the check runs in
the browser and anyone who opens devtools can step past it. Hashing the code keeps
it from being read straight out of the source, but a four-digit code brute-forces
instantly. Treat it as a curtain that keeps a casual visitor out, not as security.

## Where the data lives

In `localStorage`, in the browser you use it in. That means:

- Nothing leaves your device and no one else can see it.
- It is **per-browser and per-device** — the data does not follow you to your phone.
- Clearing site data erases it.

So take a backup from **Settings → Download backup** now and then, and restore it on
any other device you want the same picture on.

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
