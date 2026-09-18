<script lang="ts">
  import { api, ApiError } from '../lib/api';
  import { formatMoney } from '../lib/format-money';
  import AppButton from './app-button.svelte';

  interface Props {
    checkedIn: boolean;
    amount: number;
    onchecked: (budget: number) => void;
  }

  let { checkedIn, amount, onchecked }: Props = $props();

  let busy = $state(false);
  let done = $state(false);
  let error = $state('');

  const complete = $derived(checkedIn || done);

  async function checkin(): Promise<void> {
    if (complete || busy) return;
    busy = true;
    error = '';
    try {
      const result = await api.checkin();
      done = true;
      onchecked(result.budget);
    } catch (err) {
      // Already claimed from another tab: the server said so, show the done state.
      if (err instanceof ApiError && err.status === 409) done = true;
      else error = err instanceof ApiError ? err.message : 'Không thể kết nối máy chủ';
    } finally {
      busy = false;
    }
  }
</script>

<div class="panel checkin">
  <h2 class="checkin-title">Điểm danh hàng ngày</h2>
  <p class="checkin-line">+{formatMoney(amount)} mỗi ngày</p>
  {#if error}<p class="form-error" aria-live="polite">⚠ {error}</p>{/if}
  <AppButton disabled={complete || busy} onclick={checkin}>
    {complete ? 'Đã điểm danh hôm nay ✓' : `Nhận ${formatMoney(amount)}`}
  </AppButton>
</div>

<style>
  .checkin {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  .checkin-title {
    margin: 0;
    font-size: var(--fs-md);
    font-weight: 700;
  }
  .checkin-line {
    margin: 0;
    font-size: var(--fs-sm);
    color: var(--text-muted);
  }
  .form-error {
    margin: 0;
  }
</style>
