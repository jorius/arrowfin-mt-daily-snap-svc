# Security and PII — Trader Daily Snapshot

Canonical security writeup for the assessment. The frontend repository has a short
companion [SECURITY.md](https://github.com/jorius/arrowfin-mt-daily-snap-fe/blob/main/SECURITY.md)
covering client-side concerns.

Legend: ✍️ written by the candidate · 🤖 drafted from the code with an LLM, reviewed
by the candidate. Every claim below should point at a file and line.

## 1. Auth model 🤖✍️

_How does the frontend authenticate to the REST endpoint? How does the WebSocket
authenticate? What stops a logged-in trader from one tenant from subscribing to
another tenant's stream?_

- **Issuing a key.** `POST /auth/api/key` verifies the trader's secret against a
  scrypt hash in `trader_credentials`, refuses suspended traders, and issues an opaque
  `afk_…` key whose sha256 is stored in `api_keys` together with the `broker_id`
  resolved server-side from the trader row.
- **REST.** `Authorization: Bearer afk_…`; the guard hashes the key, loads the row,
  and attaches `Principal { traderId, brokerId }`. Nothing in the request can change
  the principal.
- **WebSocket.** The handshake carries the same key; a server-side middleware
  verifies it once before the connection is accepted and joins the socket only to
  rooms derived from the principal's own accounts. There is no subscribe message.
- **Why opaque keys instead of JWT.** _(revocation, no signing-key management, one
  indexed lookup per request; trade-off: a DB hit per request, Redis in production)_

## 2. Tenant isolation 🤖✍️

_Where in the code is tenant isolation enforced? If someone forgets a
`WHERE broker_id = ?` six months from now, what catches it?_

1. Guard — the principal comes only from the `api_keys` row.
2. Application — every repository port method takes `TenantContext` as its first
   argument; the data layer cannot be called without naming the tenant.
3. Repositories — every Prisma query includes `brokerId` from the context.
4. Schema — `broker_id` is denormalized onto `accounts`, `fills` and `api_keys` with
   composite foreign keys, so a row cannot disagree with its parent's tenant.
5. Tests — a cross-tenant account id returns 404, a missing key returns 401.
6. _(Row-level security, if shipped: policies on `current_setting('app.broker_id')`,
   `FORCE ROW LEVEL SECURITY`, `SET LOCAL` per transaction.)_

## 3. PII handling 🤖✍️

_What was considered sensitive, what was logged vs. redacted, and what changes if
the data is stored in the DB vs. flowing through the WebSocket._

- **Sensitive:** everything on `traders` except `id`, `broker_id`, `kyc_status`,
  `created_at`; the free-text `notes` and `audit_notes` (bank details, national IDs,
  KYC document paths, compliance cases); `accounts.balance`; trader secrets and API
  keys.
- **Logged:** _
- **Redacted / never selected:** _
- **DB vs. socket:** _

## 4. One vulnerability I didn't introduce 🤖✍️

_Pick a specific class of bug and show the line of code or design choice that
prevented it._

- Class: _ (candidate: IDOR on `/accounts/:accountId/snapshot` — compare with the
  Task 4 PR)
- The line: _

## 5. What I'd do in production but didn't ✍️

_One paragraph. Be specific._

_

## 6. Development-only fill simulator 🤖

_How the `POST /dev/fills` endpoint is guaranteed not to run in production._

The module is only added to `AppModule.imports` when `DEV_FILLS_ENABLED === 'true'`
**and** `NODE_ENV !== 'production'`. In production the route does not exist; there is
no guard to misconfigure. The fill's `broker_id` is derived from the account row, never
from the request body, and the event is emitted only to that account's room.

## Reporting

This is an assessment repository. There is no production deployment to report
against; questions go to the repository owner.
