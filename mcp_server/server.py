"""FastMCP server registering all financial-advisor tools."""
from __future__ import annotations

from mcp.server.fastmcp import FastMCP

from . import macro, news, portfolio, quotes, technicals
from .finance import accounts as fin_accounts
from .finance import analysis as fin_analysis
from .finance import bills as fin_bills
from .finance import budget as fin_budget
from .finance import cashflow as fin_cashflow
from .finance import csv_import as fin_csv
from .finance import paychecks as fin_paychecks
from .finance import plaid_client as fin_plaid
from .finance import transactions as fin_txn

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

# --- accounts (checking / savings / credit cards / loans) ---
mcp.tool()(fin_accounts.add_account)
mcp.tool()(fin_accounts.update_balance)
mcp.tool()(fin_accounts.update_account)
mcp.tool()(fin_accounts.remove_account)
mcp.tool()(fin_accounts.list_accounts)
mcp.tool()(fin_accounts.net_worth)

# --- transactions + categorization ---
mcp.tool()(fin_txn.add_transaction)
mcp.tool()(fin_txn.list_transactions)
mcp.tool()(fin_txn.categorize_transaction)
mcp.tool()(fin_txn.add_category_rule)
mcp.tool()(fin_txn.auto_categorize_all)
mcp.tool()(fin_txn.uncategorized_summary)

# --- CSV import ---
mcp.tool()(fin_csv.import_csv)

# --- Plaid ---
mcp.tool()(fin_plaid.plaid_create_link_token)
mcp.tool()(fin_plaid.plaid_exchange_public_token)
mcp.tool()(fin_plaid.plaid_list_items)
mcp.tool()(fin_plaid.plaid_remove_item)
mcp.tool()(fin_plaid.plaid_get_balances)
mcp.tool()(fin_plaid.plaid_sync_transactions)

# --- paychecks ---
mcp.tool()(fin_paychecks.add_paycheck)
mcp.tool()(fin_paychecks.list_paychecks)
mcp.tool()(fin_paychecks.paycheck_summary)
mcp.tool()(fin_paychecks.remove_paycheck)

# --- bills + subscriptions ---
mcp.tool()(fin_bills.add_bill)
mcp.tool()(fin_bills.remove_bill)
mcp.tool()(fin_bills.list_bills)
mcp.tool()(fin_bills.upcoming_bills)
mcp.tool()(fin_bills.detect_recurring)
mcp.tool()(fin_bills.subscription_audit)

# --- budget ---
mcp.tool()(fin_budget.set_budget)
mcp.tool()(fin_budget.remove_budget)
mcp.tool()(fin_budget.list_budgets)
mcp.tool()(fin_budget.budget_status)

# --- cashflow forecast ---
mcp.tool()(fin_cashflow.cashflow_forecast)
mcp.tool()(fin_cashflow.runway_analysis)

# --- spending analytics ---
mcp.tool()(fin_analysis.spending_by_category)
mcp.tool()(fin_analysis.top_merchants)
mcp.tool()(fin_analysis.income_vs_spending)
mcp.tool()(fin_analysis.savings_rate)
mcp.tool()(fin_analysis.monthly_summary)


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
