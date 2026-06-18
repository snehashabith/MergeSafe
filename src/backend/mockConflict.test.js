const { calculateTotal } = require('./resolved');

test('should accurately calculate a 10% sales tax', () => {
    expect(calculateTotal(100)).toBe(110); 
});