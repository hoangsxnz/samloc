/** Money is stored in đồng; the table and the lobby show it grouped the Vietnamese way. */
export function formatMoney(value: number): string {
  return `${value.toLocaleString('vi-VN')}đ`;
}

/** Same, with an explicit sign — for a hand's swing rather than a balance. */
export function formatMoneyDelta(value: number): string {
  return `${value >= 0 ? '+' : '−'}${formatMoney(Math.abs(value))}`;
}
