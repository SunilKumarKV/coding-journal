# Counter

## Approach

This is a classic closure problem.

We store `n` in a variable and return an inner function. Every time the inner function is called:

1. return the current value
2. increment it for the next call

Using `current++` gives exactly that post-increment behavior.

## Time Complexity

`O(1)` per call

Each invocation performs one return and one increment.

## Space Complexity

`O(1)`

Only one captured integer is stored.

## Step-By-Step Example

If `n = 10`:

1. First call returns `10`
2. Second call returns `11`
3. Third call returns `12`

So the sequence is `[10, 11, 12]`.
