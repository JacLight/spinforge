/**
 * pickFile — open the browser's file chooser and resolve with the selected
 * File, or null if the user cancels.
 *
 * This is the standard `<input type="file">` chooser (the same control the
 * Deploy form uses), NOT a `window.prompt`/`confirm`/`alert` — those are
 * banned in admin-ui. We drive it programmatically so a "Run" button on a
 * zip-source pipeline can ask for the archive without a dedicated form.
 *
 * Cancel handling: a canceled chooser never fires `change`. We resolve null
 * on the modern `cancel` event, and fall back to a one-shot window-focus
 * check so the promise can't hang on browsers that don't emit it.
 */
export function pickFile(accept = '.zip'): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    document.body.appendChild(input);

    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onFocus);
      input.remove();
      resolve(file);
    };

    input.addEventListener('change', () => finish(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => finish(null));

    // Fallback for browsers without the `cancel` event: when focus returns
    // to the window after the chooser closes, give `change` a tick to land,
    // then treat an empty selection as a cancel.
    const onFocus = () => {
      setTimeout(() => finish(input.files?.[0] ?? null), 300);
    };
    window.addEventListener('focus', onFocus, { once: true });

    input.click();
  });
}
