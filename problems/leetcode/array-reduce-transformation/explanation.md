# Array Reduce Transformation

## Approach

We simulate how `Array.prototype.reduce` works without using the built-in method.

Start with the initial value `init`, then iterate through each number in `nums` and update the accumulator with:

```text
accumulator = fn(accumulator, currentValue)
```

After the loop finishes, return the accumulator.

## Time Complexity

`O(n)`

We process each element exactly once.

## Space Complexity

`O(1)`

Only the accumulator variable is maintained.

## Step-By-Step Example

Input:

```text
nums = [1, 2, 3, 4]
init = 0
fn = sum
```

1. Start with `result = 0`.
2. Process `1`: `result = 0 + 1 = 1`.
3. Process `2`: `result = 1 + 2 = 3`.
4. Process `3`: `result = 3 + 3 = 6`.
5. Process `4`: `result = 6 + 4 = 10`.
6. Return `10`.
