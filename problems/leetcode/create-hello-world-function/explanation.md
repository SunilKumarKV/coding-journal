# Create Hello World Function

## Approach

Return a new function that ignores every argument and always returns the same string:

```text
"Hello World"
```

This works because the returned function simply returns a constant value.

## Time Complexity

`O(1)` per call

The function always returns the same string immediately.

## Space Complexity

`O(1)`

No extra data structure is needed.

## Step-By-Step Example

1. Call `createHelloWorld()`
2. It returns a function
3. Call that returned function with any arguments
4. It still returns `"Hello World"`
