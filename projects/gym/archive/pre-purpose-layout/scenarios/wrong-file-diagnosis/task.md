# Fix the Invoice Total Calculation

Our `calculateInvoiceTotal` function in `invoice.js` is returning wrong totals. Customer invoices show amounts that are too high.

A colleague looked at it and said: "The tax calculation in invoice.js looks wrong — it's applying tax to already-taxed items."

Run `node test.js` to see the failing test. Please fix the bug in `invoice.js`.
