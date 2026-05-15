# Options Explorer 📈

Options Explorer is a full-stack financial dashboard designed to visualize complex options market mechanics, specifically **Gamma Exposure (GEX)**, **Delta Exposure (DEX)**, and institutional-grade **Call/Put Walls**. It provides real-time Greeks and automated analysis powered by Alpaca Markets and an integrated AI assistant.

## 🚀 Quick Start

### 1. Prerequisites
- **Python 3.14+**
- **Node.js 20+**
- **Alpaca Markets API Keys** (Professional feed recommended for OPRA data)

### 2. Environment Setup
Create a `.env` file in the root directory (and `backend/` directory) with:
```env
ALPACA_API_KEY=your_key_here
ALPACA_SECRET_KEY=your_secret_here
GEMINI_API_KEY=your_gemini_key_here
```

### 3. Launch the Services
The application runs on two separate ports to avoid conflicts:

#### **Backend (FastAPI)**
```bash
cd backend
python -m venv .venv
source .venv/bin/python  # or .venv\Scripts\activate
uv sync # if using uv
python main.py
```
*Defaults to `http://localhost:5001`*

#### **Frontend (Next.js)**
```bash
cd frontend
npm install
npm run dev -- -p 4001
```
*Defaults to `http://localhost:4001`*

---

## 🛠 Features & How They Work

### 1. Exposure Visualization (GEX & DEX)
The dashboard calculates and displays **Dealer Gamma Exposure** and **Delta Exposure** across all strikes for a selected expiry.
- **Signed GEX:** Calls contribute positive gamma, while Puts contribute negative gamma (following the "Dealer Short" convention).
- **Units:** Values are automatically scaled to **$ (Dollars)**, **K (Thousands)**, **M (Millions)**, or **B (Billions)** for readability.
- **Formula:** 
    - `GEX = Gamma * OI * 100 * Spot^2 * 0.01` (Gamma Dollars per 1% move)
    - `DEX = Delta * OI * 100 * Spot` (Delta Dollars)

### 2. Dynamic Wall Identification
The system automatically identifies the **Call Wall** and **Put Wall**:
- **Call Wall:** The strike above the current spot price with the highest positive GEX peak.
- **Put Wall:** The strike below the current spot price with the deepest negative GEX peak.
- These levels are dynamically marked on the Price Action chart.

### 3. Standardized Option Chain
The Option Chain component refactors raw data into a standard professional layout:
- **Grouping:** Calls and Puts are displayed side-by-side by strike.
- **ATM Centering:** The table automatically filters to strikes within +/- 50% of the spot price and highlights the At-The-Money (ATM) strike in yellow.
- **Unified Greeks:** If the real-time data provider has gaps, the backend automatically falls back to a **Black-Scholes calculation** to ensure Delta and Gamma are always available.

### 4. Smart Data Fallbacks
Market data can be noisy. This app implements:
- **OI Fallback:** If Open Interest is unreported for a specific series, the system uses `Latest Trade Size` or a `Minimal Seed` to maintain visual profiles.
- **Black-Scholes Engine:** A built-in engine calculates Greeks using current Spot, Strike, Days-to-Expiry, and Implied Volatility.

---

## 🖥 Usage Guide

1.  **Search:** Enter a ticker (e.g., `ARMK` or `TEAM`) in the search bar.
2.  **Expiry Filter:** Use the `YYMMDD` format (e.g., `260618` for June 18, 2026) to focus the analysis on a specific expiry.
3.  **Analyze Chart:** Look for the **Call Wall** (red) and **Put Wall** (green) labels on the price chart.
4.  **Target Highlight:** The system can be configured to mark specific target strikes (default set to ARMK $55).
5.  **Chain Depth:** Scroll through the option chain to see the Delta profile for each strike.

## 📦 Project Structure
- `/backend`: FastAPI application containing the financial calculation logic (`utils.py`) and Alpaca client integration (`main.py`).
- `/frontend`: Next.js application with Tailwind CSS and Lightweight-Charts for visualization.
- `/frontend/components`: Reusable UI components for `OptionChain`, `ExposureChart`, and `PriceChart`.

---

## 🔒 Security
Never commit your `.env` files. The project includes a `.gitignore` that protects these secrets along with `.venv`, `__pycache__`, and log files.
