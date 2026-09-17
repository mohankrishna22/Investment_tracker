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

The app is a static bundle, deployed to GitHub Pages by
`.github/workflows/deploy.yml` on every push to `main`. Enable it once under
**Settings → Pages → Build and deployment → Source: GitHub Actions**.

GitHub Pages on a **private** repository requires a paid plan (Pro, Team or
Enterprise). On a free account the repository has to be public for Pages to serve it
— worth knowing that the code would then be public, though your investment data
never is, since it only ever exists in your own browser.

## Stack

React 18, TypeScript and Vite. Charts are hand-written SVG with a colour palette
checked for colour-blind separation and contrast in both themes. No backend, no
analytics, no third-party requests at runtime.
