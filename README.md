# Magic 8 BOL

Location Control Tower prototype for planning inbound purchase orders and transfer orders. Includes receiving workload summaries, a delivery calendar, pallet and goods-weight estimates, data-quality drill-downs, CSV imports, and historical PO arrival forecasts.

## Run locally

Use Node.js 24 (matching the Docker image).

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. For a production build:

```sh
npm test
npm run build
npm start
```

## Data and credentials

The application stores imported records and local integration configuration in `.data/`, which is deliberately excluded from this repository. The uploaded source does not include the developer's PO, TO, SKU, location, or receipt-history imports, credentials, or demo videos. A new checkout uses the application's built-in sample baseline until data is imported.

Use Data setup to import location, SKU, order, and receipt-history files. Use the provided templates for current field requirements. The app estimates remaining workload after received quantities and excludes empty-pallet weight. Missing specifications remain visible as data-quality issues.

Copy `.env.example` to `.env.local` when environment-based configuration is needed. Keep all tokens server-side. The Workato NetSuite and Slack setup guides are in `integration/`. A configured integration or UI status is not proof that a live sync has succeeded. ASN inbox connectivity requires implementation/configuration beyond its prototype presentation.

## Deployment

`Dockerfile` builds the application, runs its tests, and serves on port 8080. Runtime data is stored in `/data`; persistent storage is needed to retain imported records across container replacements. `helm/` and `deployment/` contain deployment scaffolding that must be reviewed for the target environment. The build workflow is supplied as a reference under `deployment/`, not activated in `.github/workflows/`.

This prototype uses local JSON persistence and a single-process write queue. It is not a production multi-user database or a complete authentication/authorization system. Forecasts are statistical estimates, not confirmed delivery commitments.

## Main source areas

- `app/`: overview, calendar, data setup, forecasts, integration UI and API routes.
- `lib/`: import validation, calculations, persistence, forecasting and integration clients.
- `public/`: logo and visual assets.
- `integration/`: NetSuite SuiteQL and Workato/Slack setup references.

Run business-rule tests with `npm test`.
