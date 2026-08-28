/**
 * Shopping Cart Module
 */

export function calculateCartTotal(items) {
  if (!items || !Array.isArray(items)) {
    return 0;
  }

  return items.reduce((total, item) => {
    let price = item.price || 0;
    let qty = item.quantity || 1;

    // Bug: Throws TypeError if item.discount is null or undefined when checked
    if (item.discount && item.discount.percent) {
      price = price * (1 - item.discount.percent / 100);
    }

    return total + price * qty;
  }, 0);
}

export function applyCoupon(cart, couponCode) {
  if (!cart || !couponCode) return cart;
  if (couponCode === 'SAVE20') {
    cart.discount = { percent: 20 };
  }
  return cart;
}
