# Two Sum

## Hash Map Approach

We scan the array once and store each visited number in a hash map where:

- the key is the number
- the value is its index

For each number, we compute its complement:

```text
complement = target - currentNumber
```

If that complement is already in the map, we have found the two indices that add up to the target. If not, we store the current number and keep going.

## Time Complexity

`O(n)`

We only iterate through the array once, and each hash map lookup or insert is `O(1)` on average.

## Space Complexity

`O(n)`

In the worst case, we may store almost every number in the hash map.

## Step-By-Step Example

Input:

```text
nums = [2, 7, 11, 15]
target = 9
```

1. Start with an empty map.
2. Look at `2`.
   `complement = 9 - 2 = 7`
   `7` is not in the map, so store `2 -> 0`.
3. Look at `7`.
   `complement = 9 - 7 = 2`
   `2` is already in the map at index `0`.
4. Return `[0, 1]`.

This gives the indices of the two numbers whose sum is `9`.
