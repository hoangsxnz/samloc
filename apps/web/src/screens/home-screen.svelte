<script lang="ts">
  import { onMount } from 'svelte';
  import AppButton from '../components/app-button.svelte';
  import Avatar from '../components/avatar.svelte';
  import { api } from '../lib/api';
  import { formatMoney } from '../lib/format-money';
  import { go } from '../lib/router.svelte';
  import { session, setUser } from '../lib/session.svelte';

  // The budget moves while playing; refresh it whenever Home is shown.
  onMount(() => {
    void api.me().then(setUser).catch(() => {});
  });

  async function logout(): Promise<void> {
    await api.logout().catch(() => {});
    setUser(null);
    go('#/login');
  }
</script>

<div class="screen home-screen">
  {#if session.user}
    <section class="home-me">
      <div class="home-id">
        <div class="home-avatar">
          <Avatar name={session.user.displayName} userId={session.user.id} avatarVer={session.user.avatarVer} size={72} />
        </div>
        <div class="home-names">
          <b class="home-name">{session.user.displayName}</b>
          <span class="home-username">@{session.user.username}</span>
          <span class="chip">Ngân sách: {formatMoney(session.user.budget)}</span>
        </div>
        <button class="icon-btn" type="button" aria-label="Đăng xuất" onclick={logout}>⏻</button>
      </div>
      <div class="home-actions">
        <AppButton onclick={() => go('#/lobby')}>Chơi ngay</AppButton>
        <AppButton variant="secondary" onclick={() => go('#/profile')}>Hồ sơ</AppButton>
      </div>
    </section>
    <section class="home-rewards" aria-label="Phần thưởng"></section>
  {/if}
</div>

<style>
  .home-screen {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sp-4);
    align-content: center;
  }
  .home-me {
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
    justify-content: center;
  }
  .home-id {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
  }
  .home-avatar {
    border-radius: 50%;
    border: 2px solid var(--gold);
    padding: 2px;
  }
  .home-names {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .home-name {
    font-size: var(--fs-xl);
    line-height: var(--lh-xl);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .home-username {
    font-size: var(--fs-sm);
    color: var(--text-muted);
  }
  .home-names .chip {
    align-self: flex-start;
  }
  .icon-btn {
    width: 44px;
    height: 44px;
    margin-left: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    font-size: 18px;
    background: none;
    border: 0;
    cursor: pointer;
  }
  .home-actions {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  .home-rewards {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    justify-content: center;
  }
</style>
