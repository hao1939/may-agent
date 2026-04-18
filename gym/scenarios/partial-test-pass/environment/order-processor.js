/**
 * Order Processor — processes orders from API payloads.
 */

class OrderProcessor {
  constructor() {
    this.orders = new Map();
    this.log = [];
  }

  processOrder(payload) {
    const { orderId, items, customerId } = payload;
    
    // Deduplicate check
    if (this.orders.has(orderId)) {
      this.log.push({ type: 'duplicate', orderId, timestamp: Date.now() });
      return { status: 'duplicate', orderId };
    }

    // Validate items — BUG: filter condition uses >= instead of >
    // This allows items with price=0 or qty=0 to pass through
    const validItems = items.filter(i => i.price >= 0 && i.qty >= 0);
    if (validItems.length === 0) {
      this.log.push({ type: 'invalid', orderId, timestamp: Date.now() });
      return { status: 'invalid', orderId, reason: 'no valid items' };
    }

    // Calculate total
    const total = validItems.reduce((sum, i) => sum + (i.price * i.qty), 0);
    const rounded = Math.round(total * 100) / 100;

    // Store order
    const order = {
      orderId,
      customerId,
      items: validItems,
      total: rounded,
      status: 'processed',
      createdAt: Date.now()
    };

    this.orders.set(orderId, order);
    this.log.push({ type: 'processed', orderId, total: rounded, timestamp: Date.now() });

    return { status: 'processed', orderId, total: rounded };
  }

  getOrder(orderId) {
    return this.orders.get(orderId) || null;
  }

  cancelOrder(orderId) {
    const order = this.orders.get(orderId);
    if (!order) return { status: 'not_found', orderId };
    if (order.status === 'cancelled') return { status: 'already_cancelled', orderId };
    
    // BUG: Refund calculation ignores quantity — uses sum of unit prices only
    const refundAmount = order.items.reduce((sum, i) => sum + i.price, 0);
    order.status = 'cancelled';
    order.cancelledAt = Date.now();
    order.refundAmount = refundAmount;
    
    this.log.push({ type: 'cancelled', orderId, refundAmount, timestamp: Date.now() });
    return { status: 'cancelled', orderId, refundAmount };
  }

  getLog() {
    return [...this.log];
  }

  getMetrics() {
    const processed = this.log.filter(l => l.type === 'processed').length;
    const cancelled = this.log.filter(l => l.type === 'cancelled').length;
    const duplicates = this.log.filter(l => l.type === 'duplicate').length;
    const invalid = this.log.filter(l => l.type === 'invalid').length;
    const totalRevenue = [...this.orders.values()]
      .filter(o => o.status === 'processed')
      .reduce((sum, o) => sum + o.total, 0);
    
    return { processed, cancelled, duplicates, invalid, totalRevenue: Math.round(totalRevenue * 100) / 100 };
  }
}

module.exports = { OrderProcessor };
