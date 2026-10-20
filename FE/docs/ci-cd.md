# CI / CD

## FE CI

Workflow: `.github/workflows/ci.yml` (`FE CI`)

Triggers:

- `pull_request` → `develop`
- `push` → `develop`

Jobs:

| Job | Purpose |
| --- | --- |
| `lint` | `pnpm lint` |
| `typecheck` | `pnpm typecheck` |
| `build` | `pnpm build` with demo-safe `NEXT_PUBLIC_*` values |
| `sonar` | SonarQube Cloud analysis + Quality Gate wait |

Runtime:

- Node.js `24`
- pnpm `11.22.0` (`packageManager` / CI pin)

## SonarQube Cloud

SonarQube is **hosted** (SonarQube Cloud). There is no local SonarQube server.

The scanner runs on **GitHub-hosted Actions** and uploads results to SonarQube Cloud.

### Identifiers

Configured in `sonar-project.properties`:

- `sonar.projectKey` = `huynguyen12536_APA_Nano_FE`
- `sonar.organization` = `huynguyen12536`

Dashboard: https://sonarcloud.io/dashboard?id=huynguyen12536_APA_Nano_FE

### Authentication

GitHub repository secret (Actions):

| Name | Purpose |
| --- | --- |
| `SONAR_TOKEN` | Authenticates the scanner to SonarQube Cloud |

Create/update:

GitHub → `APA_Nano_FE` → Settings → Secrets and variables → Actions → New repository secret

Never commit the token, put it in `.env`, or print it in logs.

### Sonar CI job

Job check name: **`sonar`**

- `actions/checkout` with `fetch-depth: 0` (required for PR/branch analysis)
- `pnpm install --frozen-lockfile`
- Official action: `SonarSource/sonarqube-scan-action@v8`
- Quality Gate: `-Dsonar.qualitygate.wait=true`
- On Quality Gate failure the job exits non-zero (no `continue-on-error`)

### Coverage

CI does **not** generate `coverage/lcov.info`.

LCOV is intentionally not configured. Do not add fake coverage paths.

### Automatic Analysis

If Automatic Analysis is enabled in SonarQube Cloud, disable it before relying on CI-based analysis, otherwise analyses can duplicate.

SonarQube Cloud → Project → Administration → Analysis Method → use **CI-based analysis**.

### Branch protection follow-up

After the `sonar` check appears on a PR:

GitHub → `APA_Nano_FE` → Settings → Rules → Rulesets → Protect `develop` → Require status checks to pass → add **`sonar`**

Use the exact check name shown in GitHub Actions (expected: `sonar`).

## FE CD

Workflow: `.github/workflows/cd.yml` (`FE CD`)

Triggered by semantic release tags `v*.*.*`. Publishes Docker images to GHCR. See that workflow for publish details.
