# admin-ui guidelines

## NEVER use native browser dialogs

Do NOT use `window.confirm()`, `window.alert()`, or `window.prompt()` — or
the bare `confirm()` / `alert()` globals — anywhere in admin-ui code. These
render the OS/browser chrome (the "Windows-looking" dialog) and are jarring
inside an otherwise themed product. They also block the event loop and
can't be styled, dismissed with the same affordances as our modals, or
given a "type to confirm" guard for destructive actions.

Use the app's modal components instead:

- **Confirm / destructive confirm** → `useConfirm()` from
  `src/components/ConfirmModal.tsx`. Returns a promise — `await` it.
  ```tsx
  const confirm = useConfirm();
  const ok = await confirm({
    title: 'Delete site?',
    description: 'This removes the domain and all its config.',
    confirmLabel: 'Delete',
    severity: 'danger',
    typeToConfirm: siteName, // optional guard for irreversible actions
  });
  if (!ok) return;
  ```
- **Transient feedback / errors** → toast (see existing toast usage),
  not `alert()`.
- **Form input / prompts** → a real form in a drawer or modal, not
  `window.prompt()`.

The `ConfirmProvider` is already mounted in `App.tsx`, so `useConfirm()`
works from any component below it.

If you catch yourself typing `window.confirm` or `alert(` — stop and
reach for the modal instead.
