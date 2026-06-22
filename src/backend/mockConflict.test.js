const { calculateTotal } = require('./resolved.js');

test('should accurately calculate a 10% sales tax', () => {
    expect(typeof calculateTotal).toBe('function');
    expect(calculateTotal(100)).toBe(110); 
});