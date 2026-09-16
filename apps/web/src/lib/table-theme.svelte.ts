export type FeltKey = 'green' | 'blue' | 'burgundy' | 'charcoal';

export interface FeltPreset {
  label: string;
  felt: string;
  dark: string;
  light: string;
}

export const FELT_PRESETS: Record<FeltKey, FeltPreset> = {
  green: { label: 'Xanh lá', felt: '#1a4d2e', dark: '#123822', light: '#22643c' },
  blue: { label: 'Xanh dương', felt: '#173a5e', dark: '#102844', light: '#1f4e7d' },
  burgundy: { label: 'Đỏ rượu', felt: '#5a1f2a', dark: '#3f151d', light: '#752a38' },
  charcoal: { label: 'Xám than', felt: '#2b2f36', dark: '#1d2026', light: '#3a3f48' },
};

export const FELT_ORDER: FeltKey[] = ['green', 'blue', 'burgundy', 'charcoal'];

const STORAGE_KEY = 'samloc.felt';

function isFeltKey(value: string | null): value is FeltKey {
  return value !== null && value in FELT_PRESETS;
}

/** Private mode and blocked site data both make localStorage throw; green is the fallback. */
function load(): FeltKey {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isFeltKey(stored) ? stored : 'green';
  } catch {
    return 'green';
  }
}

/** Device-local felt colour: never sent to the server, never part of room state. */
class TableTheme {
  felt = $state<FeltKey>(load());

  set(key: FeltKey): void {
    this.felt = key;
    try {
      localStorage.setItem(STORAGE_KEY, key);
    } catch {
      // Preference stays for this session only.
    }
  }

  /** Inline style for `.table-root`; the rest of the theme reads these three variables. */
  get vars(): string {
    const preset = FELT_PRESETS[this.felt];
    return `--felt:${preset.felt}; --felt-dark:${preset.dark}; --felt-light:${preset.light};`;
  }
}

export const tableTheme = new TableTheme();
