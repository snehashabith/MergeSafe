function calculateTotal(price) {
<<<<<<< HEAD
  // CURRENT CHANGES
  const tax = price * 0.05;
  return price + tax;
=======
  // INCOMING CHANGES
  const tax = price * 0.08;
  const shipping = 5.00;
  return price + tax + shipping;
>>>>>>> feature/new-tax-rates
}

module.exports = { calculateTotal };