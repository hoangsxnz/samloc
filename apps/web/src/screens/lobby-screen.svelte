<script lang="ts">
  import { onMount } from 'svelte';
  import { api, ApiError } from '../lib/api';
  import { formatMoney } from '../lib/format-money';
  import { go } from '../lib/router.svelte';
  import { session, setUser } from '../lib/session.svelte';
  import AppButton from '../components/app-button.svelte';
  import CodeInput from '../components/code-input.svelte';
  import LobbyCreateRoom from './lobby-create-room.svelte';
  import LobbyRecentSessions from './lobby-recent-sessions.svelte';


  let joinCode = $state('');
  let joinError = $state('');
  let joining = $state(false);

  // The session total changes while playing; refresh it whenever the lobby is shown.
  onMount(() => {
    void api.me().then(setUser).catch(() => {});
  });

  async function logout(): Promise<void> {
    await api.logout().catch(() => {});
    setUser(null);
    go('#/login');
  }

  async function joinRoom(): Promise<void> {
    if (joinCode.length !== 6) return;
    joining = true;
    joinError = '';
    try {
      const lookup = await api.findRoom(joinCode);
      if (!lookup.exists || lookup.closed) {
        joinError = 'Không tìm thấy phòng';
        return;
      }
      go(`#/room/${joinCode}`);
    } catch (err) {
      joinError = err instanceof ApiError ? err.message : 'Không thể kết nối máy chủ';
    } finally {
      joining = false;
    }
  }
</script>

<div class="screen lobby-screen">
  <header class="lobby-header">
    <div class="lobby-avatar">{(session.user?.displayName ?? '?').charAt(0).toUpperCase()}</div>
    <span class="lobby-name">{session.user?.displayName}</span>
    <span class="chip lobby-chip">Ngân sách: {formatMoney(session.user?.budget ?? 0)}</span>
    <button class="icon-btn" type="button" aria-label="Đăng xuất" onclick={logout}>⏻</button>
  </header>

  <div class="lobby-cols">
    <section aria-labelledby="create-room-title" class="lobby-col">
      <h2 id="create-room-title">Tạo phòng mới</h2>
      <LobbyCreateRoom />
    </section>

    <section aria-labelledby="join-room-title" class="lobby-col">
      <h2 id="join-room-title">Vào phòng bằng mã</h2>
      <div class="panel join-panel">
        <CodeInput bind:value={joinCode} onsubmit={joinRoom} />
        {#if joinError}
          <p class="form-error" aria-live="polite">{joinError}</p>
        {/if}
        <p class="join-hint">Mã 6 ký tự do chủ phòng gửi</p>
        <AppButton variant="secondary" disabled={joinCode.length !== 6 || joining} onclick={joinRoom}>Vào phòng</AppButton>
      </div>
    </section>

    <section aria-labelledby="recent-title" class="lobby-col recent-col">
      <h2 id="recent-title">Ván gần đây</h2>
      <LobbyRecentSessions />
    </section>
  </div>
</div>

<style>
  .lobby-screen {
    display: flex;
    flex-direction: column;
    padding-top: 0;
  }
  .lobby-header {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    border-bottom: 1px solid var(--line);
    height: 56px;
    flex-shrink: 0;
  }
  .lobby-avatar {
    width: 36px;
    height: 36px;
    border-radius: var(--r-full);
    background: var(--surface-2);
    border: 2px solid var(--line);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    flex-shrink: 0;
  }
  .lobby-name {
    font-size: var(--fs-md);
    font-weight: 600;
  }
  .lobby-chip {
    margin-left: auto;
  }
  .icon-btn {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    font-size: 18px;
    background: none;
    border: 0;
    cursor: pointer;
  }
  .lobby-cols {
    flex: 1;
    display: grid;
    grid-template-columns: 300px 210px 1fr;
    gap: var(--sp-4);
    padding-top: var(--sp-3);
    min-height: 0;
  }
  .lobby-col {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .lobby-col h2 {
    font-size: var(--fs-sm);
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin: 0 0 6px;
  }
  .lobby-col :global(.panel),
  .lobby-col :global(.create-room-panel) {
    flex: 1;
  }
  .join-panel {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    height: 100%;
  }
  .join-hint {
    font-size: var(--fs-xs);
    color: var(--text-muted);
    text-align: center;
    margin: 0;
  }
  .recent-col {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    padding: var(--sp-3);
  }
</style>
