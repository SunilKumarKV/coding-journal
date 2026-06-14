# Apply Transform over Each Element in Array

## Approach

We create a new array and simulate `Array.prototype.map` manually.

For every index:

```text
result[i] = fn(arr[i], i)
```

After processing all elements, return the transformed array.

## Time Complexity

`O(n)`

We apply the transform function once per element.

## Space Complexity

`O(n)`

A new output array is created.

## Step-By-Step Example

Input:

```text
arr = [1, 2, 3]
fn(value, index) = value + index
```

1. Index `0`: `1 + 0 = 1`
2. Index `1`: `2 + 1 = 3`
3. Index `2`: `3 + 2 = 5`
4. Return `[1, 3, 5]`
