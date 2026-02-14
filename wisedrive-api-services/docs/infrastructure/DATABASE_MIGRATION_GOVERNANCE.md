# Database Migration Governance

## Overview

All database schema changes are managed through version-controlled migrations with mandatory safety checks before production deployment.

## Migration Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    MIGRATION LIFECYCLE                           │
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │ Create   │───►│ Test in  │───►│ Test in  │───►│ Apply to │  │
│  │ Migration│    │ DEV      │    │ TEST     │    │ PROD     │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│       │               │               │               │         │
│       ▼               ▼               ▼               ▼         │
│  Version in      Auto-run on    Auto-run on    Manual trigger  │
│  migrations/     DEV deploy     TEST deploy    with approval   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Migration File Structure

```
wisedrive-api-services/
└── migrations/
    ├── __init__.py           # Migration manager
    └── versions/
        ├── 001_add_employment_status.py
        ├── 002_add_multi_role_support.py
        ├── 003_create_obd_sessions.py
        ├── 004_add_exit_fields.py
        └── ...
```

## Migration File Template

```python
"""
Migration: {VERSION} - {DESCRIPTION}
Created: {DATE}
Author: {AUTHOR}

Changes:
- {CHANGE_1}
- {CHANGE_2}

Rollback:
- {ROLLBACK_STEP_1}
- {ROLLBACK_STEP_2}

Impact:
- Collections affected: {COLLECTIONS}
- Estimated time: {TIME}
- Downtime required: {YES/NO}
"""

from migrations import migration


@migration("{VERSION}", "{DESCRIPTION}")
class Migration{VERSION}:
    
    # Safety checks before running
    SAFETY_CHECKS = {
        "backup_required": True,
        "downtime_required": False,
        "estimated_duration_seconds": 30,
        "affected_collections": ["users"],
        "breaking_change": False,
    }
    
    @staticmethod
    async def up(db):
        """Apply migration"""
        # Add new field with default value
        await db.users.update_many(
            {"new_field": {"$exists": False}},
            {"$set": {"new_field": "default_value"}}
        )
        
        # Create index
        await db.users.create_index("new_field")
    
    @staticmethod
    async def down(db):
        """Rollback migration"""
        # Remove field
        await db.users.update_many(
            {},
            {"$unset": {"new_field": ""}}
        )
        
        # Drop index
        await db.users.drop_index("new_field_1")
    
    @staticmethod
    async def validate(db):
        """Validate migration was successful"""
        # Check all documents have new field
        count_without = await db.users.count_documents(
            {"new_field": {"$exists": False}}
        )
        return count_without == 0
```

## Rollback Mechanism

### Automatic Rollback Triggers

```python
class MigrationRunner:
    
    async def run_migration(self, migration):
        """Run migration with automatic rollback on failure"""
        
        # 1. Pre-flight checks
        if not await self._pre_flight_checks(migration):
            raise MigrationError("Pre-flight checks failed")
        
        # 2. Create backup point
        backup_id = await self._create_backup()
        
        try:
            # 3. Run migration
            await migration.up(self.db)
            
            # 4. Validate
            if hasattr(migration, 'validate'):
                if not await migration.validate(self.db):
                    raise MigrationError("Validation failed")
            
            # 5. Record success
            await self._record_migration(migration, backup_id)
            
        except Exception as e:
            # 6. Automatic rollback
            logger.error(f"Migration failed: {e}")
            
            if hasattr(migration, 'down'):
                await migration.down(self.db)
            else:
                await self._restore_backup(backup_id)
            
            raise
```

### Manual Rollback Command

```bash
# Rollback specific migration
python -m migrations rollback --version 004

# Rollback to specific version
python -m migrations rollback --to-version 002

# Rollback last N migrations
python -m migrations rollback --last 2
```

### Rollback Safety Rules

| Scenario | Action |
|----------|--------|
| Migration has `down()` method | Execute `down()` |
| Migration has no `down()` method | Restore from backup |
| Rollback fails | Alert on-call, manual intervention |
| Data loss risk | Require explicit confirmation |

## Environment-Specific Execution

### DEV Environment
```yaml
migration_policy:
  trigger: automatic
  on_event: deploy
  approval_required: false
  backup_required: false
  rollback_on_fail: true
```

### TEST Environment
```yaml
migration_policy:
  trigger: automatic
  on_event: deploy
  approval_required: false
  backup_required: true
  rollback_on_fail: true
  notify_on_complete: qa-team
```

### PROD Environment
```yaml
migration_policy:
  trigger: manual
  approval_required: true
  approvers:
    - platform-lead
    - dba
  backup_required: true
  backup_type: full_snapshot
  rollback_on_fail: true
  maintenance_window: true
  notify_channels:
    - ops-team
    - platform-team
```

## Production Migration Checklist

Before running any migration in PROD:

### Pre-Migration
- [ ] Migration tested in DEV
- [ ] Migration tested in TEST
- [ ] Rollback tested in TEST
- [ ] Backup created and verified
- [ ] Maintenance window scheduled
- [ ] Stakeholders notified
- [ ] Rollback plan documented
- [ ] DBA review completed
- [ ] Platform lead approval obtained

### During Migration
- [ ] Monitor application logs
- [ ] Monitor database metrics
- [ ] Track migration progress
- [ ] Keep rollback ready

### Post-Migration
- [ ] Validate data integrity
- [ ] Verify application functionality
- [ ] Check performance metrics
- [ ] Close maintenance window
- [ ] Update documentation
- [ ] Notify stakeholders

## Safety Checks

### Pre-Flight Safety Checks

```python
async def pre_flight_checks(migration) -> bool:
    """Run safety checks before migration"""
    
    checks = migration.SAFETY_CHECKS
    
    # 1. Check backup exists (if required)
    if checks.get("backup_required"):
        if not await verify_backup_exists():
            logger.error("Backup required but not found")
            return False
    
    # 2. Check maintenance window (if required)
    if checks.get("downtime_required"):
        if not is_maintenance_window():
            logger.error("Migration requires maintenance window")
            return False
    
    # 3. Check dependent migrations applied
    dependencies = checks.get("depends_on", [])
    for dep in dependencies:
        if not await is_migration_applied(dep):
            logger.error(f"Dependency {dep} not applied")
            return False
    
    # 4. Check estimated duration is acceptable
    duration = checks.get("estimated_duration_seconds", 0)
    if duration > MAX_MIGRATION_DURATION:
        logger.error(f"Migration too long: {duration}s")
        return False
    
    return True
```

### Breaking Change Detection

```python
BREAKING_CHANGES = [
    "removing a field",
    "changing field type",
    "renaming a field",
    "removing an index",
    "changing unique constraints",
]

def detect_breaking_changes(migration):
    """Detect if migration contains breaking changes"""
    # Analyze migration code for breaking patterns
    # Flag for additional review if detected
    pass
```

## Migration Commands

```bash
# View migration status
python -m migrations status

# Run pending migrations (DEV/TEST)
python -m migrations up

# Run specific migration
python -m migrations up --version 004

# Dry run (show what would change)
python -m migrations up --dry-run

# Rollback last migration
python -m migrations down

# Rollback specific migration
python -m migrations down --version 004

# Create new migration
python -m migrations create "add_new_feature"

# Validate migrations
python -m migrations validate

# Show migration history
python -m migrations history
```

## Monitoring & Alerts

### Migration Metrics

| Metric | Alert Threshold |
|--------|-----------------|
| Migration duration | > estimated + 50% |
| Rollback triggered | Any occurrence |
| Validation failure | Any occurrence |
| Documents affected | > 1M in single migration |

### Alert Channels

- **DEV**: Slack #dev-alerts
- **TEST**: Slack #qa-alerts
- **PROD**: PagerDuty + Slack #ops-critical
