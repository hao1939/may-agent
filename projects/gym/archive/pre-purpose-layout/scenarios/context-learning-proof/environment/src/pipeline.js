function processReading(data) {
  if (!data || typeof data.temperature !== "number") {
    throw new Error("Invalid reading: missing temperature");
  }
  return {
    celsius: data.temperature - 273.15,
    station: data.station || "unknown",
    timestamp: Date.now(),
  };
}

module.exports = { processReading };
