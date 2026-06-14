const predicateMap = {
  greaterThan10: (value) => value > 10,
  firstIndex: (_, index) => index === 0,
  plusIndexTruthy: (value, index) => value + index
};

export default function filter(arr, fn) {
  const predicate = typeof fn === "function" ? fn : predicateMap[fn];

  if (typeof predicate !== "function") {
    throw new Error("Invalid predicate");
  }

  const filtered = [];

  for (let index = 0; index < arr.length; index += 1) {
    if (predicate(arr[index], index)) {
      filtered.push(arr[index]);
    }
  }

  return filtered;
}
