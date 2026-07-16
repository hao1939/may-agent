import { applyDiscount, formatPrice } from "./pricing";

// Basic tests — these pass even with the bug (discount <= 50)
console.log("Test 1:", applyDiscount(100, 10) === 90 ? "PASS" : "FAIL");
console.log("Test 2:", applyDiscount(200, 50) === 100 ? "PASS" : "FAIL");
console.log("Test 3:", formatPrice(42) === "$42.00" ? "PASS" : "FAIL");

// This test exposes the bug (discount > 50)
console.log("Test 4 (bug case):", applyDiscount(100, 60) === 40 ? "PASS" : "FAIL");
console.log("Test 5:", applyDiscount(100, 75) === 25 ? "PASS" : "FAIL");
console.log("Test 6:", applyDiscount(50, 90) === 5 ? "PASS" : "FAIL");
