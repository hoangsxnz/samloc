/** Money is stored in whole units and shown as `$10,000`; every screen goes through here. */
export function formatMoney(value: number): string {
  return `$${value.toLocaleString('en-US')}`;
}

/** Same, with an explicit sign — for a hand's swing rather than a balance. */
export function formatMoneyDelta(value: number): string {
  return `${value >= 0 ? '+' : '−'}${formatMoney(Math.abs(value))}`;
}
