# API Keys

Each file in this directory holds a key for one external API. The files are
gitignored — create them locally before building or running the app.

| File  | API             | Format                                      |
|-------|-----------------|---------------------------------------------|
| `tfl` | TfL Unified API | Plain key value, or `app_key=<value>` query string |

The TfL key can also be supplied via the `TFL_API_KEY` environment variable,
which takes precedence over the file.
