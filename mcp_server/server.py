"""FastMCP server registering all financial-advisor tools."""
from __future__ import annotations

from mcp.server.fastmcp import FastMCP

from . import macro, news, portfolio, quotes, technicals

mcp = FastMCP("financial-advisor")

# --- market data (yfinance) ---
mcp.tool()(quotes.get_quote)
mcp.tool()(quotes.get_multi_quote)
mcp.tool()(quotes.get_history)
mcp.tool()(quotes.get_fundamentals)
mcp.tool()(quotes.get_options_expirations)
mcp.tool()(quotes.get_options_chain)
mcp.tool()(quotes.search_tickers)

# --- technicals ---
mcp.tool()(technicals.compute_sma)
mcp.tool()(technicals.compute_ema)
mcp.tool()(technicals.compute_rsi)
mcp.tool()(technicals.compute_macd)
mcp.tool()(technicals.compute_bollinger)
mcp.tool()(technicals.compute_atr)
mcp.tool()(technicals.compute_correlation)
mcp.tool()(technicals.compute_volatility)
mcp.tool()(technicals.alphavantage_technical)
mcp.tool()(technicals.alphavantage_forex)

# --- news / sentiment / analyst (Finnhub) ---
mcp.tool()(news.get_company_news)
mcp.tool()(news.get_news_sentiment)
mcp.tool()(news.get_recommendation_trends)
mcp.tool()(news.get_price_target)
mcp.tool()(news.get_earnings_calendar)
mcp.tool()(news.get_earnings_surprises)
mcp.tool()(news.get_insider_transactions)
mcp.tool()(news.get_ipo_calendar)
mcp.tool()(news.get_market_news)

# --- macro (FRED) ---
mcp.tool()(macro.list_common_series)
mcp.tool()(macro.get_macro_series)
mcp.tool()(macro.get_macro_snapshot)

# --- portfolio + watchlist ---
mcp.tool()(portfolio.add_holding)
mcp.tool()(portfolio.remove_holding)
mcp.tool()(portfolio.set_cash)
mcp.tool()(portfolio.get_portfolio)
mcp.tool()(portfolio.portfolio_performance)
mcp.tool()(portfolio.portfolio_risk)
mcp.tool()(portfolio.add_watchlist)
mcp.tool()(portfolio.remove_watchlist)
mcp.tool()(portfolio.get_watchlist)


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
