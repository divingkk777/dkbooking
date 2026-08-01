import { createRoot } from 'react-dom/client';
import BookingApp from './createBookingApp';
import '../styles/app.css';

const roots = new WeakMap();

/**
 * Platform plugin entry.
 * @example
 * import { mount, unmount } from '@dk/booking-sdk';
 * const api = mount(document.getElementById('slot'), {
 *   locale: 'KO',
 *   initialRoute: '/admin',
 *   features: { guestBooking: true, adminPortal: true },
 * });
 * api.unmount();
 */
export function mount(element, options = {}) {
  if (!element) throw new Error('DKBooking.mount: element is required');
  let root = roots.get(element);
  if (!root) {
    root = createRoot(element);
    roots.set(element, root);
  }
  root.render(<BookingApp {...options} />);
  return {
    update(nextOptions) {
      root.render(<BookingApp {...options} {...nextOptions} />);
    },
    unmount() {
      root.unmount();
      roots.delete(element);
    },
  };
}

export function unmount(element) {
  const root = roots.get(element);
  if (root) {
    root.unmount();
    roots.delete(element);
  }
}

export { BookingApp };
export default { mount, unmount, BookingApp };
