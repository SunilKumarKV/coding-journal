# Palindrome Number

## Approach
 
This problem asks us to check whether an integer reads the same forwards and backwards, without converting it to a string.
 
The idea is to reverse the number digit by digit and compare it with the original.
 
For each iteration:
 
1. If `x` is negative, return `false` immediately, since negative numbers can never be palindromes (the `-` sign breaks symmetry).
2. Store the original value of `x` in `palindrome` for comparison later.
3. Extract the last digit using `x % 10` and store it in `remainder`.
4. Build the reversed number: `reverse = reverse * 10 + remainder`.
5. Remove the last digit from `x` using `x / 10`.
6. Repeat until `x` becomes 0.
7. Compare `palindrome` with `reverse`. If they match, it's a palindrome.
A `long long` is used for `reverse` to safely hold the reversed value even if intermediate overflow would occur for numbers near the `int` boundary (this is a common safe practice, though it doesn't actually rescue overflow for the true edge case the same way the O(1)/half-reversal approach does).
 
I implemented the same algorithm in:
 
* C
* Python
* JavaScript
* Java
Only the syntax differs between the languages.
 
## Time Complexity
 
```text
O(log10(x))
```
 
The number of iterations equals the number of digits in `x`, which is proportional to `log10(x)`.
 
## Space Complexity
 
```text
O(1)
```
 
Only a few integer variables are used; no extra data structures are needed.
 
## Step-By-Step Example
 
Input:
 
```text
x = 121
```
 
`palindrome = 121`, `reverse = 0`
 
### Iteration 1
 
```text
remainder = 121 % 10 = 1
reverse = 0 * 10 + 1 = 1
x = 121 / 10 = 12
```
 
### Iteration 2
 
```text
remainder = 12 % 10 = 2
reverse = 1 * 10 + 2 = 12
x = 12 / 10 = 1
```
 
### Iteration 3
 
```text
remainder = 1 % 10 = 1
reverse = 12 * 10 + 1 = 121
x = 1 / 10 = 0
```
 
`x` is now 0, so the loop stops.
 
### Final Comparison
 
```text
palindrome = 121
reverse = 121
121 == 121 -> true
```
 
### Final Output
 
```text
true
```
 
### Negative Number Example
 
Input:
 
```text
x = -121
```
 
Since `x < 0`, the function returns `false` immediately without entering the loop.
 
## Key Learning
 
* Negative numbers are never palindromes because of the leading minus sign.
* Reversing digits using `% 10` and `/ 10` is a fundamental technique for digit manipulation problems.
* Comparing the reversed number to the original avoids string conversion entirely.
* A common follow-up optimization is to reverse only half the digits and compare the two halves, which avoids any risk of overflow and slightly reduces work.