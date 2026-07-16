# Pricing Engine Specification

## 1. Overview
The pricing module handles all monetary calculations for customer orders.

## 2. Architecture
- `src/pricing.js` — Core calculation functions
- `test/pricing.test.js` — Unit tests

## 3. Calculation Rules

### 3.1 Line Item Calculation
Each line item total = unitPrice × quantity, rounded to 2 decimal places.

### 3.2 Rounding Policy ⚠️
**All monetary calculations MUST use banker's rounding (round-half-to-even).**

Banker's rounding differs from standard rounding for values exactly at .5:
- Standard: 2.5 → 3, 3.5 → 4, 4.5 → 5 (always rounds up)
- Banker's: 2.5 → 2, 3.5 → 4, 4.5 → 4 (rounds to nearest even)

This is mandated by the finance team to prevent systematic rounding bias
in aggregate calculations. Over millions of transactions, standard rounding
creates a measurable upward bias (~0.5%) that compounds in financial reports.

**Compliance**: Required for SOX audit trail. Non-negotiable.

### 3.3 Tax Calculation
Tax = subtotal × taxRate, rounded per §3.2.

### 3.4 Future: Bulk Discounts
Planned feature: 15% discount for orders of 10+ units per line item.
When implemented, discount should be applied BEFORE tax calculation.
The discount amount itself must also follow the rounding policy in §3.2.

## 4. Testing
All rounding edge cases (half-cent values) must be covered in tests.
