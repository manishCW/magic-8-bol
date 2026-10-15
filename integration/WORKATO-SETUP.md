# NetSuite → Workato → Warehouse Inbound

## Current state

The application-side receiver is implemented. No Workato workspace has been accessed, no recipe has been created, and no live NetSuite records have been fetched yet. Complete the workspace and network steps below to connect it.

## Connection prerequisites

1. Identify your Workato workspace, the existing NetSuite connection (SOAP or REST), and its approved environment. Reuse appropriate existing permissions; do not modify unrelated recipes.
2. Verify the requested receipt date field ID and line/header behavior. Confirm stable PO internal IDs and stable line IDs (not row positions), eligible statuses, warehouse codes, and UOM conversion.
3. Establish an approved reachable URL or on-prem agent route. Workato cloud cannot access 127.0.0.1 on your Mac. The current UI and CSV endpoints have no user authentication: do not expose the whole local app on the public internet. An approved private route or deployment with UI/API authentication is required.
4. This app's JSON storage supports one server process only. Multi-instance deployment needs a transactional database. On-prem agent must be able to reach the host; the current server binds only to loopback.

## Server settings

Use `.env.example` as the list of required settings. Set `WORKATO_SYNC_TOKEN` to a randomly generated secret of at least 32 characters and `NETSUITE_ACCOUNT_ID` to the exact allowed account/environment. Store local values in ignored `.env.local`, or in deployment secret settings. Restart the app after setting them. Do not share secrets in chat or source control.

Optional `WAREHOUSE_DATA_DIR` selects a separate storage directory; use separate storage for sandbox and production. The endpoint remains disabled (503) until both settings exist.

## Workato recipe outline

1. Start manually in your approved test environment. Add a schedule after a successful reconciliation.
2. Capture `extracted_at` as an ISO timestamp with timezone at the START of extraction and choose a unique `batch_id` for this logical snapshot. Use UTC, e.g. 2026-09-28T20:00:00Z. Retain both on retry.
3. Read ALL eligible PO lines. SOAP: Execute saved search for record, Transaction type, with verified output fields and pagination through Search ID / Page number. REST: test the configured SuiteQL action and its actual output in your workspace before choosing it; query fields must be verified against your account. Workato's current SuiteQL documentation describes output schema inputs but also says no downstream output, so do not assume its data pills without a test. If necessary use an approved REST/custom action that returns the results.
4. Aggregate all pages. Do not send one page as a complete snapshot. Handle source changes during pagination with a consistent extraction strategy or reconciliation; this receiver cannot independently prove the source was complete.
5. Map to `workato-example.json`. `po_internal_id`, `line_id`, and codes must be strings. Quantities must be JSON numbers and closed must be a boolean. Date-only requested dates must remain YYYY-MM-DD without timezone conversion. Unknown warehouses reject the snapshot; missing specifications only warn. The app expects quantities already in the SKU UOM.
6. Set `expected_count` to the complete independently reconciled row count. Set `complete: true` only after every extraction step succeeds. Default `allow_empty: false`; use true only after verifying there really are no eligible PO lines.
7. HTTP Send request: POST `<approved-base-url>/api/integrations/workato/po-sync`, content type application/json, Authorization header `Bearer <secret>` configured securely. Body is the complete mapped JSON snapshot. Configure output schema with duplicate (boolean), batch_id (string), accepted_count (number), warning_count (number, optional), warnings (array, optional), revision (number).
8. Treat a non-2xx response as failure. Explicitly configure retries for transient network/5xx errors using unchanged payload and batch ID. Do not automatically retry validation, authentication, or stale-batch errors.
9. Compare accepted_count and selected PO line values to NetSuite. In the app select NetSuite via Workato under PO source. CSV POs remain separate. Reconcile a partial receipt, date change, and a closed/fully received PO disappearing in the next complete snapshot.

## Behavior and limits

- Maximum request body 2 MB; maximum 10,000 lines. Larger datasets require a staged multi-part protocol, not silently truncated requests.
- Replacing a successful snapshot removes only prior NetSuite lines from this configured account; CSV POs, warehouses, and specifications are preserved.
- Same batch ID plus same content is acknowledged without applying twice. Reusing the ID with changed content returns 409. Last 100 batch receipts are retained; older replays are rejected by extraction timestamp.
- Snapshots must have a strictly later extracted_at than the last accepted snapshot. New batch IDs at the same timestamp are rejected.
- Failed requests preserve the last successful dataset. Workato job history is the failure log; the app displays last successful sync and extraction time.
- Uploading CSVs does not update NetSuite. This integration is inbound only and uses no AI tokens.

## HTTP responses

200 accepted or duplicate; 400 invalid/incomplete data; 401 invalid bearer token; 403 wrong account; 409 stale/conflicting batch; 413 oversized payload; 415 wrong content type; 503 unconfigured; 500 storage error.

## Official references

- https://docs.workato.com/en/connectors/netsuite/execute-saved-search.html
- https://docs.workato.com/en/connectors/netsuite-rest/execute-suiteql-query-action
- https://docs.workato.com/developing-connectors/http/building-http-action

## Alternative for the local practice app: pull from a Workato API recipe

If your workspace includes API Platform, an API recipe can return the same snapshot JSON to an outbound request from the app's backend. This avoids publishing your Mac or installing a new network agent. This outbound app route is not implemented yet; confirm API Platform access and the approved endpoint first.

Recipe outline: New API request → NetSuite extraction and pagination → map the snapshot envelope → Response to API request. Configure a dedicated client application/API key scoped to the recipe collection. Auth Token requests use the `api-token` header (different from this app's inbound Bearer authentication). Keep it server-side. If extraction exceeds the API timeout, use a scheduled snapshot plus a fast retrieval endpoint instead.

https://docs.workato.com/api-mgmt/api-recipes/
https://docs.workato.com/en/api-mgmt/auth-token
