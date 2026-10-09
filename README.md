# BrowserLogsDemo

Self-serve demo pages for the New Relic browser agent (Pro+SPA). Each visitor gets a session code so they can find their own data in a shared account.

- [Logs demo](https://mcaronnewrelic.github.io/BrowserLogsDemo/) (`index.html`): console auto-logging, `newrelic.log()`, `newrelic.wrapLogger()`, and how log verbosity filters events.
- [Errors demo](https://mcaronnewrelic.github.io/BrowserLogsDemo/errors.html) (`errors.html`): uncaught errors and promise rejections, `newrelic.noticeError()`, `newrelic.setErrorHandler()` for ignoring and grouping, `newrelic.addRelease()`, and how errors relate to ERROR logs.
