import { readFileSync, writeFileSync } from "node:fs";

const [orderPath, outputPath] = process.argv.slice(2);
const order = JSON.parse(readFileSync(orderPath, "utf8"));
const totalCents = order.lines.reduce((sum: number, line: { sku: string; quantity: number }) => {
  const product = order.catalog.find((entry: { sku: string }) => entry.sku === line.sku);
  return sum + product.unitCents * line.quantity;
}, 0);
const delivery = { orderId: order.orderId, totalCents, lineCount: order.lines.length };
writeFileSync(outputPath, JSON.stringify(delivery) + "\n", { flag: "wx" });
console.log(JSON.stringify(delivery));
