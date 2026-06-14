const transformMap = {
  plusOne: (value) => value + 1,
  plusIndex: (value, index) => value + index,
  constant42: () => 42
};

export default function map(arr, fn) {
  const transform = typeof fn === "function" ? fn : transformMap[fn];

  if (typeof transform !== "function") {
    throw new Error("Invalid transform");
  }

  const transformed = [];

  for (let index = 0; index < arr.length; index += 1) {
    transformed.push(transform(arr[index], index));
  }

  return transformed;
}
