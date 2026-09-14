<script lang="ts">
  import { untrack } from 'svelte';
  import type { RoomSettings } from '@samloc/worker/ws-types';
  import AppButton from './app-button.svelte';
  import SegmentedControl from './segmented-control.svelte';

  interface Props {
    settings: RoomSettings;
    onsave: (settings: RoomSettings) => void;
    oncancel: () => void;
  }

  let { settings, onsave, oncancel }: Props = $props();

  // Snapshot once for the draft; the sheet is remounted (see #if in waiting-screen) if it needs to reopen.
  let maxPlayers = $state(untrack(() => settings.maxPlayers));
  let turnSeconds = $state(untrack(() => settings.turnSeconds));
  let stakePerLa = $state(untrack(() => settings.stakePerLa));
</script>

<div class="sheet-scrim" role="dialog" aria-modal="true" aria-label="Chỉnh cài đặt phòng">
  <div class="panel sheet">
    <h3>Chỉnh cài đặt phòng</h3>
    <SegmentedControl label="Số người" options={[2, 3, 4, 5]} bind:value={maxPlayers} />
    <SegmentedControl label="Thời gian lượt" options={[15, 20, 30]} bind:value={turnSeconds} format={(v) => `${v}s`} />
    <SegmentedControl label="Tiền 1 lá" options={[50, 100, 200, 500]} bind:value={stakePerLa} />
    <div class="sheet-actions">
      <AppButton variant="secondary" onclick={oncancel}>Huỷ</AppButton>
      <AppButton onclick={() => onsave({ maxPlayers, turnSeconds, stakePerLa })}>Lưu</AppButton>
    </div>
  </div>
</div>

<style>
  .sheet-scrim {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--sp-4);
  }
  .sheet {
    width: 100%;
    max-width: 360px;
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }
  .sheet h3 {
    margin: 0;
    font-size: var(--fs-lg);
  }
  .sheet-actions {
    display: flex;
    gap: var(--sp-2);
  }
</style>
