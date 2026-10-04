# Order delivery workspace

`deliver.ts <order.json> <delivery.json>` builds one delivery document. The order has an `orderId`, `lines` containing SKU and integer quantity, and a `catalog` object keyed by SKU, each value containing integer `unitCents`. Output is exactly `{ orderId, totalCents, lineCount }`, with total in integer cents and lineCount equal to the number of lines. Output must not overwrite an existing delivery.

The `deliver-order` workflow invokes a fresh Bun subprocess and verifies its document before returning a Task result. Its ordinary subprocess record is `<outputPath>.execution.json`. A successful standalone command is not accepted Task completion.

The owning agent may inspect all workspace files and ordinary runtime Task/run evidence; edit only `source/` and write probes to `scratch/`. Do not change orders, actual delivery outputs, workflow verifier, runtime stores, or files outside this workspace. No installation/deployment or network actions are authorized. Use ordinary Task tools for assignment changes. The workflow remains `deliver-order`.
