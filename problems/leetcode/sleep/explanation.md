# Sleep

## Approach

The problem asks us to create an async sleep helper using JavaScript promises. The clean way to do this is to wrap `setTimeout` inside a `Promise` and resolve it after `millis` milliseconds.

```js
new Promise((resolve) => setTimeout(resolve, millis));
```

When used with `await`, execution pauses until the promise resolves.

## Time Complexity

`O(1)`

We create one promise and one timer.

## Space Complexity

`O(1)`

Only constant extra space is used.

## Step-By-Step Example

If `millis = 100`:

1. Call `sleep(100)`.
2. Create a promise.
3. Register a `setTimeout` callback for 100 milliseconds later.
4. Return the promise immediately.
5. After 100 milliseconds, `resolve()` is called.
6. Any `await sleep(100)` continues execution.
