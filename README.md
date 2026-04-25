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
- Under what conditions is the betting favourite most likely to be upset? *(Track condition × trip condition heatmap.)*
- How do gear changes affect finishing speed? *(Gear Impact Analyzer: ΔFSpeed per gear configuration.)*
- Which jockey–horse partnerships produce the best results? *(Synergy Matrix: Win%, Avg LBW, Place%.)*
- How does a horse's sectional finishing speed (FSpeed) relate to its running position changes? *(Combined FSpeed + Running Position view.)*

---

## Features

| View | Description |
|---|---|
| **Horse Sidebar** | Filter and select any horse; view profile badge with Rating, HorseID, Country, and `?` definitions for every metric |
| **Performance Grid** | Side-by-side season summary cards per horse |
| **Speed Analytics** | Three linked spark-line charts per horse: Running Position trend, FSpeed trend, LBW trend, and Win Odds trend |
| **Race Replay** | Animated oval-track replay of any selected race; all runners shown as coloured dots |
| **Bump Chart** | Floating popup ranking horses by finishing position across multiple races |
| **Gear Impact Analyzer** | Bar chart of ΔFSpeed per gear code relative to the no-gear baseline |
| **Synergy Matrix** | Jockey dropdown → Win%, Avg Finish, Avg LBW, and Place% for every horse–jockey pairing |
| **Dictionary** | Floating, searchable glossary of every metric and HKJC code used in the dashboard |

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
├── index.html               # Shell: tabs, nav bar, popup containers
├── css/
│   └── styles.css           # All layout and component styles
├── js/
│   ├── app.js               # Boot sequence, tab switching, popup management
│   ├── GlobalState.js       # Pub/sub state store (activeHorseID, activeRace, …)
│   ├── DataLoader.js        # CSV parsing and data normalisation
│   ├── Tooltips.js          # Metric-definition tooltip system + DEFINITIONS dict
│   ├── SidebarSelector.js   # Horse list, filtering, profile card
│   ├── PerformanceGrid.js   # Season summary cards
│   ├── SpeedAnalytics.js    # FSpeed / LBW / Win Odds / Running Position charts
│   ├── RaceReplay.js        # Animated oval-track race replay
│   ├── BumpChart.js         # Floating bump-chart popup
│   ├── GearImpactAnalyzer.js# ΔFSpeed by gear configuration
│   └── SynergyMatrix.js     # Horse–jockey partnership matrix
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
- **Vanilla JavaScript (ES Modules)** — no framework, no bundler
- **CSS custom properties** — dark theme, responsive layout
