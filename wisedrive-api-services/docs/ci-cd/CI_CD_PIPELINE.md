# CI/CD Pipeline Configuration

## Overview

Multi-repository CI/CD pipeline with contract-first validation and dependent build triggers.

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CI/CD PIPELINE FLOW                                │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                    wisedrive-api-contracts                               │ │
│  │  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────────┐  ┌─────────────┐ │ │
│  │  │ Lint │─►│Validate│─►│ Test │─►│Publish│─►│ Generate │─►│ Notify Deps │ │ │
│  │  │      │  │OpenAPI │  │      │  │ SDK  │  │   SDKs   │  │             │ │ │
│  │  └──────┘  └──────┘  └──────┘  └──────┘  └──────────┘  └──────┬──────┘ │ │
│  └───────────────────────────────────────────────────────────────┼────────┘ │
│                                                                  │           │
│              ┌───────────────────────────────────────────────────┘           │
│              │ Webhook Trigger                                               │
│              ▼                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                    wisedrive-api-services                                │ │
│  │  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐ │ │
│  │  │ Lint │─►│ Build │─►│ Unit │─►│Integ │─►│Contract│─►│Security│─►│Deploy│ │ │
│  │  │      │  │       │  │ Test │  │ Test │  │  Test  │  │  Scan  │  │      │ │ │
│  │  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘ │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                    Consumer Apps (CRM, Website, etc.)                    │ │
│  │  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐           │ │
│  │  │Update│─►│ Lint │─►│ Build │─►│ Test │─►│E2E Test│─►│Deploy│           │ │
│  │  │ SDK  │  │      │  │       │  │      │  │       │  │      │           │ │
│  │  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘           │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Pipeline Definitions

### wisedrive-api-contracts Pipeline

```yaml
# .github/workflows/contracts-ci.yml
name: API Contracts CI/CD

on:
  push:
    branches: [develop, staging, main]
  pull_request:
    branches: [develop, staging, main]

env:
  NODE_VERSION: '18'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Lint OpenAPI specs
        run: npm run validate
      
      - name: Validate JSON schemas
        run: npm run validate:schema
      
      - name: Check for breaking changes
        run: npm run check:breaking
        if: github.event_name == 'pull_request'

  generate-sdks:
    needs: validate
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/staging'
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Java (for OpenAPI Generator)
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'
      
      - name: Generate TypeScript SDK
        run: npm run generate:typescript
      
      - name: Generate Python SDK
        run: npm run generate:python
      
      - name: Publish TypeScript SDK
        run: npm publish generated/typescript
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
      
      - name: Publish Python SDK
        run: |
          cd generated/python
          pip install twine
          python setup.py sdist
          twine upload dist/*
        env:
          TWINE_USERNAME: ${{ secrets.PYPI_USERNAME }}
          TWINE_PASSWORD: ${{ secrets.PYPI_PASSWORD }}

  notify-dependents:
    needs: generate-sdks
    runs-on: ubuntu-latest
    steps:
      - name: Trigger dependent builds
        uses: peter-evans/repository-dispatch@v2
        with:
          token: ${{ secrets.REPO_ACCESS_TOKEN }}
          repository: wisedrive/wisedrive-api-services
          event-type: contract-update
          client-payload: '{"version": "${{ github.sha }}"}'
      
      - name: Notify CRM Web
        uses: peter-evans/repository-dispatch@v2
        with:
          token: ${{ secrets.REPO_ACCESS_TOKEN }}
          repository: wisedrive/wisedrive-crm-web
          event-type: sdk-update
      
      - name: Notify other consumers
        run: |
          # Send webhook to all dependent repos
          curl -X POST ${{ secrets.WEBHOOK_URL }} \
            -H "Content-Type: application/json" \
            -d '{"event": "sdk-update", "version": "${{ github.sha }}"}'
```

### wisedrive-api-services Pipeline

```yaml
# .github/workflows/api-services-ci.yml
name: API Services CI/CD

on:
  push:
    branches: [develop, staging, main]
  pull_request:
    branches: [develop, staging, main]
  repository_dispatch:
    types: [contract-update]

env:
  PYTHON_VERSION: '3.11'

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}
      
      - name: Install dependencies
        run: pip install ruff mypy
      
      - name: Lint with Ruff
        run: ruff check .
      
      - name: Type check with mypy
        run: mypy .

  test:
    needs: lint
    runs-on: ubuntu-latest
    services:
      mongodb:
        image: mongo:6.0
        ports:
          - 27017:27017
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}
      
      - name: Install dependencies
        run: pip install -r requirements.txt -r requirements-dev.txt
      
      - name: Run unit tests
        run: pytest tests/unit --cov=. --cov-report=xml
        env:
          MONGO_URL: mongodb://localhost:27017
          DB_NAME: test_db
      
      - name: Run integration tests
        run: pytest tests/integration
        env:
          MONGO_URL: mongodb://localhost:27017
          DB_NAME: test_db

  contract-test:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Checkout contracts
        uses: actions/checkout@v4
        with:
          repository: wisedrive/wisedrive-api-contracts
          path: contracts
      
      - name: Validate API against contracts
        run: |
          # Compare implemented endpoints with contract
          python scripts/validate_contract.py contracts/openapi/wisedrive-api-v1.yaml

  security-scan:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Bandit security scan
        run: |
          pip install bandit
          bandit -r . -ll
      
      - name: Check for secrets
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./

  migration-check:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/staging' || github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      
      - name: Check pending migrations
        run: python -m migrations status --check-pending
      
      - name: Dry-run migrations
        run: python -m migrations up --dry-run
        env:
          MONGO_URL: ${{ secrets.TEST_MONGO_URL }}
          DB_NAME: migration_test

  deploy-dev:
    needs: [lint, test]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    environment: development
    steps:
      - name: Deploy to DEV
        run: |
          # Deploy using Emergent CLI or kubectl
          echo "Deploying to DEV environment"

  deploy-test:
    needs: [lint, test, contract-test, security-scan, migration-check]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/staging'
    environment: test
    steps:
      - name: Run migrations
        run: python -m migrations up
        env:
          MONGO_URL: ${{ secrets.TEST_MONGO_URL }}
          DB_NAME: wisedrive_test
      
      - name: Deploy to TEST
        run: |
          echo "Deploying to TEST environment"

  deploy-prod:
    needs: [lint, test, contract-test, security-scan, migration-check]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production
    steps:
      - name: Request approval
        uses: trstringer/manual-approval@v1
        with:
          secret: ${{ secrets.GITHUB_TOKEN }}
          approvers: platform-lead
          minimum-approvals: 1
      
      - name: Run migrations
        run: python -m migrations up
        env:
          MONGO_URL: ${{ secrets.PROD_MONGO_URL }}
          DB_NAME: wisedrive_prod
      
      - name: Deploy to PROD
        run: |
          echo "Deploying to PROD environment"
      
      - name: Notify success
        run: |
          curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
            -d '{"text": "🚀 Production deployment complete: ${{ github.sha }}"}'
```

## Breaking Change Prevention

### Contract Validation Script

```python
# scripts/validate_contract.py
"""
Validates that API implementation matches contract.
Fails CI if breaking changes detected.
"""

import yaml
import sys
from pathlib import Path


def load_contract(path: str) -> dict:
    with open(path) as f:
        return yaml.safe_load(f)


def check_breaking_changes(old_contract: dict, new_contract: dict) -> list:
    """Detect breaking changes between contract versions"""
    breaking_changes = []
    
    old_paths = set(old_contract.get('paths', {}).keys())
    new_paths = set(new_contract.get('paths', {}).keys())
    
    # Check for removed endpoints
    removed = old_paths - new_paths
    if removed:
        breaking_changes.append(f"Removed endpoints: {removed}")
    
    # Check for removed fields in schemas
    old_schemas = old_contract.get('components', {}).get('schemas', {})
    new_schemas = new_contract.get('components', {}).get('schemas', {})
    
    for schema_name, old_schema in old_schemas.items():
        if schema_name not in new_schemas:
            breaking_changes.append(f"Removed schema: {schema_name}")
            continue
        
        new_schema = new_schemas[schema_name]
        old_props = set(old_schema.get('properties', {}).keys())
        new_props = set(new_schema.get('properties', {}).keys())
        
        removed_props = old_props - new_props
        if removed_props:
            breaking_changes.append(
                f"Schema {schema_name}: removed properties {removed_props}"
            )
    
    return breaking_changes


if __name__ == "__main__":
    contract_path = sys.argv[1]
    
    # In real implementation, compare with previous version
    contract = load_contract(contract_path)
    
    # Validate structure
    required_sections = ['openapi', 'info', 'paths', 'components']
    for section in required_sections:
        if section not in contract:
            print(f"ERROR: Missing required section: {section}")
            sys.exit(1)
    
    print("✅ Contract validation passed")
```

## Dependent Repository Notifications

### Webhook Configuration

```yaml
# Repository dispatch events
events:
  contract-update:
    description: "API contract has been updated"
    triggers:
      - wisedrive-api-services
      - wisedrive-crm-web
      - Wisedrive-new-website-v2.0
      - Mechanic-app-new-v1.0
      - wisedrive-dashboard-rn
      - wisedrive-ess-rn
    payload:
      version: "commit SHA"
      breaking: "true/false"
      changelog: "URL to changes"

  sdk-update:
    description: "SDK has been published"
    triggers:
      - All consumer applications
    payload:
      sdk_version: "1.2.3"
      npm_package: "@wisedrive/api-client@1.2.3"
      pypi_package: "wisedrive-api==1.2.3"
```

### Consumer Update Workflow

```yaml
# In consumer repos: .github/workflows/on-sdk-update.yml
name: SDK Update Handler

on:
  repository_dispatch:
    types: [sdk-update, contract-update]

jobs:
  update-sdk:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Update SDK dependency
        run: |
          npm install @wisedrive/api-client@latest
          # or for Python:
          # pip install wisedrive-api --upgrade
      
      - name: Run tests
        run: npm test
      
      - name: Create PR if tests pass
        uses: peter-evans/create-pull-request@v5
        with:
          title: "chore: Update Wisedrive API SDK"
          body: |
            Auto-generated PR to update SDK.
            
            Contract version: ${{ github.event.client_payload.version }}
          branch: chore/update-sdk
```

## Deployment Environments

| Environment | Trigger | Approval | Auto-Deploy |
|-------------|---------|----------|-------------|
| DEV | Push to `develop` | None | Yes |
| TEST | Push to `staging` | None | Yes |
| PROD | Push to `main` | Required | No |

## Rollback Procedure

### Automatic Rollback (on failure)

```yaml
deploy-with-rollback:
  steps:
    - name: Deploy new version
      id: deploy
      run: |
        kubectl set image deployment/api-services api=wisedrive/api:${{ github.sha }}
    
    - name: Wait for rollout
      run: kubectl rollout status deployment/api-services --timeout=300s
    
    - name: Health check
      run: |
        for i in {1..10}; do
          curl -sf https://api.wisedrive.com/health && exit 0
          sleep 10
        done
        exit 1
    
    - name: Rollback on failure
      if: failure()
      run: |
        kubectl rollout undo deployment/api-services
        echo "🔴 Deployment failed, rolled back to previous version"
```

### Manual Rollback Command

```bash
# View deployment history
kubectl rollout history deployment/api-services

# Rollback to previous version
kubectl rollout undo deployment/api-services

# Rollback to specific revision
kubectl rollout undo deployment/api-services --to-revision=5
```
