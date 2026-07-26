const STORAGE_KEY = 'ant.helpTips.dismissed';

function readDismissed(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string'));
  } catch {
    return new Set();
  }
}

function writeDismissed(ids: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore quota / private mode
  }
}

export function isHelpTipDismissed(tipId: string): boolean {
  return readDismissed().has(tipId);
}

export function dismissHelpTip(tipId: string): void {
  const next = readDismissed();
  next.add(tipId);
  writeDismissed(next);
}

export const HELP_TIP_IDS = {
  homeEmpty: 'home-empty',
  contractorRegister: 'contractor-register',
  designerRegister: 'designer-register',
  emptyTender: 'empty-tender',
} as const;
