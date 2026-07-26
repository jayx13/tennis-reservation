# Yokohama Sports Reservation Watcher

A lightweight scraper and web dashboard for tennis availability in **Kanagawa Prefecture** and **Yokohama City**, plus nearby basketball courts from the **Yokohama City reservation system**.

Tennis and basketball appear on separate tabs. Basketball checks eight Yokohama venues: Tsurumi, Kanagawa, Nishi, Naka, Minami, Konan, and Hodogaya Sports Centers, plus Hiranuma Memorial Gymnasium.

---

## 🚀 Running Locally

You can launch the web application and the automatic updates with a single command.

### Quick Start

Open your terminal in the project directory and run:

```bash
./deploy-local.sh
```

*Alternatively, you can run:*
```bash
npm start
```

### What this launcher does:
1. **Verifies your environment:** Checks if Node.js is installed.
2. **Bootstraps data:** If no cached data exists in `public/data/availability.json`, it runs the checker script once to scrape initial slots.
3. **Launches Web Server:** Starts a fast, zero-dependency Node.js HTTP server at **[http://localhost:4173](http://localhost:4173)**.
4. **Auto-opens page:** Launches your default web browser to view the slots dashboard.
5. **Keeps data fresh:**
   - Periodically refreshes availability in the background (every hour).
   - Allows **manual updates** at any time by pressing **`r`** in the terminal window.

---

## ⚙️ Configuration

You can customize which parks, dates, or search purposes the watcher checks by editing [reservation.config.json](file:///Users/jay/Documents/GitHub/Tennis%20Reservation/reservation.config.json).

Key options:
- `daysAhead`: Number of days in the future to check (default: `30`).
- `facilities`: List of Kanagawa Prefecture park facilities (e.g. Hodogaya Park, Mitsuike Park).
- `yokohama.facilities`: Yokohama City tennis and basketball facilities. Each entry identifies its `sport`.

---

## 📦 Project Structure

- [deploy-local.sh](file:///Users/jay/Documents/GitHub/Tennis%20Reservation/deploy-local.sh): Easy CLI launcher script.
- [package.json](file:///Users/jay/Documents/GitHub/Tennis%20Reservation/package.json): Package metadata and npm scripts.
- [public/](file:///Users/jay/Documents/GitHub/Tennis%20Reservation/public): Static frontend files (HTML, CSS, JS) served to your browser.
- [scripts/](file:///Users/jay/Documents/GitHub/Tennis%20Reservation/scripts):
  - [check-slots.mjs](file:///Users/jay/Documents/GitHub/Tennis%20Reservation/scripts/check-slots.mjs): Core crawler/scraper script.
  - [start.mjs](file:///Users/jay/Documents/GitHub/Tennis%20Reservation/scripts/start.mjs): Dev server and background updater.
- [.github/workflows/check-reservations.yml](file:///Users/jay/Documents/GitHub/Tennis%20Reservation/.github/workflows/check-reservations.yml): GitHub Actions configuration to automate scraping and deploy to GitHub Pages.
