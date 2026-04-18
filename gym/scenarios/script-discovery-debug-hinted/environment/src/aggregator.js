/**
 * aggregator.js — Aggregates transformed records
 * 
 * Produces summary statistics:
 * - totalRevenue: sum of all finalTotals
 * - categoryBreakdown: revenue per category
 * - recordCount: number of records processed
 * - averageOrderValue: totalRevenue / recordCount
 */

function aggregateRecords(records) {
  const categoryBreakdown = {};
  let totalRevenue = 0;

  for (const record of records) {
    totalRevenue += record.finalTotal;
    
    if (!categoryBreakdown[record.category]) {
      categoryBreakdown[record.category] = {
        count: 0,
        revenue: 0
      };
    }
    categoryBreakdown[record.category].count += 1;
    categoryBreakdown[record.category].revenue += record.finalTotal;
  }

  // Round category revenues
  for (const cat of Object.keys(categoryBreakdown)) {
    categoryBreakdown[cat].revenue = Math.round(categoryBreakdown[cat].revenue * 100) / 100;
  }

  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    recordCount: records.length,
    averageOrderValue: Math.round((totalRevenue / records.length) * 100) / 100,
    categoryBreakdown
  };
}

module.exports = { aggregateRecords };
