/**
 * Hand-off between checkout and the order page for guest shoppers: the
 * order page normally asks for the order's phone number before showing
 * anything. Kept in `sessionStorage`, so it lives only in the tab that
 * placed the order.
 */
const PREFIX = "cc-order-phone:";

export function rememberOrderPhone(orderNumber: string, phone: string): void {
  try {
    sessionStorage.setItem(PREFIX + orderNumber, phone);
  } catch {
    // Private mode / storage disabled: the phone gate still works.
  }
}

export function recallOrderPhone(orderNumber: string): string | null {
  try {
    return sessionStorage.getItem(PREFIX + orderNumber);
  } catch {
    return null;
  }
}
