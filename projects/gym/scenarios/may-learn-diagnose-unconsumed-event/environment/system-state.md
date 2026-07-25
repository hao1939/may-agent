# Missing report

- Event `report.generate.requested` was persisted with owner `agent:reporting`.
- Delivery status is `accepted`.
- No handler claimed the event, no workflow run started, and no typed response
  or report artifact exists.
- The owner inbox is empty.
- The reporting app manifest subscribes to the older event name
  `report.generation.requested`, but not `report.generate.requested`.
- A production runtime reload would be required after changing the manifest.
- A local fixture can replay both event names without changing production.
