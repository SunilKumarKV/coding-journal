export default function solve(nums, target) {
  const seen = new Map();

  for (let index = 0; index < nums.length; index += 1) {
    const value = nums[index];
    const complement = target - value;

    if (seen.has(complement)) {
      return [seen.get(complement), index];
    }

    seen.set(value, index);
  }

  return [];
}
