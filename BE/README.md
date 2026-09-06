# WMS APA Nano Backend

Backend service for WMS APA Nano.

Status:

Architecture scaffold only.

Backend framework:
Not finalized.

Database:
Not initialized in this refactor task.

Do not treat this folder as a runnable API. Module directories are domain boundaries only.

## Intended API convention

When a framework is chosen, HTTP routes should live under `/api/v1/`:

- `/api/v1/auth/...`
- `/api/v1/materials/...`
- `/api/v1/inventory/...`
- `/api/v1/inbound/...`
- `/api/v1/outbound/...`
- `/api/v1/quality-control/...`
- `/api/v1/reports/...`

## Module boundaries

- `auth`, `users`, `roles`, `permissions`
- `materials`, `material-categories`, `units`, `suppliers`
- `departments`, `employees`
- `warehouses`, `warehouse-locations`
- `material-lots`
- `inventory`, `inventory-movements`
- `inbound`, `outbound`
- `quality-control`
- `transfers`, `disposals`, `stock-counts`
- `reports`, `notifications`
- `sap-integration`
- `audit-logs`
- `ai/warehouse-assistant`
- `ai/invoice-ocr`
- `ai/demand-forecast`
- `ai/inventory-health`
- `ai/expiry-risk`

## Shared layout

- `src/config` — configuration
- `src/database` — persistence (not initialized)
- `src/infrastructure` — adapters (HTTP, SAP, queues)
- `src/shared` — cross-module types/utilities
- `migrations/` — schema migrations (not initialized)
- `scripts/` — operational scripts
- `tests/` — backend tests
