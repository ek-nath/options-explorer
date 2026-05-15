#!/bin/bash

# Educational Improvements
gh issue create --title "🎓 Interactive 'What-If' Scenario Simulator" --body "### Description
Add a feature to simulate option prices and Greeks based on changes in spot price, Days to Expiry (DTE), and Implied Volatility (IV). This will help learners understand how different factors affect option value and exposure.

### Technical Implementation
- **Backend**: Create a new endpoint in `backend/main.py` that accepts `S`, `T_days`, `sigma`, and `r` as parameters and uses the existing `black_scholes` function in `utils.py` to return new prices and Greeks.
- **Frontend**: Add sliders for Spot Price (+/- 10%), DTE (0 to 365), and IV (1% to 200%).
- **UI**: Update the dashboard to show 'Simulated' vs 'Actual' Greeks." --label "enhancement,educational"

gh issue create --title "🎓 Expiry Date Dropdown for Improved UX" --body "### Description
Replace the manual expiry text input (YYMMDD) with a dynamic dropdown containing valid expiration dates for the selected ticker.

### Technical Implementation
- **Backend**: Add an endpoint `/api/options/expirations/{symbol}` that uses Alpaca's `GetOptionContractsRequest` to fetch all active contracts and extract unique expiration dates.
- **Frontend**: Populate a `<select>` component with these dates. Use the first available date as the default instead of hardcoded `260618`." --label "enhancement,UX"

gh issue create --title "🎓 Visualizing the Volatility Smile" --body "### Description
Add a chart plotting Implied Volatility (Y-axis) vs. Strike Price (X-axis). This is a fundamental concept for understanding Vol Skew/Smile.

### Technical Implementation
- **Frontend**: Create a new chart component (e.g., `VolSmileChart.tsx`) using the `implied_vol` data already returned by the `/api/options/chain/` endpoint.
- **UI**: Add this chart to the 'Exposure Profile' section or a new 'Volatility Analysis' tab." --label "enhancement,educational"

gh issue create --title "🎓 Contextual Tooltips for Financial Jargon" --body "### Description
Add hoverable info-icons next to complex headers like GEX, DEX, Delta, Gamma, and IV to explain what they mean in plain English.

### Technical Implementation
- **Frontend**: Implement a reusable `InfoTooltip` component.
- **Content**: Include definitions and simple explanations (e.g., *'Positive GEX implies dealers are selling into rallies and buying dips, muting market volatility.'*)." --label "documentation,UX"

# Research Improvements
gh issue create --title "🔬 Fix AI Agent's Data Truncation Logic" --body "### Description
The current AI summary tool `get_option_chain_summary` in `main.py` truncates the chain to the first 20 contracts alphabetically, missing the critical At-The-Money (ATM) action.

### Technical Implementation
- **Backend**: In `main.py`, sort the option chain by strike price proximity to the current `spot_price`.
- **Logic**: Select +/- 10 strikes around the spot price.
- **Enhancement**: Explicitly pass calculated `call_wall` and `put_wall` to the LLM context to provide better macro perspective." --label "bug,ai"

gh issue create --title "🔬 Historical GEX Tracking (Database Integration)" --body "### Description
Implement a tracking system to snapshot GEX and wall levels over time. This allows researchers to see if walls are rolling up/down, which is a significant market signal.

### Technical Implementation
- **Storage**: Add a lightweight database (SQLite or PostgreSQL).
- **Automation**: Create a daily task (or trigger) to snapshot the GEX profile and wall levels.
- **Visualization**: Update `PriceChart.tsx` to overlay historical Call/Put walls on the price action." --label "enhancement,research"

gh issue create --title "🔬 Robustness in Black-Scholes Math" --body "### Description
The `black_scholes` function in `utils.py` is susceptible to `ZeroDivisionError` if `sigma` (Volatility) or `T` (Time) is zero.

### Technical Implementation
- **Backend**: Modify `backend/utils.py` to add safety floors to inputs:
  ```python
  sigma = max(sigma, 1e-5)
  T = max(T, 1e-5)
  ```
- **Validation**: Ensure illiquid contracts with 0 IV don't break the entire chain processing." --label "bug,research"

gh issue create --title "🔬 Dynamic Custom Technical Levels" --body "### Description
Remove the hardcoded `ARMK` logic for highlighting technical levels and allow users to input their own support/resistance levels.

### Technical Implementation
- **Frontend**: In `page.tsx`, replace the hardcoded `targetStrike = 55` with a state-driven input field.
- **UI**: Add a 'Custom Level' input in the search bar or sidebar that reflects on the `PriceChart`." --label "enhancement,UX"

gh issue create --title "🔬 Caching Layer for Option Chain Endpoints" --body "### Description
Requests for full option chains (especially for high-volume tickers like SPY) are slow and can hit API rate limits quickly.

### Technical Implementation
- **Backend**: Wrap the `/api/options/chain/` endpoint in a caching layer.
- **Strategy**: Use FastAPI's `@alru_cache` or a simple Redis instance with a 1-5 minute TTL." --label "performance,research"
