# Remove optional analytics from the book sales page

2026-10-01, user request: remove the statistics consent UI; visitor analytics may be omitted.

- Removed the consent banner, cookie settings button and optional measurement explanation from `/ai-book`.
- Removed GA4, Meta Pixel, Clarity script loading, custom event requests, engagement timers, section/scroll tracking and campaign identifier persistence from the book storefront script.
- New orders explicitly send analytics_consent=false, marketing_consent=false, session_id=null and empty campaign attribution. Necessary checkout draft, idempotency and order status storage remain.
- Retained the explanation of how fulfillment data is used. Other site pages, existing analytics history, sales records and staff dashboards are not changed.
- Browser checks: banner/settings absent, only storefront/media scripts loaded, bundle totals and COD/transfer toggling work, address autocomplete works, no browser errors. JavaScript syntax and git diff checks pass. No test orders submitted.
