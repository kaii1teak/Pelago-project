const NOT_TEXT = new Set([
  "checkbox",
  "radio",
  "button",
  "submit",
  "reset",
  "image",
  "file",
  "range",
  "color",
]);

/** Whether typing here types text (so a letter key must not be taken as a shortcut). */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)
    return true;
  if (target instanceof HTMLInputElement) return !NOT_TEXT.has(target.type);
  const role = target.getAttribute("role");
  return role === "textbox" || role === "searchbox" || role === "combobox";
}

/** A dialog (the palette, the mobile menu, the shortcuts overlay) is open. */
export function isDialogOpen(): boolean {
  return document.querySelector('[role="dialog"], [role="alertdialog"]') !== null;
}
