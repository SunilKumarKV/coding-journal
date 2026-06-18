export default function addDigitsO1(num) {
    if (num === 0) return 0;
    return 1 + (num - 1) % 9;
}
 
console.log(addDigitsLoop(38)); // 2
console.log(addDigitsO1(38));   // 2
console.log(addDigitsLoop(0));  // 0
console.log(addDigitsO1(0));    // 0
 