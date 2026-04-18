// benchmark.js — Performance measurement for the product API
const { listProducts, getProduct, listCategories } = require('./server');

function runBenchmark() {
  const { Database } = require('./database');
  const db = new Database();

  console.log('=== Product API Performance Benchmark ===\n');

  // Test 1: List all products (no filters)
  db.resetQueryCount();
  const start1 = Date.now();
  const result1 = listProducts({});
  const time1 = Date.now() - start1;
  console.log(`listProducts() — no filters:`);
  console.log(`  Products returned: ${result1.body.length}`);
  console.log(`  DB queries: ${db.getQueryCount()}`);
  console.log(`  Time: ${time1}ms\n`);

  // Test 2: List products with category filter
  db.resetQueryCount();
  const start2 = Date.now();
  const result2 = listProducts({ category: 'Electronics' });
  const time2 = Date.now() - start2;
  console.log(`listProducts({ category: 'Electronics' }):`);
  console.log(`  Products returned: ${result2.body.length}`);
  console.log(`  DB queries: ${db.getQueryCount()}`);
  console.log(`  Time: ${time2}ms\n`);

  // Test 3: Get single product
  db.resetQueryCount();
  const start3 = Date.now();
  const result3 = getProduct(1);
  const time3 = Date.now() - start3;
  console.log(`getProduct(1):`);
  console.log(`  DB queries: ${db.getQueryCount()}`);
  console.log(`  Related products: ${result3.body.related.length}`);
  console.log(`  Time: ${time3}ms\n`);

  // Test 4: List categories
  db.resetQueryCount();
  const start4 = Date.now();
  const result4 = listCategories();
  const time4 = Date.now() - start4;
  console.log(`listCategories():`);
  console.log(`  Categories: ${result4.body.length}`);
  console.log(`  DB queries: ${db.getQueryCount()}`);
  console.log(`  Time: ${time4}ms\n`);

  console.log('=== Summary ===');
  console.log('The query counts above show potential N+1 problems.');
  console.log('Ideal query counts: listProducts=4, getProduct=4, listCategories=2');
}

runBenchmark();
