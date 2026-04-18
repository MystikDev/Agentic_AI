# Agentic AI — Personal Financial Advisor

A personal financial advisor built on top of Claude + an MCP server that covers both
sides of your money: **investing** (quotes, technicals, news, macro, portfolio) and
**personal finance** (checking/savings, paychecks, bills, budget, cashflow forecast).

Analysis only — no brokerage execution. No bill payment. All tools are read-only against
external services; the local store holds accounts, transactions, paychecks, bills, and
budgets.

## What it knows how to do

### Investing
- **Market data** (yfinance, no key required) — quotes, history, fundamentals, options
  chains, ticker search. US equities, ETFs, crypto (`BTC-USD`), forex (`EURUSD=X`),
  commodities.
- **Technicals** — SMA, EMA, RSI, MACD, Bollinger Bands, ATR, volatility, correlation,
  plus Alpha Vantage indicators and FX rates.
- **News & analyst data** (Finnhub) — company news, news sentiment, recommendation
  trends, price targets, earnings calendar, earnings surprises, insider transactions,
  IPO calendar.
- **Macro** (FRED) — yield curve, fed funds, CPI, unemployment, VIX, oil, gold, plus
  a one-call `get_macro_snapshot`.
- **Portfolio & watchlist** — holdings, cash, per-lot P&L, portfolio volatility, beta
  vs SPY, concentration, correlation matrix.

### Personal finance
- **Accounts** — checking, savings, credit cards, loans, HSA, cash. Balances, APY, APR,
  credit limits, net worth.
- **Transactions** — ledger with regex-based auto-categorization. Add manually, import
  from CSVs, or sync live via Plaid.
- **CSV import** — auto-detects date/description/amount columns from most bank and
  credit-card exports.
- **Plaid** (optional) — live bank sync. Create link tokens, exchange public tokens,
  pull balances and transactions.
- **Paychecks** — gross/net/tax/deduction tracking with cadence detection and
  annualized income estimate.
- **Bills & subscriptions** — registered recurring payments plus auto-detection of
  recurring charges from transaction history (flags forgotten subs).
- **Budget** — monthly category limits with actual-vs-target tracking.
- **Cashflow forecast** — project daily balance 30+ days out given scheduled bills,
  expected paychecks, and average discretionary spend. Surfaces first shortfall date.
- **Runway analysis** — months of emergency-fund coverage.
- **Analytics** — spending by category, top merchants, income vs spending, savings
  rate, monthly summaries.

## Setup

```bash
pip install -e .
cp .env.example .env
# Edit .env and fill in ANTHROPIC_API_KEY + any data-source keys you want.
```

Free API keys:
- [Alpha Vantage](https://www.alphavantage.co/support/#api-key)
- [Finnhub](https://finnhub.io/register)
- [FRED](https://fred.stlouisfed.org/docs/api/api_key.html)
- [Plaid](https://dashboard.plaid.com/signup) — optional, only for live bank sync.
  Sandbox keys are free. Production requires Plaid approval.

yfinance needs no key. If you skip the others the advisor still works — it just can't
use the tools backed by those sources.

## Usage

### Option 1 — standalone advisor CLI

```bash
python -m advisor
```

Opens a REPL. Ask things like:

Investing:
- `What's the setup on NVDA right now?`
- `Yield curve + VIX — what regime are we in?`
- `Options chain for SPY next Friday — where's the implied move?`

Personal finance:
- `How am I doing this month?` (hits accounts, budget, cashflow, savings rate in one turn)
- `Import data/imports/chase-checking.csv into my Chase checking account.`
- `Any subscriptions I probably forgot about?`
- `Can I cover the next 30 days of bills with what's in checking?`
- `Add a paycheck dated 2024-04-15: gross 6500, net 4800, federal 850, state 220, fica 400, 401k 650, health 180.`
- `Set a $500 monthly dining budget.`

REPL commands: `:reset`, `:tools`, `:history`, `:quit`.

### Option 2 — use with Claude Code

`.mcp.json` is already wired up. From this directory just run `claude` and the
financial MCP server auto-loads.

### Option 3 — use the MCP server from anything else

```bash
python -m mcp_server
```

Speaks MCP over stdio. Point any MCP-compatible client at it.

## Project layout

```
mcp_server/
  server.py         FastMCP registration of all tools
  quotes.py         yfinance: quotes, history, fundamentals, options, search
  technicals.py    Local indicators + Alpha Vantage technicals/forex
  news.py           Finnhub: news, sentiment, ratings, earnings, insiders
  macro.py          FRED: rates, CPI, unemployment, VIX, macro snapshot
  portfolio.py      Investment portfolio + watchlist
  config.py         Env vars, paths
  finance/
    store.py        JSON data store (data/finance.json)
    accounts.py     Checking/savings/credit cards/loans + net worth
    transactions.py Ledger + merchant normalization + categorization
    csv_import.py   Bank/CC CSV importer with column auto-detection
    plaid_client.py Plaid: link, balances, transaction sync
    paychecks.py    Paycheck tracking + cadence detection
    bills.py        Bills + subscription audit + recurring detection
    budget.py       Monthly category budgets
    cashflow.py     Daily balance forecast + runway
    analysis.py     Spending breakdowns + savings rate
advisor/
  advisor.py        REPL that bridges Anthropic Messages API + MCP stdio
  system_prompt.py  Advisor persona / behavior
data/               Portfolios, watchlist, finance.json (all gitignored)
```

## Getting started with personal finance

You can seed your data however you prefer — just ask the advisor:

> Add two accounts: Chase checking with $4,200 and Ally savings with $18,500 at 4.35% APY.

> Import data/imports/amex-2024.csv into my Amex card account.

> Register my rent as a $2,100 monthly bill due on the 1st.

> My last paycheck was April 15: gross 6,500, net 4,800, fed 850, state 220, FICA 400, 401k 650, health 180.

> Set monthly budgets: groceries $600, dining $400, transport $250.

The advisor will call the right tools and persist everything to `data/finance.json`.

## Plaid setup (optional)

If you want live bank sync:

1. Sign up at Plaid, get `PLAID_CLIENT_ID` and `PLAID_SECRET`, set them in `.env`.
2. Ask the advisor: `Create a Plaid link token.` Copy the `link_token` from the result.
3. Open [Plaid's Link demo](https://plaid.com/docs/link/) or any Plaid Link UI with
   that token to link your bank. You'll get a `public_token` back.
4. Ask the advisor: `Exchange this Plaid public token: public-...`
5. Now: `Sync my Plaid transactions.` Pulls balances and recent transactions locally.

Re-sync any time. Plaid access_tokens are stored in `data/finance.json` (gitignored).

## Notes

- yfinance is unofficial. It sometimes rate-limits or returns stale data during
  off-hours. If a tool fails once, retry.
- Alpha Vantage free tier is 25 requests/day — use sparingly. Local technicals cover
  most needs; Alpha Vantage is mainly useful for intraday forex.
- Finnhub free tier is generous for single-user workloads.
- CSV importer handles most US bank/CC exports automatically. If yours has odd
  columns, rename them or tell the advisor the layout and it'll adjust.
- `data/finance.json` contains everything — accounts, transactions, paychecks, bills,
  budgets, Plaid access tokens. It is **gitignored** by default. Back it up.
- This system gives analysis and opinions. You execute.
