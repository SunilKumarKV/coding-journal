# Filter Elements from Array

## Approach

We build a new result array and manually simulate `Array.prototype.filter`.

For each element:

1. Call the filtering function with the current value and index.
2. If the result is truthy, push the value into the output array.

This matches the behavior required by the problem without using the built-in `filter`.

## Time Complexity

`O(n)`

Each array element is visited once.

## Space Complexity

`O(n)`

In the worst case, every element is included in the output.

## Step-By-Step Example

Input:

```text
arr = [0, 10, 20, 30]
fn(value) = value > 10
```

1. `0 > 10` is false, skip it.
2. `10 > 10` is false, skip it.
3. `20 > 10` is true, add `20`.
4. `30 > 10` is true, add `30`.
5. Return `[20, 30]`.
