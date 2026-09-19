<script lang="ts">
  import AppButton from '../components/app-button.svelte';
  import ProfileAvatarPicker from '../components/profile-avatar-picker.svelte';
  import TextField from '../components/text-field.svelte';
  import { api, ApiError } from '../lib/api';
  import { go } from '../lib/router.svelte';
  import { session, setUser } from '../lib/session.svelte';

  let displayName = $state(session.user?.displayName ?? '');
  let saving = $state(false);
  let saved = $state(false);
  let error = $state('');

  const unchanged = $derived(displayName.trim() === (session.user?.displayName ?? '') || displayName.trim() === '');

  async function save(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (unchanged || saving) return;
    saving = true;
    error = '';
    try {
      const user = await api.updateProfile({ displayName: displayName.trim() });
      setUser(user);
      displayName = user.displayName;
      saved = true;
      setTimeout(() => (saved = false), 1500);
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Không thể kết nối máy chủ';
    } finally {
      saving = false;
    }
  }
</script>

<div class="screen profile-screen">
  <header class="profile-header">
    <AppButton variant="ghost" onclick={() => go('#/home')}>← Trang chủ</AppButton>
  </header>

  {#if session.user}
    <div class="profile-cols">
      <ProfileAvatarPicker user={session.user} />

      <form class="panel profile-name" onsubmit={save}>
        <TextField id="display-name" label="Tên hiển thị" bind:value={displayName} autocomplete="nickname" />
        {#if error}
          <p class="form-error" aria-live="polite">⚠ {error}</p>
        {:else if saved}
          <p class="form-saved" aria-live="polite">Đã lưu</p>
        {/if}
        <AppButton type="submit" disabled={unchanged || saving}>Lưu</AppButton>
      </form>
    </div>
  {/if}
</div>

<style>
  .profile-screen {
    display: flex;
    flex-direction: column;
    padding-top: 0;
  }
  .profile-header {
    display: flex;
    align-items: center;
    height: 48px;
    flex-shrink: 0;
  }
  .profile-header :global(.btn-ghost) {
    width: auto;
    padding: 0 var(--sp-2);
  }
  .profile-cols {
    flex: 1;
    display: grid;
    grid-template-columns: 260px minmax(0, 360px);
    justify-content: center;
    gap: var(--sp-4);
    align-content: center;
    min-height: 0;
  }
  .profile-name {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: var(--sp-2);
  }
  .form-saved {
    margin: 0;
    font-size: var(--fs-sm);
    color: var(--success);
  }
</style>
