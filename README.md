# Agentic AI — Personal Financial Advisor

A personal financial advisor built on top of Claude + an MCP server that exposes market
data, technical indicators, news, macro data, and portfolio analytics.

Analysis only — no brokerage execution. All tools are read-only except the local
portfolio/watchlist state.

## What it knows how to do

- **Market data** (yfinance, no key required) — quotes, history, fundamentals, options
  chains, ticker search. Supports US equities, ETFs, crypto (`BTC-USD`), forex (`EURUSD=X`),
  commodity ETFs.
- **Technicals** — SMA, EMA, RSI, MACD, Bollinger Bands, ATR, volatility, correlation,
  plus Alpha Vantage indicators and FX rates.
- **News & analyst data** (Finnhub) — company news, news sentiment, recommendation
  trends, price targets, earnings calendar, earnings surprises, insider transactions,
  IPO calendar, general market news.
- **Macro** (FRED) — yield curve, fed funds, CPI, unemployment, VIX, oil, gold, and a
  one-call `get_macro_snapshot` for the usual suspects.
- **Portfolio & watchlist** — add/remove holdings, cash balance, performance per lot,
  portfolio-level volatility, beta vs SPY, concentration, correlation matrix.

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

yfinance needs no key. If you skip the other three the advisor still works — it just
can't use the tools backed by those sources.

## Usage

### Option 1 — standalone advisor CLI

```bash
python -m advisor
```

Opens a REPL. Ask things like:

- `What's the setup on NVDA right now?`
- `Show me my portfolio and flag anything risky.`
- `Yield curve + VIX — what regime are we in?`
- `Options chain for SPY next Friday — where's the implied move?`
- `Compare MSFT, GOOGL, AMZN on valuation and momentum.`

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
  technicals.py     Local indicators + Alpha Vantage technicals/forex
  news.py           Finnhub: news, sentiment, ratings, earnings, insiders
  macro.py          FRED: rates, CPI, unemployment, VIX, macro snapshot
  portfolio.py      Local portfolio + watchlist state & analytics
  config.py         Env vars, paths
advisor/
  advisor.py        REPL that bridges Anthropic Messages API + MCP stdio
  system_prompt.py  Advisor persona / behavior
data/               Portfolio & watchlist JSON (gitignored)
```

## Adding your portfolio

From the REPL, just ask:

> Add 100 shares of VTI at $245, bought 2024-03-15. Cash balance is $5,000.

The advisor will call `add_holding` and `set_cash`. Or edit `data/portfolio.json`
directly — the format is obvious.

## Notes

- yfinance is unofficial. It sometimes rate-limits or returns stale data during
  off-hours. If a tool fails once, retry.
- Alpha Vantage free tier is 25 requests/day — use sparingly. Local technicals cover
  most needs; Alpha Vantage is mainly useful for intraday forex and less-common
  indicators.
- Finnhub free tier is generous for single-user workloads.
- This system gives analysis and opinions. You execute.
