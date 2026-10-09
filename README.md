# BrowserLogsDemo

Self-serve demo pages for the New Relic browser agent (Pro+SPA). Each visitor gets a session code so they can find their own data in a shared account.

- [Logs demo](https://mcaronnewrelic.github.io/BrowserLogsDemo/) (`index.html`): console auto-logging, `newrelic.log()`, `newrelic.wrapLogger()`, and how log verbosity filters events.
- [Errors demo](https://mcaronnewrelic.github.io/BrowserLogsDemo/errors.html) (`errors.html`): uncaught errors and promise rejections, `newrelic.noticeError()`, `newrelic.setErrorHandler()` for ignoring and grouping, `newrelic.addRelease()`, and how errors relate to ERROR logs.
- [Tracing demo](https://mcaronnewrelic.github.io/BrowserLogsDemo/tracing.html) (`tracing.html`): distributed tracing from the browser. It shows the `traceparent`, `tracestate` and `newrelic` headers the agent adds to each request, and builds a query from your own trace IDs. It runs browser-only out of the box (using `data/*.json`) and becomes full stack when connected to the APM-instrumented API in [`backend/`](backend/README.md).

- [Core Web Vitals demo](https://mcaronnewrelic.github.io/BrowserLogsDemo/vitals.html) (`vitals.html`): makes LCP (a slow hero image), CLS (late banners) and INP (blocking click handlers) good or poor on purpose, with a live scorecard. Results land in `PageViewTiming`, tagged with `demoCode`, `lcpMode` and `clsMode`.

All pages share the same browser snippet. If you change Application settings that live in the snippet (for example, CORS allowed origins for tracing), re-copy the snippet into every page.
