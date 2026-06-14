export default function createHelloWorld(calls) {
  const fn = (..._args) => "Hello World";

  if (!Array.isArray(calls)) {
    return fn;
  }

  return calls.map((args) => fn(...args));
}
