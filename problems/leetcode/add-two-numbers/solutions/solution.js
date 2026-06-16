class ListNode {
  constructor(val = 0, next = null) {
    this.val = val;
    this.next = next;
  }
}

export default function addTwoNumbers(l1, l2) {
  const dummy = new ListNode();
  let carry = 0;
  let cur = dummy;

  while (l1 || l2 || carry) {
    const sum = (l1?.val || 0) + (l2?.val || 0) + carry;

    carry = Math.floor(sum / 10);
    cur.next = new ListNode(sum % 10);
    cur = cur.next;

    l1 = l1?.next || null;
    l2 = l2?.next || null;
  }

  return dummy.next;
}