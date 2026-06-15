struct ListNode* addTwoNumbers(struct ListNode* l1, struct ListNode* l2) {
    struct ListNode dummy = {0, NULL}, *cur = &dummy;
    int carry = 0;
    while (l1 || l2 || carry) {
        if (l1) { carry += l1->val; l1 = l1->next; }
        if (l2) { carry += l2->val; l2 = l2->next; }
        cur->next = malloc(sizeof(struct ListNode));
        cur->next->val = carry % 10;
        cur->next->next = NULL;
        carry /= 10;
        cur = cur->next;
    }
    return dummy.next;
}