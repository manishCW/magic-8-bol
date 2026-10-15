# Slack alerts — Magic 8 BOL

Destination: `#test-magic-8-bol`.

Saved recipe: https://app.workato.com/recipes/83065689

Recipe: New API request (JSON `text`) → existing Slack connection, Post message to `test-magic-8-bol`, Basic text mapped from request `Text` → Return 200 OK. It remains inactive until an admin publishes and tests it. Existing NetSuite recipe is unchanged.

## Workato administrator

1. Publish this recipe as an authenticated **POST** endpoint (suggested path `/slack-alerts`). The current user can view API collections but has no Add endpoint control.
2. Use a dedicated API client/access profile scoped to this alert endpoint/collection under company policy. Do not refresh a shared existing token. If collection-level permissions would grant unintended access, use a dedicated collection.
3. Confirm the existing Slack connection can post to the test channel. Invite its Workato app/connection identity if required, particularly for a private channel.
4. Start the recipe and activate the endpoint. Securely provide the endpoint URL and Auth Token to the app operator. Do not place tokens in recipe text, chat, source control or screenshots.
5. Request body: `{"text":"Magic 8 BOL — connection test. No action required."}`. Success should return HTTP 200 only after the Slack action succeeds.

## Local app operator

Set server-only `WORKATO_SLACK_ALERT_URL` and `WORKATO_SLACK_ALERT_TOKEN` in `.env.local`, then restart the server. The implementation uses the API Platform `api-token` header, not the Workato Developer API Bearer token. See https://docs.workato.com/api-mgmt/calling-apis.

Open `/integrations`, send **connection test**, and verify both Workato job success and receipt in the intended Slack channel. Then review a date’s preview and send its receiving summary. No scheduling is enabled yet. The local app must be running to send; other computers cannot use a localhost app link.

Summaries use saved data, requested dates, outstanding quantities and existing SKU calculation functions. Demo data is labelled. Forecast dates are excluded explicitly. Missing SKU estimates are reported, not treated as complete zero-valued data. Goods weight excludes pallet tare.

The send API is limited to the same-origin localhost UI because the app does not yet have user authentication. Add authenticated operator access before enabling this capability on a shared deployment. No endpoint URL or secret is accepted from the browser or returned by the status API. The destination host is restricted to `apim.workato.com` and redirects are disabled.

One summary per selected date is recorded in `.data/warehouse.json`, with a one-minute send cooldown. This assumes the existing single-process data store. A timeout may occur after Slack receives a message: check Workato job history before retrying. Exactly-once delivery across crashes requires downstream idempotency and is not claimed here.

Remaining choices for recurring alerts: schedule/time zone, receiving locations, heavy-day pallet threshold and overdue digest cadence. Configure only after the first verified test; do not use a browser refresh as a scheduler.
