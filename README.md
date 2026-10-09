# BrowserLogsDemo

Self-serve demo pages for the New Relic browser agent (Pro+SPA). Each visitor gets a session code so they can find their own data in a shared account.

- [Logs demo](https://mcaronnewrelic.github.io/BrowserLogsDemo/) (`index.html`): console auto-logging, `newrelic.log()`, `newrelic.wrapLogger()`, and how log verbosity filters events.
- [Errors demo](https://mcaronnewrelic.github.io/BrowserLogsDemo/errors.html) (`errors.html`): uncaught errors and promise rejections, `newrelic.noticeError()`, `newrelic.setErrorHandler()` for ignoring and grouping, `newrelic.addRelease()`, and how errors relate to ERROR logs.
- [Tracing demo](https://mcaronnewrelic.github.io/BrowserLogsDemo/tracing.html) (`tracing.html`): distributed tracing from the browser. It shows the `traceparent`, `tracestate` and `newrelic` headers the agent adds to each request, and builds a query from your own trace IDs. Each request also writes a browser log with `trace.id`, and the backend logs with `recordLogEvent()`, so browser and server logs appear together on the trace. It runs browser-only out of the box (using `data/*.json`) and becomes full stack when connected to the APM-instrumented API in [`backend/`](backend/README.md).

- [Core Web Vitals demo](https://mcaronnewrelic.github.io/BrowserLogsDemo/vitals.html) (`vitals.html`): makes LCP (a slow hero image), CLS (late banners) and INP (blocking click handlers) good or poor on purpose, with a live scorecard. Results land in `PageViewTiming`, tagged with `demoCode`, `lcpMode` and `clsMode`.

## Change tracking

`.github/workflows/change-tracking.yml` sends New Relic [change tracking events](https://docs.newrelic.com/docs/change-tracking/overview/) to the browser app, so markers show up on its charts:

- **Deployment** events every time GitHub Pages publishes `main` (version = short commit SHA, with the commit message and a link to the commit).
- **One demo event a day at 9 AM Pacific**, rotating by weekday through Feature Flag, Business Event, Operational and Deployment, so every kind of marker appears. The rotation lives in `.github/scripts/daily-change-event.sh` (tests: `bash .github/scripts/daily-change-event.test.sh`).
- **Run workflow** on the Actions tab sends today's daily event immediately.

It uses the repository secrets `NEW_RELIC_API_KEY` (a User key, `NRAK-...`) and `NEW_RELIC_DEPLOYMENT_ENTITY_GUID`. To see the events, open the browser app in New Relic and look for the markers on its charts or the **Change tracking** view, or run:

```sql
SELECT timestamp, category, type, shortDescription, user FROM ChangeTrackingEvent SINCE 1 week ago
```

GitHub pauses scheduled workflows after 60 days without commits to the repository; re-enable it from the Actions tab if that happens.

All pages share the same browser snippet. If you change Application settings that live in the snippet (for example, CORS allowed origins for tracing), re-copy the snippet into every page.
