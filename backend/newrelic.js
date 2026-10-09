'use strict';
// New Relic Node.js agent config. Secrets come from environment variables only;
// never commit a license key to this repo (it is published by GitHub Pages).
exports.config = {
  app_name: [process.env.NEW_RELIC_APP_NAME || 'BrowserLogsDemo API'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY,
  distributed_tracing: { enabled: true },
  logging: { level: process.env.NEW_RELIC_LOG_LEVEL || 'info', filepath: 'stdout' },
  allow_all_headers: true,
  attributes: {
    exclude: [
      'request.headers.cookie',
      'request.headers.authorization',
      'request.headers.proxyAuthorization',
      'request.headers.setCookie*',
      'request.headers.x*',
      'response.headers.cookie',
      'response.headers.authorization',
      'response.headers.proxyAuthorization',
      'response.headers.setCookie*',
      'response.headers.x*'
    ]
  }
};
