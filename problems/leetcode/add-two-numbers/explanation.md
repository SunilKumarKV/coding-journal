# Add Two Numbers

## Approach

This problem represents two non-negative integers using linked lists, where each node contains a single digit and the digits are stored in reverse order.

To solve it, I traverse both linked lists simultaneously while maintaining a `carry` value.

For each iteration:

1. Read the current value from both linked lists (if available).
2. Add both values along with the carry.
3. Create a new node containing `sum % 10`.
4. Update the carry using `sum / 10`.
5. Move to the next nodes.

A dummy node is used to simplify the construction of the result linked list.

I implemented the same algorithm in:

* JavaScript
* C
* Java

Only the syntax differs between the languages.

## Time Complexity

```text
O(max(m, n))
```

Where:

* `m` = length of the first linked list
* `n` = length of the second linked list

The algorithm traverses each list only once.

## Space Complexity

```text
O(max(m, n))
```

A new linked list is created to store the result.

## Step-By-Step Example

Input:

```text
l1 = [2,4,3]
l2 = [5,6,4]
```

These linked lists represent:

```text
342 + 465
```

### Iteration 1

```text
2 + 5 + carry(0) = 7
```

Node value:

```text
7
```

Carry:

```text
0
```

Result:

```text
7
```

### Iteration 2

```text
4 + 6 + carry(0) = 10
```

Node value:

```text
0
```

Carry:

```text
1
```

Result:

```text
7 -> 0
```

### Iteration 3

```text
3 + 4 + carry(1) = 8
```

Node value:

```text
8
```

Carry:

```text
0
```

Result:

```text
7 -> 0 -> 8
```

### Final Output

```text
[7,0,8]
```

This represents:

```text
807
```

Because:

```text
342 + 465 = 807
```

## Key Learning

* Using a dummy node simplifies linked list construction.
* Carry handling follows the same logic as manual addition.
* This pattern is commonly used in linked list arithmetic problems.
* Traversing multiple linked lists simultaneously is an important interview technique.
