# 20. Valid Parentheses

## Problem Summary

Given a string `s` containing just the characters `'('`, `')'`, `'{'`, `'}'`, `'['` and `']'`, determine if the input string is valid. 

An input string is valid if:
1. Open brackets are closed by the same type of brackets.
2. Open brackets are closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.

## Approach

The solution utilizes a **Stack** data structure to ensure proper nesting and order of the parentheses:

1. **Map Mapping**: Define a lookup map where the closing brackets are keys and their corresponding opening brackets are values.
2. **Stack Traversal**:
   - Loop through each character of the string.
   - If the character is a closing bracket (exists in our map):
     - Pop the top element from the stack. If the stack is empty, use a placeholder value (like `'#'`).
     - Check if this popped element matches the expected opening bracket from the map. If it does not match, the string is invalid, so return `false`.
   - If the character is an opening bracket, push it onto the stack.
3. **Final Check**: Once the loop finishes, the string is valid only if the stack is completely empty (meaning all opened brackets were correctly closed).

## Time Complexity
```text
O(N)
```
Where `N` is the length of the string `s`. We traverse the string exactly once, performing constant-time `O(1)` push and pop operations.

## Space Complexity
```text
O(N)
```
In the worst-case scenario (e.g., a string consisting only of opening brackets like `(((((...`), we push all characters onto the stack.

## Step-By-Step Example

Let's trace the algorithm conceptually with a sample input string: `s = "()[]{}"`

* **Initialization**: 
  - `stack = []`
  - `map = { ')': '(', '}': '{', ']': '[' }`

* **Step 1**: Character `char = '('`
  - This is an opening bracket.
  - Push to stack: `stack = ['(']`

* **Step 2**: Character `char = ')'`
  - This is a closing bracket.
  - Pop from stack: `topElement = '('`
  - Check: `map[')']` is `'('`, which matches `topElement`.
  - Stack state: `stack = []`

* **Step 3**: Character `char = '['`
  - This is an opening bracket.
  - Push to stack: `stack = ['[']`

* **Step 4**: Character `char = ']'`
  - This is a closing bracket.
  - Pop from stack: `topElement = '['`
  - Check: `map[']']` is `'['`, which matches `topElement`.
  - Stack state: `stack = []`

* **Step 5**: Character `char = '{'`
  - This is an opening bracket.
  - Push to stack: `stack = ['{']`

* **Step 6**: Character `char = '}'`
  - This is a closing bracket.
  - Pop from stack: `topElement = '{'`
  - Check: `map['}']` is `'{'`, which matches `topElement`.
  - Stack state: `stack = []`

* **Completion**: 
  - The loop ends.
  - Check if `stack` is empty. Since `stack.length === 0`, return `true`.

## Key Learning

Using a **Stack (LIFO - Last In, First Out)** is the optimal pattern for processing matching pairs or nested structures. The last opening bracket encountered must always be the first one to be closed.

## Languages Solved
* JavaScript
