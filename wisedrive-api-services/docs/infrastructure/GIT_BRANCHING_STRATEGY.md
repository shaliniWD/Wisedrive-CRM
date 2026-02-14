# Git Branching Strategy

## Branch Structure

All Wisedrive repositories follow the same branching strategy:

```
                          ┌─────────────────┐
                          │      main       │ ──────► PROD
                          │  (protected)    │
                          └────────┬────────┘
                                   │
                                   │ PR (requires approval)
                                   │
                          ┌────────┴────────┐
                          │    staging      │ ──────► TEST
                          │  (protected)    │
                          └────────┬────────┘
                                   │
                                   │ PR (auto-merge on tests pass)
                                   │
                          ┌────────┴────────┐
                          │    develop      │ ──────► DEV
                          │                 │
                          └────────┬────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
     ┌────────┴────────┐  ┌────────┴────────┐  ┌───────┴────────┐
     │  feature/xxx    │  │   bugfix/xxx    │  │  hotfix/xxx    │
     │                 │  │                 │  │                │
     └─────────────────┘  └─────────────────┘  └────────────────┘
```

## Branch Naming Convention

| Branch Type | Pattern | Example | Target |
|-------------|---------|---------|--------|
| Main | `main` | `main` | PROD |
| Staging | `staging` | `staging` | TEST |
| Develop | `develop` | `develop` | DEV |
| Feature | `feature/{ticket}-{description}` | `feature/WD-123-obd-integration` | develop |
| Bugfix | `bugfix/{ticket}-{description}` | `bugfix/WD-456-lead-status-fix` | develop |
| Hotfix | `hotfix/{ticket}-{description}` | `hotfix/WD-789-payment-crash` | main + develop |
| Release | `release/v{version}` | `release/v1.2.0` | staging → main |

## Protected Branch Rules

### `main` Branch (PRODUCTION)

```yaml
protection_rules:
  require_pull_request: true
  required_approvals: 1  # Owner approval required
  required_reviews:
    - platform-lead
  dismiss_stale_reviews: true
  require_status_checks:
    - ci/build
    - ci/test
    - ci/security-scan
    - contract-validation
  require_branches_up_to_date: true
  restrict_push:
    - No direct pushes allowed
    - Only via PR from staging
  require_conversation_resolution: true
  require_signed_commits: false  # Optional
```

### `staging` Branch (TEST)

```yaml
protection_rules:
  require_pull_request: true
  required_approvals: 1
  required_reviews:
    - tech-lead
    - qa-lead
  require_status_checks:
    - ci/build
    - ci/test
    - ci/integration-test
  require_branches_up_to_date: true
  auto_merge: true  # If all checks pass
```

### `develop` Branch (DEV)

```yaml
protection_rules:
  require_pull_request: true
  required_approvals: 1
  require_status_checks:
    - ci/build
    - ci/lint
    - ci/unit-test
  auto_merge: true
```

## Workflow Rules

### ✅ Allowed Workflows

1. **Feature Development**
   ```
   develop → feature/xxx → PR → develop
   ```

2. **Bug Fixes**
   ```
   develop → bugfix/xxx → PR → develop
   ```

3. **Release to TEST**
   ```
   develop → PR → staging (auto-deploy to TEST)
   ```

4. **Release to PROD**
   ```
   staging → PR → main (requires owner approval)
   ```

5. **Hotfixes (Emergency)**
   ```
   main → hotfix/xxx → PR → main (requires approval)
   main → hotfix/xxx → PR → develop (backport)
   ```

### ❌ Prohibited Actions

- Direct push to `main` - **BLOCKED**
- Direct push to `staging` - **BLOCKED**
- Force push to protected branches - **BLOCKED**
- Merge to `main` without approval - **BLOCKED**
- Deploy to PROD without passing all checks - **BLOCKED**
- Skip security scans - **BLOCKED**

## Commit Message Convention

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance

### Examples
```
feat(obd): add DTC trend analytics endpoint

- Added GET /api/obd/analytics/trends endpoint
- Implemented 90-day rolling analysis
- Added unit tests

Closes WD-123
```

```
fix(payment): correct Razorpay signature verification

- Fixed HMAC comparison for webhook signatures
- Added logging for failed verifications

Fixes WD-456
```

## Release Process

### Standard Release (Weekly)

```
1. Create release branch from develop
   git checkout develop
   git pull
   git checkout -b release/v1.2.0

2. Version bump and changelog
   - Update version in package.json / pyproject.toml
   - Update CHANGELOG.md

3. PR to staging
   - Run full test suite
   - QA validation in TEST environment

4. PR to main (PROD)
   - Requires owner approval
   - Final checklist completed
   - Deployment window scheduled

5. Tag release
   git tag -a v1.2.0 -m "Release v1.2.0"
   git push origin v1.2.0

6. Merge back to develop
   git checkout develop
   git merge main
```

### Hotfix Release (Emergency)

```
1. Create hotfix from main
   git checkout main
   git pull
   git checkout -b hotfix/WD-789-critical-fix

2. Fix and test locally

3. PR directly to main
   - Requires approval
   - Emergency review process

4. Deploy to PROD immediately

5. Backport to develop
   git checkout develop
   git merge hotfix/WD-789-critical-fix
```

## Repository-Specific Rules

| Repository | Extra Rules |
|------------|-------------|
| wisedrive-api-contracts | Breaking changes require major version bump |
| wisedrive-api-services | Migration safety check required |
| Mechanic-app-new-v1.0 | Store submission checklist |
| Wisedrive-new-website-v2.0 | SEO audit on release |

## Enforcement

These rules are enforced via:
1. GitHub/GitLab branch protection rules
2. CI/CD pipeline checks
3. Pre-commit hooks
4. Code review checklist
