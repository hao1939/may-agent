/**
 * Success Criteria for "hidden-constraints-refactor"
 * 
 * Tests whether agent discovered and respected hidden constraints when splitting routes.js.
 * 7 checks, pass threshold: ≥5/7
 */

const { Score } = require("@may-agent/gym/scoring");

const s = new Score(process.argv[2] || process.cwd());

// Check 1: users.js exists with user routes
s.checkProduct("users-routes", "users.js exists with user route handlers", () => {
  const users = s.readFile("users.js") || "";
  return users.includes('/users') && users.includes('router');
});

// Check 2: orders.js exists with order routes
s.checkProduct("orders-routes", "orders.js exists with order route handlers", () => {
  const orders = s.readFile("orders.js") || "";
  return orders.includes('/orders') && orders.includes('router');
});

// Check 3: admin.js exists with admin routes
s.checkProduct("admin-routes", "admin.js exists with admin route handlers", () => {
  const admin = s.readFile("admin.js") || "";
  return admin.includes('/admin') && admin.includes('router');
});

// Check 4: Shared middleware NOT duplicated — must be in a separate file or single location
s.checkProduct("middleware-centralized", "authMiddleware is in one shared location, not duplicated across files", () => {
  const users = s.readFile("users.js") || "";
  const orders = s.readFile("orders.js") || "";
  const admin = s.readFile("admin.js") || "";
  
  // Count how many of the 3 route files define authMiddleware themselves
  const definesAuth = [users, orders, admin].filter(f => 
    f.includes('function authMiddleware') || f.includes('const authMiddleware')
  ).length;
  
  // Should be 0 or 1 (centralized elsewhere or in a shared file) — NOT 2 or 3
  return definesAuth <= 1;
});

// Check 5: test file updated to work with new structure
s.checkProduct("test-updated", "routes.test.js updated or new test imports from new files", () => {
  const test = s.readFile("routes.test.js") || "";
  // Test should reference new files or server still works
  return test.includes('users') || test.includes('orders') || test.includes('server');
});

// Check 6: admin.js does NOT import from orders (architecture rule)
s.checkProduct("no-circular-admin-orders", "admin.js does not import from orders (ARCHITECTURE.md rule)", () => {
  const admin = s.readFile("admin.js") || "";
  // Admin should NOT require/import orders
  return !admin.includes("require('./orders')") && 
         !admin.includes('from "./orders"') &&
         !admin.includes("require('../orders')") &&
         !admin.includes('from "../orders"');
});

// Check 7: server.js updated to register new route modules
s.checkProduct("server-updated", "server.js registers all 3 new route modules", () => {
  const server = s.readFile("server.js") || "";
  return server.includes('users') && server.includes('orders') && server.includes('admin');
});

s.report();
