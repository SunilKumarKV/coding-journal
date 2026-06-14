export default function createCounter(n, calls) {
  let current = n;

  const counter = () => current++;

  if (!Array.isArray(calls)) {
    return counter;
  }

  return calls.map(() => counter());
}
