/** Match the actual keyboard sequence, excluding hidden fields and disabled groups. */
export function dialogFocusables(dialog: HTMLElement): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>(
    'a[href], button, input, select, textarea, [tabindex]'
  )).filter(element => {
    if (element.tabIndex < 0 || element.matches(':disabled, input[type="hidden"]')) return false;
    for (let parent: HTMLElement | null = element; parent; parent = parent.parentElement) {
      if (parent.matches('[hidden], [inert], [aria-hidden="true"]')) return false;
      const style = parent.ownerDocument.defaultView?.getComputedStyle(parent);
      if (style?.display === 'none' || style?.visibility === 'hidden') return false;
      if (parent === dialog) break;
    }
    return true;
  });
}

export function trapDialogFocus(dialog: HTMLElement, event: KeyboardEvent): void {
  if (event.key !== 'Tab') return;
  const elements = dialogFocusables(dialog);
  const first = elements[0];
  const last = elements.at(-1);
  const active = dialog.ownerDocument.activeElement;
  if (!first || !last) {
    event.preventDefault();
    dialog.focus();
  } else if (event.shiftKey && (active === first || active === dialog || !dialog.contains(active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
    event.preventDefault();
    first.focus();
  }
}
