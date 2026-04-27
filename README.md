# Commute

Commute is a small TfL departures app for saved London transport searches.

The active app is the React/Vite PWA in `react/`. The older Python CLI lives in
`python/`, but current development is focused on the React app.

## React app

```bash
cd react
npm install
npm run dev
npm run build
```

The production build is emitted to `react/dist/`.

Pages:

- `index.html`: home view showing saved searches.
- `search.html`: search/configuration view.

The app uses the TfL Unified API directly from the browser. Vite injects the API
key from `python/apikey` at build time, or from `TFL_API_KEY` if set.

## Features

- Saved searches stored in `localStorage`.
- Home page shows up to 5 departures per saved search.
- Search page can save the current query, route filter, radius, and limit.
- Edit mode on home supports removing and reordering saved searches.
- Bus and Tube arrivals are fetched.
- Tube line badges use TfL line colours where known.
- PWA manifest and service worker are included.

## Notes

The service worker avoids caching TfL API responses and HTML pages, so live data
and page content should not become stale through the PWA cache.

