/**
 * process.js — Order Processing Pipeline
 * 
 * Handles the full order lifecycle: validation, pricing, discounts,
 * receipt generation, and persistence. This monolith has grown too large
 * and the validation logic needs to be extracted.
 */

// ============================================================
// VALIDATION CONSTANTS
// ============================================================

const VALID_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
const MAX_QUANTITY_PER_ITEM = 100;
const MAX_LINE_ITEMS = 50;
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// ============================================================
// VALIDATION FUNCTIONS
// ============================================================

function validateEmail(email) {
  if (typeof email !== 'string') return { valid: false, error: 'Email must be a string' };
  if (!EMAIL_REGEX.test(email)) return { valid: false, error: 'Invalid email format' };
  return { valid: true };
}

function validateLineItem(item) {
  const errors = [];
  if (!item || typeof item !== 'object') return { valid: false, errors: ['Item must be an object'] };
  if (!item.name || typeof item.name !== 'string') errors.push('Item name is required');
  if (typeof item.price !== 'number' || item.price < 0) errors.push('Item price must be a non-negative number');
  if (!Number.isInteger(item.quantity) || item.quantity < 1) errors.push('Item quantity must be a positive integer');
  if (item.quantity > MAX_QUANTITY_PER_ITEM) errors.push(`Item quantity cannot exceed ${MAX_QUANTITY_PER_ITEM}`);
  return { valid: errors.length === 0, errors };
}

function validateOrder(order) {
  const errors = [];
  if (!order || typeof order !== 'object') return { valid: false, errors: ['Order must be an object'] };
  
  // Customer validation
  if (!order.customer || typeof order.customer !== 'object') {
    errors.push('Customer information is required');
  } else {
    if (!order.customer.name) errors.push('Customer name is required');
    if (!order.customer.email) {
      errors.push('Customer email is required');
    } else {
      const emailResult = validateEmail(order.customer.email);
      if (!emailResult.valid) errors.push(emailResult.error);
    }
    if (!order.customer.address) errors.push('Customer address is required');
  }
  
  // Line items validation
  if (!Array.isArray(order.items) || order.items.length === 0) {
    errors.push('Order must have at least one line item');
  } else {
    if (order.items.length > MAX_LINE_ITEMS) {
      errors.push(`Order cannot have more than ${MAX_LINE_ITEMS} line items`);
    }
    order.items.forEach((item, index) => {
      const itemResult = validateLineItem(item);
      if (!itemResult.valid) {
        itemResult.errors.forEach(err => errors.push(`Item ${index + 1}: ${err}`));
      }
    });
  }
  
  // Currency validation
  if (order.currency && !VALID_CURRENCIES.includes(order.currency)) {
    errors.push(`Invalid currency. Valid: ${VALID_CURRENCIES.join(', ')}`);
  }
  
  return { valid: errors.length === 0, errors };
}

function validateDiscountCode(code) {
  if (typeof code !== 'string') return { valid: false, error: 'Discount code must be a string' };
  if (code.length < 4 || code.length > 20) return { valid: false, error: 'Discount code must be 4-20 characters' };
  if (!/^[A-Z0-9-]+$/.test(code)) return { valid: false, error: 'Discount code must be uppercase alphanumeric with hyphens' };
  return { valid: true };
}

// ============================================================
// PRICING LOGIC
// ============================================================

const TAX_RATES = {
  US: 0.08,
  EU: 0.20,
  UK: 0.20,
  CA: 0.13,
  AU: 0.10
};

function calculateSubtotal(items) {
  return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

function calculateTax(subtotal, region) {
  const rate = TAX_RATES[region] || TAX_RATES.US;
  return Math.round(subtotal * rate * 100) / 100;
}

function calculateTotal(subtotal, tax, discount) {
  return Math.round((subtotal + tax - discount) * 100) / 100;
}

// ============================================================
// DISCOUNT LOGIC
// ============================================================

const DISCOUNT_CODES = {
  'SAVE10': { type: 'percent', value: 10 },
  'SAVE20': { type: 'percent', value: 20 },
  'FLAT-5': { type: 'flat', value: 5 },
  'FLAT-15': { type: 'flat', value: 15 },
  'WELCOME': { type: 'percent', value: 15 },
};

function applyDiscount(subtotal, discountCode) {
  if (!discountCode) return 0;
  const codeResult = validateDiscountCode(discountCode);
  if (!codeResult.valid) return 0;
  
  const discount = DISCOUNT_CODES[discountCode];
  if (!discount) return 0;
  
  if (discount.type === 'percent') {
    return Math.round(subtotal * (discount.value / 100) * 100) / 100;
  }
  return Math.min(discount.value, subtotal);
}

// ============================================================
// RECEIPT GENERATION
// ============================================================

function generateReceipt(order, pricing) {
  const lines = [];
  lines.push('═'.repeat(50));
  lines.push('                ORDER RECEIPT');
  lines.push('═'.repeat(50));
  lines.push(`Customer: ${order.customer.name}`);
  lines.push(`Email:    ${order.customer.email}`);
  lines.push(`Address:  ${order.customer.address}`);
  lines.push('─'.repeat(50));
  
  order.items.forEach(item => {
    const itemTotal = (item.price * item.quantity).toFixed(2);
    lines.push(`  ${item.name.padEnd(25)} ${item.quantity}x $${item.price.toFixed(2)} = $${itemTotal}`);
  });
  
  lines.push('─'.repeat(50));
  lines.push(`  Subtotal:  $${pricing.subtotal.toFixed(2)}`);
  if (pricing.discount > 0) {
    lines.push(`  Discount:  -$${pricing.discount.toFixed(2)}`);
  }
  lines.push(`  Tax:       $${pricing.tax.toFixed(2)}`);
  lines.push(`  Total:     $${pricing.total.toFixed(2)}`);
  lines.push('═'.repeat(50));
  
  return lines.join('\n');
}

// ============================================================
// ORDER PROCESSING PIPELINE
// ============================================================

const processedOrders = [];

function processOrder(order) {
  // Step 1: Validate
  const validation = validateOrder(order);
  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }
  
  // Step 2: Calculate pricing
  const subtotal = calculateSubtotal(order.items);
  const discount = applyDiscount(subtotal, order.discountCode);
  const tax = calculateTax(subtotal - discount, order.region || 'US');
  const total = calculateTotal(subtotal, tax, discount);
  
  const pricing = { subtotal, discount, tax, total };
  
  // Step 3: Generate receipt
  const receipt = generateReceipt(order, pricing);
  
  // Step 4: Persist
  const orderId = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const record = {
    id: orderId,
    customer: order.customer,
    items: order.items,
    pricing,
    receipt,
    createdAt: new Date().toISOString()
  };
  processedOrders.push(record);
  
  return { success: true, orderId, pricing, receipt };
}

function getProcessedOrders() {
  return [...processedOrders];
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  // Validation
  validateEmail,
  validateLineItem,
  validateOrder,
  validateDiscountCode,
  VALID_CURRENCIES,
  MAX_QUANTITY_PER_ITEM,
  MAX_LINE_ITEMS,
  EMAIL_REGEX,
  // Pricing
  calculateSubtotal,
  calculateTax,
  calculateTotal,
  // Discounts
  applyDiscount,
  // Receipts
  generateReceipt,
  // Pipeline
  processOrder,
  getProcessedOrders
};
