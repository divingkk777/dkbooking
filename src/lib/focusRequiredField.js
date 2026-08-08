/**
 * Smooth-scroll to a missing required control/section and focus it when possible.
 * @param {string|Element|null|undefined} target CSS selector or element
 */
export function focusRequiredField(target) {
  const el =
    typeof target === 'string'
      ? document.querySelector(target)
      : target || null;
  if (!el) return false;

  el.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const focusable = el.matches?.(
    'input, select, textarea, button, canvas, [tabindex]:not([tabindex="-1"])',
  )
    ? el
    : el.querySelector?.(
        'input, select, textarea, button, canvas, [tabindex]:not([tabindex="-1"])',
      );

  if (focusable && typeof focusable.focus === 'function') {
    try {
      focusable.focus({ preventScroll: true });
    } catch {
      focusable.focus();
    }
  }
  return true;
}

/**
 * Focus the first matching [data-field="…"] key, then fall back to first error mark.
 * @param {string[]} fieldKeys ordered missing field keys
 */
export function focusFirstMissingField(fieldKeys = []) {
  const run = () => {
    for (const key of fieldKeys) {
      if (!key) continue;
      const sel = `[data-field="${CSS.escape(String(key))}"]`;
      if (focusRequiredField(sel)) return true;
    }
    return focusRequiredField('[data-field-error="1"]');
  };

  requestAnimationFrame(run);
  return true;
}
