int addDigitsO1(int num) {
    if (num == 0) return 0;
    return 1 + (num - 1) % 9;
}
 
int main(void) {
    printf("%d\n", addDigitsLoop(38)); // 2
    printf("%d\n", addDigitsO1(38));   // 2
    printf("%d\n", addDigitsLoop(0));  // 0
    printf("%d\n", addDigitsO1(0));    // 0
    return 0;
}