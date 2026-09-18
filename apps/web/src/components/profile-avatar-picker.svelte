<script lang="ts">
  import { api, ApiError, type AuthUser } from '../lib/api';
  import { resizeAvatar } from '../lib/avatar-resize';
  import { setUser } from '../lib/session.svelte';
  import AppButton from './app-button.svelte';
  import Avatar from './avatar.svelte';

  interface Props {
    user: AuthUser;
  }

  let { user }: Props = $props();

  let input = $state<HTMLInputElement | null>(null);
  let busy = $state(false);
  let error = $state('');

  async function onchange(): Promise<void> {
    const file = input?.files?.[0];
    if (!file) return;
    busy = true;
    error = '';
    try {
      const blob = await resizeAvatar(file);
      const { avatarVer } = await api.uploadAvatar(blob);
      setUser({ ...user, avatarVer });
    } catch (err) {
      error = err instanceof ApiError || err instanceof Error ? err.message : 'Không tải được ảnh';
    } finally {
      busy = false;
      if (input) input.value = '';
    }
  }
</script>

<div class="panel picker">
  <div class="picker-ring">
    <Avatar name={user.displayName} userId={user.id} avatarVer={user.avatarVer} size={96} />
  </div>
  <input bind:this={input} type="file" accept="image/*" class="picker-input" {onchange} />
  <AppButton variant="secondary" disabled={busy} onclick={() => input?.click()}>
    {busy ? 'Đang tải…' : 'Đổi ảnh'}
  </AppButton>
  {#if error}<p class="form-error" aria-live="polite">⚠ {error}</p>{/if}
</div>

<style>
  .picker {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sp-3);
  }
  .picker-ring {
    border-radius: 50%;
    border: 2px solid var(--gold);
    padding: 3px;
  }
  .picker-input {
    display: none;
  }
  .form-error {
    margin: 0;
  }
</style>
