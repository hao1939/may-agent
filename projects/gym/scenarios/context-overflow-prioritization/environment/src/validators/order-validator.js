/**
 * Order validation logic
 */
function validate(order) {
  const errors = [];
  
  if (!order.items || order.items.length === 0) {
    errors.push('Order must have at least one item');
  }
  
  if (!order.customerId) {
    errors.push('Customer ID is required');
  }
  
  if (order.total <= 0) {
    errors.push('Order total must be positive');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = { validate };
