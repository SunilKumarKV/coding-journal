# Counter II

## Approach

This problem is a closure design problem. We keep the current counter value inside the outer function and return methods that can read and update that value.

- `increment()` adds `1`
- `decrement()` subtracts `1`
- `reset()` restores the original `init`

Because all three methods close over the same `current` variable, they share state correctly.

## Time Complexity

`O(1)` per method call

Each operation updates or returns a number in constant time.

## Space Complexity

`O(1)`

Only the stored counter state is used.

## Step-By-Step Example

If `init = 5`:

1. `current = 5`
2. `increment()` makes it `6`
3. `reset()` brings it back to `5`
4. `decrement()` makes it `4`

The returned values are `[6, 5, 4]`.
