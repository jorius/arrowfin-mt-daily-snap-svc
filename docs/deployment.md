# Deployment

Two hosted environments on Railway plus one Netlify site for the widget. Both Railway
environments build from the same `main` branch; they exist to keep data, secrets and
configuration isolated, not to run different code.

| Environment | Role | Backend URL | Postgres | `NODE_ENV` | `CORS_ORIGIN` | Dev fills |
| --- | --- | --- | --- | --- | --- | --- |
| `staging` | The public demo; plays the production role for this assessment | `https://arrowfin-mt-daily-snap-svc-staging.up.railway.app` | own instance + volume | `staging` | `https://arrowfin-mt-daily-snap.netlify.app` | enabled |
| `development` | Isolated sandbox for local frontend work and experiments | `https://arrowfin-mt-daily-snap-svc-development.up.railway.app` | own instance + volume | `development` | `http://localhost:3000` | enabled |

Frontend: Netlify site `arrowfin-mt-daily-snap` (`https://arrowfin-mt-daily-snap.netlify.app`),
built from `main` of `arrowfin-mt-daily-snap-fe` with `NEXT_PUBLIC_API_URL` and
`NEXT_PUBLIC_WS_URL` pointing at the staging backend.

## Why the dev fill simulator is on in both hosted environments

`POST /dev/fills` is the only way to demonstrate the live WebSocket path without a market
data feed. It is registered only when `DEV_FILLS_ENABLED=true` **and** `NODE_ENV` is not
`production` (`src/infrastructure/config/env.ts`). Neither hosted environment is
`production`; a real production environment would set `NODE_ENV=production`, which makes
the flag inert regardless of its value. That guarantee is in code, not in configuration.

## Service configuration

- Railway project "ArrowFin Daily Snapshot"; service `arrowfin-mt-daily-snap-svc` built with
  Nixpacks from `railway.json`: build `npm ci && npm run build` (which runs
  `prisma generate`), start `npx prisma migrate deploy && npm run start:prod`, health check
  `/health`, restart on failure.
- Variables per environment: `DATABASE_URL=${{Postgres.DATABASE_URL}}` (private network),
  `NODE_ENV`, `CORS_ORIGIN`, `SNAPSHOT_NOW=2026-08-25T14:30:00Z`, `API_KEY_TTL_HOURS=12`,
  `DEV_FILLS_ENABLED=true`, and the optional Socket.IO heartbeat trio `WS_PING_INTERVAL_MS`,
  `WS_PING_TIMEOUT_MS`, `WS_CONNECT_TIMEOUT_MS` (defaults 25000 / 20000 / 45000 when unset).
  `SWAGGER_ENABLED` is left at its default (`true`): both hosted environments expose `/docs`
  because neither is `NODE_ENV=production`. `PORT` is injected by Railway.
- Deployments were uploaded with `railway up --environment <env>` from a clean checkout.
  Connecting the GitHub repository for push-to-deploy requires granting the Railway GitHub
  app access to the private repository.

## Seeding a hosted database

The CSVs never leave the operator's machine. Each Postgres has a TCP proxy; migrations and
the seed run from the operator's checkout against the proxy:

```bash
export DATABASE_URL='postgresql://postgres:<PGPASSWORD>@<proxy-host>:<proxy-port>/railway?sslmode=no-verify'
npx prisma migrate deploy
DATASET_DIR=../dataset npm run seed
mv .local/trader-secrets.json .local/trader-secrets.<env>.json
```

The seed generates a random secret per trader and writes them to
`.local/trader-secrets.<env>.json` (ignored by git). Demo credentials for the reviewer are
shared out of band, never through the repository or the README.

## Smoke test

```bash
BASE=https://arrowfin-mt-daily-snap-svc-staging.up.railway.app
curl -s $BASE/health
KEY=$(curl -s -X POST $BASE/auth/api/key -H 'content-type: application/json' \
  -d '{"traderId":"T-005","secret":"<secret>"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).apiKey')
curl -s $BASE/me/accounts -H "authorization: Bearer $KEY"
curl -s $BASE/accounts/ACC-1006/snapshot -H "authorization: Bearer $KEY"
curl -s -o /dev/null -w '%{http_code}\n' $BASE/accounts/ACC-1011/snapshot -H "authorization: Bearer $KEY"   # 404: Meridian account
```
