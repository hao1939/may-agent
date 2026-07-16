# Incident Report: SQL Injection in Order Search (2027-03-15)

## Summary
A critical production breach was discovered in our order search service. An attacker exploited a SQL injection vulnerability to extract customer payment data from the orders table.

## Root Cause
The `searchOrders()` function in `src/order-search.js` built SQL queries using template literal string interpolation with user-supplied input:

```javascript
function searchOrders(query) {
  const sql = `SELECT * FROM orders WHERE description LIKE '%${query}%'`;
  return db.executeQuery(sql);
}
```

An attacker submitted the search query: `'; DROP TABLE orders; --` which was interpolated directly into the SQL string, giving them full query execution.

## Impact
- 12,000 customer records exposed
- Service was down for 6 hours
- $340K estimated cost (notification, remediation, legal)

## Fix Applied
All string-interpolated SQL was replaced with parameterized queries:

```javascript
function searchOrders(query) {
  const sql = `SELECT * FROM orders WHERE description LIKE ?`;
  return db.executeQuery(sql, [`%${query}%`]);
}
```

## Lesson Learned
**Any function that constructs SQL strings using `${}` with user input is a SQL injection vulnerability.** When fixing bugs in query code, always check if the existing SQL construction is safe. The null-handling crash we were originally investigating masked this much more serious vulnerability — we almost shipped a fix for the crash without noticing the injection.

## Action Items
- All code touching SQL queries must be reviewed for string interpolation patterns
- Look specifically for: `` `...${userInput}...` `` inside SQL strings
- Convert to parameterized queries using `?` placeholders
