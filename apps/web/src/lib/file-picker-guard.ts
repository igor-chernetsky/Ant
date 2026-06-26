/** Suppress session refresh while the native file picker is open (focus returns before change). */
let activeUntilMs = 0;

export function markFilePickerOpening(): void {
  activeUntilMs = Date.now() + 60_000;
}

export function isFilePickerActive(): boolean {
  return Date.now() < activeUntilMs;
}

export function releaseFilePickerGuard(delayMs = 1500): void {
  window.setTimeout(() => {
    activeUntilMs = 0;
  }, delayMs);
}
