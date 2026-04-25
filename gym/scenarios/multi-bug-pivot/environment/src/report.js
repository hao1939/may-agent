/**
 * Report generator — formats order reports.
 */

const config = require("./config");

function generateReport(orders) {
  // Support multi-currency formatting
  let prefix = config.formatting.prefix;
  if (config.currency === "EUR") {
    prefix = "€";
  } else if (config.currency === "GBP") {
    prefix = "£";
  }
  
  const lines = orders.map((order, i) => {
    const fmt = config.formatting;
    const priceStr = order.total.toFixed(config.precision);
    const parts = priceStr.split(".");
    const whole = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, fmt.thousandsSep);
    const formatted = prefix + whole + fmt.decimalSep + parts[1];
    return `${i + 1}. ${order.name}: ${formatted} (qty: ${order.quantity})`;
  });
  
  return {
    title: `Order Report — ${config.currency}`,
    lineCount: lines.length,
    body: lines.join("\n")
  };
}

function setCurrency(curr) {
  config.currency = curr;
  const prefixMap = { USD: "$", EUR: "€", GBP: "£", JPY: "¥" };
  if (prefixMap[curr]) {
    config.formatting.prefix = prefixMap[curr];
  }
}

module.exports = { generateReport, setCurrency };
