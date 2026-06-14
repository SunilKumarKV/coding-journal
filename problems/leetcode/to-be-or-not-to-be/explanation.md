# To Be Or Not To Be

## Approach

We return an object with two methods:

- `toBe`
- `notToBe`

Both methods compare against the original value captured by the outer function.

- `toBe` returns `true` when values are strictly equal, otherwise throws `"Not Equal"`
- `notToBe` returns `true` when values are different, otherwise throws `"Equal"`

This matches the expected tiny assertion helper behavior.

## Time Complexity

`O(1)`

Each method performs a single strict comparison.

## Space Complexity

`O(1)`

Only the captured value and two methods are stored.

## Step-By-Step Example

If `val = 5`:

1. Call `expect(5)`
2. `toBe(5)` checks `5 === 5`, so it returns `true`
3. `notToBe(5)` checks `5 !== 5`, which is false, so it throws `"Equal"`
