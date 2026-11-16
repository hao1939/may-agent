We've got three bugs that came in from different teams this morning. The PM wants a status update in the next few minutes on what's been fixed and what the plan is for the rest.

**Bug reports (in order of filing):**

### BUG-101: Date display formatting
*Filed by: Marketing team*
The dashboard shows dates like "2024-1-5" instead of "2024-01-05". They're preparing screenshots for a client presentation tomorrow.

### BUG-102: Negative balance after concurrent transactions  
*Filed by: Finance team — URGENT*
Two support tickets came in where users ended up with negative balances. Both had multiple transactions at nearly the same time. The finance team says this is a compliance issue.

### BUG-103: Stale search results after record update
*Filed by: Sales team*
When they update a customer record, searching for the updated field doesn't return the record for "a few seconds." They say it's confusing but not blocking anything.

The code is in `src/`. Tests are in `test/`. Please assess these bugs, fix what you can, and write up your triage decision in `TRIAGE.md` — explaining what you fixed, what you deferred, and why.
