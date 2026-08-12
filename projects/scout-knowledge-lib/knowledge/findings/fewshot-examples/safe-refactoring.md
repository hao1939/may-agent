# Few-Shot Example: Safe Refactoring

**Domain class**: Code refactoring and restructuring tasks  
**Skill**: verify-preserve-behavior (refactor safely)  
**Token estimate**: ~500 tokens

## Trigger Patterns

```regex
/refactor|restructure|extract.*into|split.*into|move.*to|reorganize|clean.*up|consolidate|deduplicate|DRY/i
```

## Worked Example

> **Reference: How an experienced engineer refactored a payment module**
>
> An engineer was asked to refactor `src/payments/payment-processor.ts` — a 400-line file handling Stripe, PayPal, and bank transfers. The task said: "Extract each payment method into its own module."
>
> Here's exactly how the engineer approached it:
>
> **Step 1 — Run existing tests BEFORE any changes:**
> ```
> $ npm test -- --grep payment
>   ✅ processes Stripe payment correctly
>   ✅ processes PayPal payment correctly  
>   ✅ handles declined cards
>   ✅ refund flow works end-to-end
> 4 passed, 0 failed
> ```
> This established the safety net. If tests pass before AND after, the refactor preserved behavior.
>
> **Step 2 — Map all consumers before moving code:**
> ```
> $ grep -rn "payment-processor\|PaymentProcessor" src/
>   src/orders/checkout.ts:4:  import { PaymentProcessor } from '../payments/payment-processor';
>   src/admin/refund-handler.ts:2:  import { PaymentProcessor } from '../payments/payment-processor';
>   src/webhooks/stripe-webhook.ts:6:  import { processStripeEvent } from '../payments/payment-processor';
> ```
> Three consumers. The engineer noted each import — every one needs updating. Missing even one would cause a runtime crash that tests might not catch (e.g., the webhook handler).
>
> **Step 3 — Extract one method at a time, test after each:**
> 1. Extracted `StripeProcessor` → `src/payments/stripe.ts`. Updated imports in checkout.ts and stripe-webhook.ts. Ran tests → green.
> 2. Extracted `PayPalProcessor` → `src/payments/paypal.ts`. Updated checkout.ts. Ran tests → green.
> 3. Extracted `BankTransferProcessor` → `src/payments/bank-transfer.ts`. Ran tests → green.
> 4. Updated `payment-processor.ts` to re-export from sub-modules (backward compat for any missed consumers).
>
> **Step 4 — Final verification:**
> ```
> $ npm test
> 12 passed, 0 failed
> $ grep -rn "payment-processor" src/  # verify no stale imports remain
> ```
>
> **Why test-before-refactor mattered**: Without the baseline test run, the engineer wouldn't know if a post-refactor failure was caused by the refactor or was pre-existing.
>
> **Why grep-consumers mattered**: The webhook handler wasn't covered by the main test suite. Only the grep revealed it as a consumer. Without updating it, the refactor would have caused a production crash on the next Stripe webhook.

## Evidence

Based on patterns from EXP-084–097 (few-shot injection proven 100% effective in matched domains). This example extends coverage to refactoring tasks (previously unmatched).

## Source

Designed for EXP-745 Phase 2 (pattern coverage expansion).
