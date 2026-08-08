/** Top chrome: toast stack (~16 + ~52) + breathing room */
const SCROLL_MARGIN_TOP = 96;
/** Bottom chrome: sticky action bar + safe area breathing room */
const SCROLL_MARGIN_BOTTOM = 120;

const FOCUSABLE_SEL =
  'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), canvas, [tabindex]:not([tabindex="-1"])';

/**
 * Resolve a field key to a real DOM node without CSS.escape pitfalls
 * (keys like guest:0:0:pickupFlight break some attribute selectors).
 * Prefers the actual control over a wrapper with the same data-field.
 * @param {string} key
 * @returns {Element|null}
 */
function findFieldElement(key) {
  if (!key) return null;
  const asId = String(key).startsWith('#') ? String(key).slice(1) : '';
  if (asId) {
    const byId = document.getElementById(asId);
    if (byId) return preferFocusable(byId);
  }

  // Prefer id conventions used on booking controls.
  const idCandidate = String(key).replace(/:/g, '-');
  const byNiceId =
    document.getElementById(idCandidate) ||
    document.getElementById(`booking-${idCandidate}`) ||
    document.getElementById(`booking-${idCandidate}-pad`);
  if (byNiceId) return preferFocusable(byNiceId);

  const matches = [];
  for (const el of document.querySelectorAll('[data-field]')) {
    if (el.getAttribute('data-field') === key) matches.push(el);
  }
  if (matches.length === 0) return null;

  // Prefer a focusable control; otherwise the last match (inner) over a wrapper.
  const focusable = matches.find((el) => el.matches?.(FOCUSABLE_SEL));
  if (focusable) return focusable;
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const inner = matches[i].querySelector?.(FOCUSABLE_SEL);
    if (inner) return inner;
  }
  return matches[matches.length - 1];
}

/**
 * @param {Element} el
 * @returns {Element}
 */
function preferFocusable(el) {
  if (el.matches?.(FOCUSABLE_SEL)) return el;
  return el.querySelector?.(FOCUSABLE_SEL) || el;
}

/**
 * True when the node is a meaningful vertical scroller (not overflow-x pairing noise).
 * @param {Element} node
 */
function isRealVerticalScroller(node) {
  if (!node || node === document.body) return false;
  const style = window.getComputedStyle(node);
  const oy = style.overflowY;
  if (oy !== 'auto' && oy !== 'scroll' && oy !== 'overlay') return false;

  const overflow = node.scrollHeight - node.clientHeight;
  // Subpixel / scrollbar pairing often yields 1–15px false positives on
  // overflow-x:auto containers (app-shell, sub-card). Require real room.
  if (overflow <= 16) return false;

  // Unconstrained blocks grow with content — window scrolls, not them.
  const bounded =
    node.clientHeight < window.innerHeight - 8 ||
    style.maxHeight !== 'none' ||
    (style.height !== 'auto' && style.height !== '0px');
  return bounded;
}

/**
 * Nearest ancestor that actually scrolls vertically, else the document scroller.
 * @param {Element} el
 * @returns {Element}
 */
function getScrollParent(el) {
  let node = el.parentElement;
  while (node && node !== document.body) {
    if (isRealVerticalScroller(node)) return node;
    node = node.parentElement;
  }
  return document.scrollingElement || document.documentElement;
}

/**
 * Smooth-scroll so `el` sits near the viewport center, clear of toast / sticky bar.
 * Never scrolls to document top as a fallback, and never targets the toast stack.
 * @param {Element} el
 */
function scrollElementIntoView(el) {
  // Toast / fixed chrome must never become the scroll target.
  if (el.closest?.('.toast-stack, .sticky-action-bar')) return;

  const scroller = getScrollParent(el);
  const isWindow =
    scroller === document.scrollingElement ||
    scroller === document.documentElement ||
    scroller === document.body;

  const rect = el.getBoundingClientRect();
  // Zero-size / display:none nodes sit at (0,0) — scrolling them jumps to top.
  if (rect.width < 1 && rect.height < 1) return;

  const viewHeight = isWindow
    ? window.innerHeight
    : scroller.getBoundingClientRect().height;

  const safeTop = SCROLL_MARGIN_TOP;
  const safeBottom = Math.max(safeTop + 40, viewHeight - SCROLL_MARGIN_BOTTOM);
  const safeMid = (safeTop + safeBottom) / 2;
  const elMid = rect.top + rect.height / 2;
  let delta = elMid - safeMid;

  const projectedTop = rect.top - delta;
  const projectedBottom = rect.bottom - delta;
  if (projectedTop < safeTop) delta -= safeTop - projectedTop;
  if (projectedBottom > safeBottom) delta += projectedBottom - safeBottom;

  if (Math.abs(delta) < 2) return;

  if (isWindow) {
    const top = Math.max(0, window.scrollY + delta);
    window.scrollTo({ top, left: 0, behavior: 'smooth' });
  } else {
    scroller.scrollTo({
      top: Math.max(0, scroller.scrollTop + delta),
      left: 0,
      behavior: 'smooth',
    });
  }
}

/**
 * Brief orange outline so the landed control is obvious (esp. when already in view).
 * @param {Element} el
 */
function flashTarget(el) {
  const paint =
    el.closest?.('[data-field], .field, .check-label, .field-block-error') ||
    el;
  paint.classList.add('field-scroll-target');
  window.setTimeout(() => {
    paint.classList.remove('field-scroll-target');
  }, 1600);
}

/**
 * Smooth-scroll to a missing required control/section and focus it when possible.
 * @param {string|Element|null|undefined} target field key, CSS selector, or element
 */
export function focusRequiredField(target) {
  let el = null;
  if (typeof target === 'string') {
    if (target.startsWith('[') || target.startsWith('.') || target.startsWith('#')) {
      // Explicit selectors — still avoid toast stack.
      const found = document.querySelector(target);
      if (found && !found.closest?.('.toast-stack, .sticky-action-bar')) {
        el = preferFocusable(found);
      }
    } else {
      el = findFieldElement(target);
    }
  } else {
    el = target || null;
  }
  if (!el) return false;

  flashTarget(el);
  scrollElementIntoView(el);

  const focusable = el.matches?.(FOCUSABLE_SEL)
    ? el
    : el.querySelector?.(FOCUSABLE_SEL);

  // Defer focus so it doesn't cancel / fight the smooth scroll (mobile Safari).
  window.setTimeout(() => {
    if (!focusable || typeof focusable.focus !== 'function') return;
    try {
      focusable.focus({ preventScroll: true });
    } catch {
      focusable.focus();
    }
  }, 320);

  return true;
}

/**
 * Focus the first matching field key. Does not fall back to unrelated
 * field-light `[data-field-error]` nodes (those often sit at page top).
 * Waits a frame + short timeout so toast / forced-open sections settle.
 * @param {string[]} fieldKeys ordered missing field keys
 */
export function focusFirstMissingField(fieldKeys = []) {
  const keys = (fieldKeys || []).filter(Boolean);
  const run = (attempt = 0) => {
    for (const key of keys) {
      if (focusRequiredField(key)) return true;
    }
    // Only fall back to error marks that belong to one of the missing keys.
    for (const key of keys) {
      for (const el of document.querySelectorAll('[data-field-error="1"]')) {
        if (el.getAttribute('data-field') === key) {
          if (focusRequiredField(el)) return true;
        }
      }
    }
    // Details panes may still be mounting after submitErrors opens them.
    if (attempt < 2) {
      window.setTimeout(() => run(attempt + 1), 120);
    }
    return false;
  };

  // Double rAF (paint) then short delay (toast / details expand) before measuring.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.setTimeout(() => run(0), 100);
    });
  });
  return true;
}
