# Test Failure Diagnosis

## Failure 1: `tax should round to cents: $29.99 × 8% = $2.40`

- **Test name**: Tax rounding case 1
- **What it checks**: `calculateTax(29.99, 0.08) === 2.40`
- **Expected value** (test assertion): 2.40
- **Actual value** (code produces): 2.3992

### Independent calculation
```
29.99 × 0.08 = 2.3992
Rounded to nearest cent: 2.40
```

**Verdict: CODE BUG** — `calculateTax` does not round its result. The function returns the raw multiplication (`amount * taxRate`) without rounding to 2 decimal places. The test's expected value of 2.40 is the mathematically correct rounded result.

---

## Failure 2: `tax should round to cents: $47.50 × 6.25% = $2.97`

- **Test name**: Tax rounding case 2
- **What it checks**: `calculateTax(47.50, 0.0625) === 2.97`
- **Expected value** (test assertion): 2.97
- **Actual value** (code produces): 2.96875

### Independent calculation
```
47.50 × 0.0625 = 2.96875
Rounded to nearest cent: 2.97
```

**Verdict: CODE BUG** — Same issue as Failure 1. `calculateTax` needs to round its result to 2 decimal places. Fix: `return Math.round(amount * taxRate * 100) / 100;`

---

## Failure 3: `discount on $33.97 at 20%`

- **Test name**: Discount edge case with rounding
- **What it checks**: `applyDiscount(33.97, 20) === 27.17`
- **Expected value** (test assertion): 27.17
- **Actual value** (code produces): 27.18

### Independent calculation
```
33.97 × (20 / 100) = 33.97 × 0.20 = 6.794
33.97 - 6.794 = 27.176
Rounded to nearest cent: 27.18
```

**Verdict: TEST BUG** — The code produces 27.18, which IS the mathematically correct answer. The test assertion expects 27.17, which is wrong. The test should be fixed to expect 27.18. Do NOT modify the `applyDiscount` function — it is correct.
