# 14. Longest Common Prefix

## Problem Summary

Find the longest prefix shared by every string in the input array.

## Approach

All recorded solutions use the first string as the baseline. The algorithm walks through that string one character at a time and checks whether every other string has the same character at the same index. As soon as one string is shorter or has a different character, the prefix ends immediately.

This works because a common prefix must match position by position across all strings. The earliest mismatch tells us the exact cutoff point, so there is no need to keep comparing later characters.

## Time Complexity

```text
O(n * m)
```

Here, `n` is the number of strings and `m` is the length of the first string or, more generally, the shortest prefix length checked before a mismatch appears.

## Space Complexity

```text
O(1)
```

The solutions only use loop variables and return a substring from the first string.

## Step-By-Step Example

A conceptual walkthrough:

1. Start with the first string, `"flower"`, as the reference.
2. Check index `0`: every string starts with `"f"`, so the prefix can continue.
3. Check index `1`: every string has `"l"`, so the prefix becomes `"fl"`.
4. Check index `2`: `"flower"` has `"o"`, but `"flight"` has `"i"`.
5. Stop at the first mismatch and return everything before index `2`.

The result is `"fl"`.

## Key Learning

* Using the first string as the reference keeps the logic simple and avoids extra data structures.
* Prefix problems often become straightforward character-by-character comparison problems.
* Returning immediately on the first mismatch is both correct and efficient.
* When multiple languages share the same algorithm, the explanation should focus on the shared idea rather than syntax.

## Languages Solved

* JavaScript
* Java
* C
* Python
