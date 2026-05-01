# API Keys

Each file in this directory holds a key for one external API. The files are
gitignored — create them locally before building or running the app.

| File            | API                   | Format |
|-----------------|-----------------------|--------|
| `tfl`           | TfL Unified API       | Plain key value, or `app_key=<value>` query string |
| `nre`           | National Rail OpenLDBWS | Plain token value, or `token=<value>` / `accessToken=<value>` |
| `national-rail` | National Rail OpenLDBWS | Same as `nre`; supported as a clearer alias |

The TfL key can also be supplied via the `TFL_API_KEY` environment variable,
which takes precedence over the file.

The National Rail token can also be supplied via the
`NATIONAL_RAIL_TOKEN` environment variable, which takes precedence over the
file.
