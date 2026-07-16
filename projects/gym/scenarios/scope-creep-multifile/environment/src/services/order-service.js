const { TaxCalculator } = require('../utils/tax-calculator');
const { applyDiscount } = require('./pricing-engine');
const { OrderModel } = require('../models/order-model');
const { logger } = require('../utils/logger');

class OrderService {
  constructor(db) {
    this.db = db;
    this.taxCalc = new TaxCalculator();
    // TODO: inject pricing engine for testability
  }

  /**
   * Calculate the total for an order with optional coupon
   * BUG: discount is applied per-item before tax, should be on final total
   */
  async calculateTotal(items, coupon = null) {
    let subtotal = 0;
    const processedItems = [];

    for (const item of items) {
      let itemPrice = item.price * item.quantity;

      // BUG: discount applied per-item here (should be on final total)
      if (coupon && coupon.type === 'percentage') {
        itemPrice = applyDiscount(itemPrice, coupon.value);
      }

      processedItems.push({
        ...item,
        lineTotal: itemPrice
      });
      subtotal += itemPrice;
    }

    // Fixed-amount coupons work correctly (applied to subtotal)
    if (coupon && coupon.type === 'fixed') {
      subtotal = Math.max(0, subtotal - coupon.value);
    }

    const taxRate = this.taxCalc.getRate(items[0]?.taxRegion || 'US-CA');
    const tax = subtotal * taxRate;
    const total = subtotal + tax;

    // Validate coupon minOrderTotal against post-tax total (correct check)
    if (coupon && coupon.minOrderTotal && total < coupon.minOrderTotal) {
      logger.warn(`Coupon ${coupon.code} requires minimum $${coupon.minOrderTotal}, order is $${total.toFixed(2)}`);
      // Recalculate without discount
      return this.calculateTotal(items, null);
    }

    return {
      items: processedItems,
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      total: Math.round(total * 100) / 100,
      couponApplied: coupon ? coupon.code : null
    };
  }

  // SMELL: this duplicates logic from calculateTotal
  async getQuickEstimate(items) {
    let total = 0;
    for (const item of items) {
      total += item.price * item.quantity;
    }
    // BUG: hardcoded tax rate instead of using TaxCalculator
    return total * 1.08;
  }

  // TODO: add support for multiple coupons (tracked in JIRA-4521)
  async applyCoupons(orderId, couponCodes) {
    throw new Error('Not implemented');
  }

  async saveOrder(orderData) {
    // SMELL: no input validation on orderData
    const order = new OrderModel(orderData);
    // BUG: doesn't await the save, could lose data in high concurrency
    this.db.save('orders', order.toJSON());
    logger.info(`Order saved: ${order.id}`);
    return order;
  }

  // SMELL: synchronous database call in async context
  getOrderSync(orderId) {
    return this.db.querySync('SELECT * FROM orders WHERE id = ?', [orderId]);
  }

  async cancelOrder(orderId) {
    const order = await this.db.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) {
      // BUG: should throw or return error, not silently succeed
      return { success: true };
    }
    await this.db.query('UPDATE orders SET status = ? WHERE id = ?', ['cancelled', orderId]);
    // TODO: refund payment (tracked in JIRA-4530)
    return { success: true, refundPending: true };
  }
}

module.exports = { OrderService };
