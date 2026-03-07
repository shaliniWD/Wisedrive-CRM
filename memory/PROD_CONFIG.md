# Production Configuration Reference

## MongoDB Production Connection String
```
mongodb+srv://autocrm-stage:d689l8clqs2c73cm8mg0@customer-apps.c5ddpr.mongodb.net/?appName=vehicle-inspect-39&maxPoolSize=5&retryWrites=true&timeoutMS=10000&w=majority
```

**Database Name:** `crmdev`

**Full Connection (with DB):**
```
mongodb+srv://autocrm-stage:d689l8clqs2c73cm8mg0@customer-apps.c5ddpr.mongodb.net/crmdev?retryWrites=true&w=majority
```

## Important Notes
- MongoDB Atlas cluster: `customer-apps.c5ddpr.mongodb.net`
- IP Whitelisting is enabled - add IPs in MongoDB Atlas → Network Access
- Preview environment IP (if needed): Check with `curl -s ifconfig.me`

## Collections in Repairs Module
- `inspection_categories` - Inspection category types
- `inspection_qa_categories` - Q&A category groupings  
- `inspection_questions` - All inspection questions
- `repair_parts` - Spare parts master list
- `repair_rules` - Rules linking Q&A answers to repairs

## Restore Script Location
`/app/backup_repairs_data/restore_repairs_data.py`

---
*Last updated: March 7, 2026*
