export default isPalindrome = function(x) {
    if(x < 0){
        return false;
    }
    let remainder, palindrome;
    let reverse = 0;
    palindrome = x;
    while(x > 0){
        remainder = x % 10;
        reverse = (reverse * 10) + remainder;
        x = Math.floor(x / 10);
    }
    return (palindrome == reverse);
    };
