# CF Enhancer

A Chrome extension that replaces the Codeforces profile page with a clean, data-rich analytics dashboard.

## Features

- **Rating History** — Interactive line chart of full contest history
- **Problems by Difficulty** — Solved problems grouped by rating range with Codeforces color coding
- **Recent Contests** — Last 15 contests with rank, rating, and delta
- **Weakness Detection** — Topics with the lowest solve rate, surfaced automatically
- **Activity Heatmap** — GitHub-style submission activity for the past year
- **Recent Submissions** — Last 15 submissions with verdict badges
- **Blog Posts** — User's blog entries with links
- **User Details** — Country, organization, registration date, social links

## Tech Stack

- Vanilla JavaScript + Vite
- Chart.js for data visualization
- Codeforces Public API (no authentication required)
- Chrome Extensions Manifest V3

## Installation (Development)

1. Clone the repository
2. Install dependencies: `npm install`
3. Build the extension: `npm run build`
4. Open Chrome and go to `chrome://extensions`
5. Enable **Developer Mode** (top right toggle)
6. Click **Load unpacked** and select the `dist/` folder
7. Visit any Codeforces profile: `codeforces.com/profile/{handle}`

## Project Structure
```
src/
├── background/background.js   # API calls via Codeforces API
├── content/content.js         # Dashboard injection into profile pages
├── content/dashboard.css      # Dashboard styles
└── popup/                     # Extension popup UI
public/
├── manifest.json              # Chrome extension configuration
└── popup.html                 # Popup HTML
```

## Documentation

See [DOCUMENTATION.md](./DOCUMENTATION.md) for a complete explanation of every file, function, and technical decision in the codebase.