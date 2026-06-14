const reducerMap = {
  sum: (accum, curr) => accum + curr,
  sumSquares: (accum, curr) => accum + curr * curr,
  product: (accum, curr) => accum * curr
};

export default function reduce(nums, fn, init) {
  const reducer = typeof fn === "function" ? fn : reducerMap[fn];

  if (typeof reducer !== "function") {
    throw new Error("Invalid reducer");
  }

  let result = init;

  for (const num of nums) {
    result = reducer(result, num);
  }

  return result;
}
