export default function createCounter(init, operations) {
  let current = init;

  const api = {
    increment() {
      current += 1;
      return current;
    },
    decrement() {
      current -= 1;
      return current;
    },
    reset() {
      current = init;
      return current;
    }
  };

  if (!Array.isArray(operations)) {
    return api;
  }

  return operations.map((operation) => api[operation]());
}
