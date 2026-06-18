public static int addDigitsO1(int num) {
        if (num == 0) return 0;
        return 1 + (num - 1) % 9;
}
 
public static void main(String[] args) {
        System.out.println(addDigitsLoop(38)); // 2
        System.out.println(addDigitsO1(38));   // 2
        System.out.println(addDigitsLoop(0));  // 0
        System.out.println(addDigitsO1(0));    // 0
}