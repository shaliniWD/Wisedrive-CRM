# Inspection Report Field Mapping

## Overview
This document maps fields between the CRM's LiveProgressModal (internal) and the InspectionReport (customer-facing).

---

## Field Mapping: LiveProgressModal → InspectionReport

### 1. HEADER SECTION

| LiveProgressModal Field | Report Field | Status | Notes |
|------------------------|--------------|--------|-------|
| `inspection.package_name` | `header.reportFor` | ✅ Mapped | |
| `inspection.customer_name` | `header.customerName` | ✅ Mapped | |
| `inspection.customer_mobile` | `header.customerPhone` | ✅ Mapped | |
| `inspection.car_number` | `header.vehicleNumber` | ✅ Mapped | |
| `inspection.created_at` | `header.inspectionRequestedDate` | ✅ Mapped | |
| `inspection.inspection_date` | `header.inspectedOn` | ✅ Mapped | |
| `inspection.mechanic_name` | `header.inspectedBy` | ✅ Mapped | |
| `inspection.city` | `header.location` | ✅ Mapped | |
| `editData.market_value_min` | `header.marketValue.min` | ✅ Mapped | |
| `editData.market_value_max` | `header.marketValue.max` | ✅ Mapped | |
| `editData.recommended_to_buy` | `header.recommendedToBuy` | ✅ Mapped | |
| `editData.overall_rating` | `header.overallRating` | ✅ Mapped | |
| `inspection.checkpoints_inspected` | `header.checkpointsInspected` | ✅ Mapped | |
| `inspection.report_published` | `header.isPublished` | ✅ Mapped | |
| `inspection.ai_insights.ai_generated` | `header.aiGenerated` | ✅ Mapped | |

### 2. VEHICLE INFO SECTION

| LiveProgressModal Field | Report Field | Status | Notes |
|------------------------|--------------|--------|-------|
| `editData.vehicle_make` | `vehicleInfo.make` | ✅ Mapped | From vaahan_data fallback |
| `editData.vehicle_model` | `vehicleInfo.model` | ✅ Mapped | From vaahan_data fallback |
| `editData.vehicle_year` | `vehicleInfo.year` | ✅ Mapped | |
| `inspection.mfg_date` | `vehicleInfo.mfgDate` | ⚠️ Missing in Modal | Add to modal |
| `editData.fuel_type` | `vehicleInfo.fuel` | ✅ Mapped | |
| `editData.transmission` | `vehicleInfo.transmission` | ✅ Mapped | |
| `editData.owners` | `vehicleInfo.owners` | ✅ Mapped | |
| `inspection.car_number` | `vehicleInfo.regNo` | ✅ Mapped | |
| `editData.vehicle_colour` | `vehicleInfo.colour` | ✅ Mapped | |
| `inspection.reg_date` | `vehicleInfo.regDate` | ⚠️ Check Vaahan | From vaahan_data |
| `editData.engine_cc` | `vehicleInfo.engineCC` | ✅ Mapped | |
| `inspection.engine_no` | `vehicleInfo.engineNo` | ⚠️ Check Vaahan | From vaahan_data |
| `inspection.chassis_no` | `vehicleInfo.chassisNo` | ⚠️ Check Vaahan | From vaahan_data |

### 3. ASSESSMENT SUMMARY SECTION

| LiveProgressModal Field | Report Field | Status | Notes |
|------------------------|--------------|--------|-------|
| `editData.assessment_summary` | `assessmentSummary.paragraph` | ✅ Mapped | AI-generated |
| `editData.key_highlights` | `assessmentSummary.keyHighlights` | ✅ Mapped | Array of strings |
| `inspection.ai_insights.risk_factors` | `assessmentSummary.riskFactors` | ✅ Mapped | |
| `inspection.ai_insights.recommendations` | `assessmentSummary.recommendations` | ✅ Mapped | |

### 4. KEY INFO / CONDITIONS SECTION

| LiveProgressModal Field | Report Field | Status | Notes |
|------------------------|--------------|--------|-------|
| `editData.kms_driven` | `keyInfo.kmsDriven` | ✅ Mapped | |
| `editData.engine_condition` | `keyInfo.engineCondition` | ✅ Mapped | Dropdown: GOOD/AVERAGE/POOR/PENDING |
| `editData.interior_condition` | `keyInfo.interiorCondition` | ✅ Mapped | |
| `editData.exterior_condition` | `keyInfo.exteriorCondition` | ✅ Mapped | |
| `editData.transmission_condition` | `keyInfo.transmission` | ✅ Mapped | |
| `editData.accident_history` | `keyInfo.accident` | ✅ Mapped | Boolean |
| `editData.flood_damage` | `keyInfo.floodDamage` | ✅ Mapped | Boolean |
| `editData.dents_scratches` | `keyInfo.dentsScratches` | ✅ Mapped | Boolean |

### 5. INSURANCE SECTION

| LiveProgressModal Field | Report Field | Status | Notes |
|------------------------|--------------|--------|-------|
| `editData.insurance_status` | `keyInfo.insurance.status` | ✅ Mapped | |
| `editData.insurer_name` | `keyInfo.insurance.insurerName` | ✅ Mapped | |
| `editData.policy_number` | `keyInfo.insurance.policyNumber` | ✅ Mapped | |
| `editData.insurance_expiry` | `keyInfo.insurance.expiryDate` | ✅ Mapped | |
| `editData.policy_type` | `keyInfo.insurance.policyType` | ✅ Mapped | |
| `editData.idv_value` | `keyInfo.insurance.idvValue` | ✅ Mapped | |

### 6. REPAIRS SECTION

| LiveProgressModal Field | Report Field | Status | Notes |
|------------------------|--------------|--------|-------|
| `editData.repairs` | `keyInfo.repairs` | ✅ Mapped | Array of repair objects |
| `editData.total_repair_cost_min` | (calculated) | ✅ | Sum of repairs |
| `editData.total_repair_cost_max` | (calculated) | ✅ | Sum of repairs |

### 7. RTO VERIFICATION SECTION

| LiveProgressModal Field | Report Field | Status | Notes |
|------------------------|--------------|--------|-------|
| `editData.rto_verification_status` | `rtoVerification.status` | ✅ Mapped | |
| `inspection.challans` | `rtoVerification.challans` | ⚠️ Check Vaahan | From vaahan_data |
| `editData.hypothecation` | `rtoVerification.hypothecation` | ✅ Mapped | |
| `editData.blacklist_status` | `rtoVerification.blacklist` | ✅ Mapped | |

### 8. OBD-2 SECTION

| LiveProgressModal Field | Report Field | Status | Notes |
|------------------------|--------------|--------|-------|
| `liveProgressData.obd_scan.completed` | `obdReport.connected` | ✅ Mapped | |
| `editData.dtc_codes` | `obdReport.dtcCodes` | ✅ Mapped | Array |
| `liveProgressData.obd_scan.data` | `obdReport.liveData` | ✅ Mapped | Object with parameters |

### 9. Q&A / INSPECTION DETAILS SECTION

| LiveProgressModal Field | Report Field | Status | Notes |
|------------------------|--------------|--------|-------|
| `liveProgressData.categories` | `inspectionCategories` | ✅ Mapped | Nested Q&A with photos |
| `editData.category_ratings` | `categoryRatings` | ✅ Mapped | Per-category ratings |

---

## Fields in Report NOT in LiveProgressModal

| Report Field | Status | Action Needed |
|--------------|--------|---------------|
| `vehicleInfo.mfgDate` | ⚠️ | Extract from vaahan_data.mfg_date |
| `vehicleInfo.regDate` | ⚠️ | Extract from vaahan_data.reg_date |
| `vehicleInfo.engineNo` | ⚠️ | Extract from vaahan_data.engine_no |
| `vehicleInfo.chassisNo` | ⚠️ | Extract from vaahan_data.chassis_no |
| `keyInfo.tyreDetails` | ⚠️ | Add tyre inspection to Q&A |
| `rtoVerification.challans` | ⚠️ | Extract from vaahan_data.challans |

---

## Fields in LiveProgressModal NOT in Report

These are internal CRM fields that should NOT be shown to customers:

| Field | Reason |
|-------|--------|
| `inspection.publish_count` | Internal audit |
| `inspection.publish_history` | Internal audit |
| `editData.user_comment` | Internal notes |
| `inspection.mechanic_id` | Internal reference |
| `inspection.lead_id` | Internal reference |
| `inspection.payment_status` | Internal/sensitive |

---

## Implementation Notes

1. **Vaahan Data Mapping**: Many vehicle details come from `inspection.vaahan_data`. The report should use this as the source of truth for RTO-verified information.

2. **AI Insights**: The `inspection.ai_insights` object contains AI-generated assessment data. This should be prioritized over manual fields.

3. **Photo Handling**: Q&A photos are stored in `question.photos` array. The report uses `MediaModal` component to display these.

4. **Authentication**: Preview route should require CRM authentication. Public access should be via short URL with OTP verification.
