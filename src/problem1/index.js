// Apply formula S(n) = n(n+1)/2
// O(1) time, O(1) space.
var sum_to_n_a = function (n) {
  const sign = Math.sign(n);
  const m = Math.abs(n);

  return sign * (m % 2 === 0 ? (m / 2) * (m + 1) : m * ((m + 1) / 2));
};

// (b) Loop through the list 1 by 1
//  O(n) time, O(1) space.
var sum_to_n_b = function (n) {
  const step = n < 0 ? -1 : 1;
  let total = 0;

  for (let i = step; Math.abs(i) <= Math.abs(n); i += step) {
    total += i;
  }

  return total;
};

// (c) Recurse on halves: S(m) = 2*S(floor(m/2)) + ceil(m/2)^2
// Sum for odds need no recursion: 
//      1+3+...+(2k-1) = 2*S(k) - k = k(k+1) - k = k^2.
// O(log n) time, O(log n) stack.
var sum_to_n_c = function (n) {
  const sign = n < 0 ? -1 : 1;

  const sumTo = (m) => {
    if (m === 0) return 0;

    const odds = Math.ceil(m / 2);
    return 2 * sumTo(Math.floor(m / 2)) + odds * odds;
  };

  return sign * sumTo(Math.abs(n));
};

module.exports = { sum_to_n_a, sum_to_n_b, sum_to_n_c };
