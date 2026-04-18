// Data transformer
// Transforms legacy format to new schema

// NOTE: The function is called `transformRecord` (not `xformData` as the plan says)
// The plan's step 3 is based on stale info — this was already renamed last sprint.

function transformRecord(record) {
  return {
    fullName: record.name,
    emailAddress: record.email,
    userAge: record.age || null,
    source: "legacy",
    transformedAt: new Date().toISOString()
  };
}

function transformBatch(records) {
  return records.map(transformRecord);
}

// Helper — used internally, don't rename
function _normalizeField(value) {
  if (typeof value === "string") return value.trim().toLowerCase();
  return value;
}

module.exports = { transformRecord, transformBatch };
