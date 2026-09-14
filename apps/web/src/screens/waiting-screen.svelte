<script lang="ts">
  import type { RoomSettings } from '@samloc/worker/ws-types';
  import { go, route } from '../lib/router.svelte';
  import { room } from '../lib/room.svelte';
  import AppButton from '../components/app-button.svelte';
  import ErrorToast from '../components/error-toast.svelte';
  import SeatRow from '../components/seat-row.svelte';
  import SettingsEditSheet from '../components/settings-edit-sheet.svelte';

  const code = $derived(route.params.code ?? '');
  let copied = $state(false);
  let copyTimer: ReturnType<typeof setTimeout> | null = null;
  let editingSettings = $state(false);

  // Keyed on the code so navigating between two rooms without leaving the route still reconnects.
  $effect(() => {
    room.connect(code);
  });

  $effect(() => {
    if (room.view?.status === 'playing') go(`#/table/${code}`);
  });

  const mySeat = $derived(room.view?.seats.find((s) => s.seat === room.view?.youSeat) ?? null);
  const canStart = $derived(
    !!room.view &&
      room.view.seats.filter((s) => s.connected).length >= 2 &&
      room.view.seats.filter((s) => s.connected && !s.isHost).every((s) => s.ready),
  );

  const settingsChips = $derived.by(() => {
    const settings = room.view?.settings;
    if (!settings) return [];
    return [`${settings.maxPlayers} người`, `${settings.turnSeconds}s / lượt`, `${settings.stakePerLa} / lá`];
  });

  async function share(): Promise<void> {
    if (navigator.share) {
      try {
        await navigator.share({ text: code });
        return;
      } catch {
        // cancelled or unsupported; fall back to clipboard
      }
    }
    await copyCode();
  }

  async function copyCode(): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      copied = true;
      if (copyTimer) clearTimeout(copyTimer);
      copyTimer = setTimeout(() => {
        copied = false;
      }, 1500);
    } catch {
      // clipboard unavailable; nothing more to do
    }
  }

  function saveSettings(settings: RoomSettings): void {
    room.updateSettings(settings);
    editingSettings = false;
  }
</script>

<div class="screen waiting-screen">
  <header class="waiting-top">
    <button type="button" class="icon-btn" aria-label="Rời phòng" onclick={() => room.leave()}>‹</button>
    <h1>Phòng chờ</h1>
    <small>Thứ tự ghế = chiều đánh bài</small>
  </header>

  {#if !room.view}
    <p class="waiting-loading">Đang kết nối phòng…</p>
  {:else}
    <div class="waiting-cols">
      <div class="waiting-left">
        <div class="codebox">
          <small>Mã phòng</small>
          <div class="room-code">{code}</div>
          <div class="share-row">
            <AppButton onclick={share}>⤴ Chia sẻ mã</AppButton>
            <AppButton variant="secondary" onclick={copyCode}>{copied ? 'Đã chép ✓' : '⧉ Sao chép'}</AppButton>
          </div>
        </div>
        <button
          type="button"
          class="settings-chips"
          disabled={!room.view.youAreHost}
          aria-label="Chỉnh cài đặt phòng"
          onclick={() => {
            if (room.view?.youAreHost) editingSettings = true;
          }}
        >
          {#each settingsChips as chipText (chipText)}<span class="chip-outline">{chipText}</span>{/each}
        </button>
        <div class="waiting-actions">
          {#if room.view.youAreHost}
            <AppButton disabled={!canStart} onclick={() => room.start()}>Bắt đầu</AppButton>
            <p class="waiting-hint">Cần tất cả người chơi sẵn sàng (tối thiểu 2)</p>
          {:else}
            <AppButton onclick={() => room.ready(!(mySeat?.ready ?? false))}>
              {mySeat?.ready ? 'Huỷ sẵn sàng' : 'Sẵn sàng'}
            </AppButton>
          {/if}
          <AppButton variant="danger" onclick={() => room.leave()}>Rời phòng</AppButton>
        </div>
      </div>

      <div class="waiting-right">
        <h2>Người chơi <span>{room.view.seats.length} / {room.view.settings.maxPlayers}</span></h2>
        <div class="seat-list">
          {#each room.view.seats as seat (seat.seat)}
            <SeatRow {seat} isMe={seat.seat === room.view.youSeat} />
          {/each}
          {#each Array(Math.max(0, room.view.settings.maxPlayers - room.view.seats.length)) as _}
            <SeatRow seat={null} isMe={false} />
          {/each}
        </div>
      </div>
    </div>

    {#if editingSettings}
      <SettingsEditSheet settings={room.view.settings} onsave={saveSettings} oncancel={() => (editingSettings = false)} />
    {/if}
  {/if}
</div>

<ErrorToast message={room.lastError} onclear={() => room.clearError()} />

<style>
  .waiting-top { display: flex; align-items: center; height: 48px; gap: var(--sp-1); flex-shrink: 0; }
  .waiting-top h1 { font-size: var(--fs-lg); font-weight: 600; margin: 0 0 0 4px; }
  .waiting-top small { margin-left: auto; font-size: var(--fs-xs); color: var(--text-muted); }
  .icon-btn { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 22px; background: none; border: 0; cursor: pointer; }
  .waiting-loading { color: var(--text-muted); padding: var(--sp-4) 0; }
  .waiting-cols { flex: 1; display: grid; grid-template-columns: 320px 1fr; gap: var(--sp-5); min-height: 0; padding-top: var(--sp-1); }
  .waiting-left { display: flex; flex-direction: column; gap: var(--sp-3); }
  .codebox { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); padding: var(--sp-3) var(--sp-4); text-align: center; }
  .codebox small { display: block; font-size: var(--fs-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 2px; }
  .room-code { font-size: var(--fs-3xl); line-height: var(--lh-3xl); font-weight: 700; letter-spacing: 0.18em; color: var(--gold); padding-left: 0.18em; }
  .share-row { display: flex; gap: var(--sp-2); margin-top: var(--sp-2); }
  .settings-chips { display: flex; gap: var(--sp-1); flex-wrap: wrap; background: none; border: 0; padding: 0; cursor: pointer; }
  .settings-chips:disabled { cursor: default; }
  .chip-outline { font-size: var(--fs-xs); color: var(--text-muted); background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-full); padding: 4px 9px; }
  .waiting-actions { margin-top: auto; display: flex; flex-direction: column; gap: var(--sp-2); }
  .waiting-hint { font-size: var(--fs-xs); color: var(--text-muted); text-align: center; margin: 0; }
  .waiting-right { display: flex; flex-direction: column; min-height: 0; }
  .waiting-right h2 { font-size: var(--fs-sm); font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; display: flex; justify-content: space-between; margin: 0 0 6px; }
  .seat-list { overflow-y: auto; min-height: 0; display: flex; flex-direction: column; gap: 6px; }
</style>
