# HIV/AIDS Gender & Regional Disparities Dashboard

Interactive browser-based dashboard visualizing HIV/AIDS indicators for adolescents (ages 10–19) across Eastern and Southern Africa and West and Central Africa, 1990–2019.

## Features

- 9 KPI cards with gender-split metrics and disparity ratio
- 3 trend line charts (new infections, AIDS deaths, incidence rate)
- 2 horizontal grouped bar charts by country and sex
- Top-5 countries by gender disparity spotlight
- Regional summary with percentage share cards and grouped bar chart
- Region and year-range filters with instant updates
- PDF export (A4 landscape) via jsPDF + html2canvas
- Dark theme, Wong colorblind-safe palette, keyboard-accessible

## Embedding the Full Dataset

The dashboard uses an embedded CSV string in `js/data.js` (no fetch calls, works on GitHub Pages and `file://`).

1. Open `js/data.js`
2. Replace the sample rows between the header line and the closing backtick with all rows from your source CSV
3. Keep the header row exactly as-is

The comment `// FULL DATASET: Replace the sample rows above with all rows from the source CSV file` marks the replacement point.

## Running Locally

Open `index.html` directly in Chrome, Firefox, or Edge — no server required.

```
# macOS / Linux
open "HIV AIDS Project/index.html"

# Windows
start "" "HIV AIDS Project\index.html"
```

## Deploying to GitHub Pages

1. Push the `HIV AIDS Project/` folder contents to a GitHub repository (the files should be at the repo root, or in a subfolder you configure as the Pages source).

2. Go to **Settings → Pages** in your repository.

3. Under **Source**, select the branch (e.g. `main`) and the folder (`/ (root)` or `/docs` depending on where you placed the files).

4. Click **Save**. GitHub Pages will publish the site at `https://<username>.github.io/<repo>/`.

5. All paths are relative and no server is needed — the site works as-is.

### Recommended repo structure for Pages root deployment

```
your-repo/
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── data.js
│   ├── csv-parser.js
│   ├── data-store.js
│   ├── filter-engine.js
│   ├── chart-renderer.js
│   └── app.js
└── README.md
```

## Browser Compatibility

Requires a modern browser with ES2020 support:
- Chrome 80+
- Firefox 74+
- Edge 80+

## Libraries (CDN)

| Library | Version | Purpose |
|---|---|---|
| Chart.js | 4.4.0 | All charts |
| PapaParse | 5.4.1 | CSV parsing |
| jsPDF | 2.5.1 | PDF generation |
| html2canvas | 1.4.1 | Dashboard screenshot for PDF |
