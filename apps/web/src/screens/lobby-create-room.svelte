<script lang="ts">
  import { api, ApiError } from '../lib/api';
  import { go } from '../lib/router.svelte';
  import AppButton from '../components/app-button.svelte';
  import SegmentedControl from '../components/segmented-control.svelte';

  let maxPlayers = $state(4);
  let turnSeconds = $state(20);
  let stakePerLa = $state(100);
  let error = $state('');
  let creating = $state(false);

  async function createRoom(): Promise<void> {
    creating = true;
    error = '';
    try {
      const room = await api.createRoom({ maxPlayers, turnSeconds, stakePerLa });
      go(`#/room/${room.code}`);
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Không thể kết nối máy chủ';
    } finally {
      creating = false;
    }
  }
</script>

<div class="panel create-room-panel">
  <SegmentedControl label="Số người" options={[2, 3, 4, 5]} bind:value={maxPlayers} />
  <SegmentedControl label="Thời gian lượt" options={[15, 20, 30]} bind:value={turnSeconds} format={(v) => `${v}s`} />
  <SegmentedControl label="Tiền 1 lá" options={[50, 100, 200, 500]} bind:value={stakePerLa} />
  <p class="create-room-note">Thối 2, cóng, chặt 2, báo sâm tính theo luật cố định</p>
  {#if error}
    <p class="form-error" aria-live="polite">{error}</p>
  {/if}
  <AppButton disabled={creating} onclick={createRoom}>Tạo phòng</AppButton>
</div>

<style>
  .create-room-panel {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    height: 100%;
  }
  .create-room-note {
    font-size: var(--fs-xs);
    color: var(--text-muted);
    margin: 0;
  }
  .create-room-panel :global(.btn) {
    margin-top: auto;
  }
</style>
