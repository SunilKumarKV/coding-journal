# Add Digits

## Approach
 
This problem asks us to repeatedly sum the digits of a number until only one digit remains.
 
The straightforward way is to use a loop: while the number has more than one digit, extract each digit, sum them, and repeat with the new sum.
 
For each iteration:
 
1. Initialize `sum` to 0.
2. Extract the last digit using `num % 10`.
3. Add it to `sum`.
4. Remove the last digit using `num / 10`.
5. Repeat until `num` becomes 0.
6. Replace `num` with `sum` and repeat the whole process until `num < 10`.
 
The follow-up asks for an O(1) solution without loops. This uses the **digital root** formula, based on modular arithmetic: every number is congruent to the sum of its digits mod 9 (since `10 ≡ 1 mod 9`).
 
```text
if num == 0: return 0
else: return 1 + (num - 1) % 9
```
 
I implemented both the loop solution and the O(1) math solution in:
 
* Python
* JavaScript
* C
* Java
 
Only the syntax differs between the languages.
 
## Time Complexity
 
```text
Loop solution: O(log num)
O(1) solution: O(1)
```
 
The loop solution's cost depends on the number of digits, which grows with `log num`. The math solution does a single computation regardless of input size.
 
## Space Complexity
 
```text
O(1)
```
 
No extra data structures are used; only a few variables are tracked.
 
## Step-By-Step Example
 
Input:
 
```text
num = 38
```
 
### Iteration 1
 
```text
38 -> 3 + 8 = 11
```
 
Result:
 
```text
11
```
 
### Iteration 2
 
```text
11 -> 1 + 1 = 2
```
 
Result:
 
```text
2
```
 
Since `2` has only one digit, the loop stops.
 
### Final Output
 
```text
2
```
 
### Verifying with the O(1) formula
 
```text
1 + (38 - 1) % 9
= 1 + 37 % 9
= 1 + 1
= 2
```
 
Matches the loop result.
 
## Key Learning
 
* Repeated digit summing always converges to a single digit (the digital root).
* The digital root has a direct mathematical shortcut using mod 9, avoiding loops entirely.
* This connects to **casting out nines**, a real-world checksum technique once used in accounting and bookkeeping to verify arithmetic by hand before calculators existed.
* Recognizing when a "simulate the process" problem hides a closed-form math trick is a useful interview skill.