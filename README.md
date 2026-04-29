# DarkHorse

An interactive, multi-view dashboard for exploring Hong Kong horse racing data from the 2024–2025 HKJC season. Built with D3.js and vanilla JavaScript.

---

## The Problem

Hong Kong horse racing generates enormous volumes of structured data each season — race results, running positions, sectional times, live odds, jockey/trainer statistics, track conditions, and more. Yet for fans, bettors, and analysts this data is scattered across multiple sources (HKJC websites, third-party vendors, etc.), locked behind static tables, or available only as raw CSV files with no interactive exploration layer.

There is no unified, publicly available visualization system that lets users interactively slice through HKJC race history to surface performance patterns, compare entities (horses, jockeys, trainers), and reason about the factors that correlate with race outcomes.

**DarkHorse** addresses this gap by transforming raw historical race data into explorable visual narratives. Instead of gut feeling and anecdote, users can filter, link, and drill down into the data to answer concrete analytical questions about performance, strategy, and value. The platform is open-source and free to use — including for those who cannot afford commercial racing analytics services.

---

## Who Is This For?

| Audience | Example Questions |
|---|---|
| Racing enthusiasts & amateur analysts | Which horses / jockeys overperform at specific venues or distances? What pace strategies work on yielding turf? |
| Bettors & value hunters | When is the betting favourite most likely to be upset? What do live odds patterns predict about winner probability? |
| Data journalists | How have performance trends and market dynamics shifted across the season? |
| Students & researchers | How do horse demographics (age, breeding, import type) correlate with career trajectories? |

Representative analytical questions the dashboard helps answer:

- Which horses/jockeys overperform at specific venues/distances? *(Linked position vs. odds views filtered by track.)*
- How do win odds evolve across a horse's career, and do patterns predict next-race outcomes? *(FSpeed + Win Odds trend charts.)*
- What pace strategies win on yielding turf? *(Running-position replays + sectional time analysis.)*
- Where is the betting market systematically wrong? *(Blind Spot Matrix: FSpeed vs. Odds quadrant bubble chart.)*
- How do gear changes affect finishing speed? *(Gear Impact Analyzer: ΔFSpeed per gear configuration.)*
- Which jockey–horse partnerships produce the best results? *(Synergy Matrix: Win%, Avg position, total rides.)*
- Which trainers peak at which point in the season? *(Trainer Seasonality: stream graph of monthly win peaks.)*
- How well do market odds predict actual outcomes? *(Odds Calibration: implied probability vs. empirical win rate.)*

---

## Features

The dashboard is organised into four tabs:

### Horse Analysis
| Component | Description |
|---|---|
| **Horse Panel** | Search and select any horse (sort A–Z or by Rating ↑); view full profile: career record, breeding lineage (sire & dam), import type, and weight history. Horses with only one race display a notice instead of blank trend charts. |
| **Speed Analytics** | Finish Position sparkline and FSpeed trend line for the selected horse's last 10 races, with interactive hover tooltips. |
| **Synergy Matrix** | Jockeys who have ridden the selected horse — Win%, Avg position, and total rides, with sortable columns. |
| **Gear Impact Analyzer** | Per-gear ΔFSpeed table (all columns sortable) showing how each equipment configuration affects finishing speed. |

### Race Analysis
| Component | Description |
|---|---|
| **Race Runner Table** | Select a race by date (calendar picker with prev/next navigation) or by horse (autocomplete search, sortable by name or Rating); displays all starters with position, jockey, draw, rating, LBW, odds, FSpeed, and gear. |
| **Bump Chart** | Multi-race finishing-position bump chart for all horses in the selected race's field. |
| **Race Replay** | Floating, resizable animated oval-track replay of the selected race; all runners shown as coloured dots with position labels. |

### Trainer Analysis
| Component | Description |
|---|---|
| **Jockey & Trainer Analysis** | Search and select a jockey by name (autocomplete); view career overview stats and a sortable Trainer Partnerships table (Win%, total rides, Avg position). |
| **Trainer Seasonality** | Stream graph of monthly win totals for the top trainers across the full 2024–2025 season, revealing peak periods. |

### Betting Edge
| Component | Description |
|---|---|
| **Odds Calibration** | Compares implied win probability from market odds against actual win rates per odds bucket; highlights where the market over- or under-prices horses. |
| **Blind Spot Matrix** | Quadrant bubble chart plotting FSpeed vs. Win Odds to surface horses the market systematically undervalues or overvalues. |

---

## Guided Tour

Click the **Tour** button (top-right of the nav bar) to launch a 10-step guided walkthrough of every panel. Use the arrow keys or on-screen buttons to navigate; press Escape to exit at any time.

---

## Setting Up

#### Dataset

The dataset 2024–2025 Hong Kong Horse Racing raw data is downloaded from:

> **https://horseracinghk.com/2024-2025-%e9%a6%ac%e5%ad%a3%e5%8e%9f%e5%a7%8b%e6%95%b8%e6%93%9a%e4%b8%8b%e8%bc%89/**

Place the downloaded CSV as:

```
dataset/20242025HongKongHorseRacingRawData.csv
```

#### Running Locally

No build step required. Serve the project root over HTTP (required for ES-module imports and CSV loading):

```bash
python -m http.server 8080
```

Then open **http://localhost:8080** in your browser.

---

## Project Structure

```
DarkHorse/
├── index.html                   # Shell: tabs, nav bar, popup containers
├── css/
│   └── styles.css               # All layout and component styles
├── js/
│   ├── app.js                   # Boot sequence, tab switching, popup management
│   ├── GlobalState.js           # Pub/sub state store (activeHorseID, activeRace, …)
│   ├── DataLoader.js            # CSV parsing and data normalisation
│   ├── Tooltips.js              # Metric-definition tooltip system + DEFINITIONS dict
│   ├── Tutorial.js              # 10-step guided tour (Tour button in nav bar)
│   ├── SidebarSelector.js       # Horse list (search + A–Z / Rtg sort), profile card
│   ├── SpeedAnalytics.js        # Finish Position sparkline + FSpeed trend charts
│   ├── SynergyMatrix.js         # Jockeys-on-this-horse table (sortable columns)
│   ├── GearImpactAnalyzer.js    # ΔFSpeed by gear configuration (sortable table)
│   ├── PerformanceGrid.js       # Race runner table: select by date or by horse
│   ├── BumpChart.js             # Multi-race finishing-position bump chart
│   ├── RaceReplay.js            # Animated oval-track race replay (floating popup)
│   ├── JockeyHorseMatrix.js     # Jockey → Trainer partnership analysis
│   ├── TrainerSeasonality.js    # Stream graph of monthly trainer win peaks
│   ├── OddsCalibration.js       # Odds vs. actual win rate calibration curve
│   └── BlindSpotMatrix.js       # Quadrant bubble chart for market blind spots
└── dataset/
    └── 20242025HongKongHorseRacingRawData.csv
```

---

## Key Metric Reference

| Term | Meaning |
|---|---|
| **FSpeed** | Final-400 m sectional time (seconds). Lower = faster sprint finish. |
| **LBW** | Lengths Behind Winner at the finish line. 0 = winner. |
| **RunningPosition** | Horse's position at each checkpoint (Start → mid-race calls → Finish). |
| **RaceClass** | Race grade: 5 (entry, Rtg 0–39) → 1 (elite, Rtg 100+) → G3/G2/G1 (international). |
| **Rtg.** | Official HKJC handicap rating. ≈ 1 point = 1 lb extra weight in Classes 1–5. |
| **Act.Wt.** | Actual weight carried (lbs), including jockey and saddle. |
| **Declar.Horse Wt.** | Horse bodyweight (kg) declared by trainer ~3–4 days before race day. |
| **Dr.** | Draw / starting gate number. 1 = inside rail. |
| **G** | Going (track condition): G · GF · GY · Y · WF · WS · SE. |
| **Gear** | Equipment codes: B = Blinkers, TT = Tongue Tie, SR = Shadow Roll, etc. Suffix "1" = first time; "-" = removed. |
| **ImportType** | PPG / PP / ISG / VIS — how the horse entered HK racing. |

Full definitions are available in the in-app **Dictionary** (nav bar → "Dictionary" button).

---

## Tech Stack

- **D3.js v7** — all SVG rendering, axes, and data joins
- **Vanilla JavaScript** — no framework, no bundler
- **CSS custom properties** — dark theme, responsive layout
