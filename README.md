# Commute

Commute is a small TfL departures app for saved London transport searches.

## App

```bash
npm install
npm run dev
npm run build
```

The production build is emitted to `packages/web/dist/`.

Pages (hash-routed from a single `index.html`):

- `#` — home view showing saved searches.
- `#search` — search/configuration view.
- `#explorer` — raw TfL API explorer.

The app uses the TfL Unified API directly from the browser. Vite injects the API
key from `apikeys/tfl` at build time, or from `TFL_API_KEY` if set.

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
