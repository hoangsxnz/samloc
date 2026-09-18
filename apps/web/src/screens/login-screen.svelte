<script lang="ts">
  import { api, ApiError } from '../lib/api';
  import { go } from '../lib/router.svelte';
  import { setUser } from '../lib/session.svelte';
  import AppButton from '../components/app-button.svelte';
  import TextField from '../components/text-field.svelte';

  type Mode = 'login' | 'register';

  const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

  let mode = $state<Mode>('login');
  let username = $state('');
  let displayName = $state('');
  let password = $state('');
  let confirmPassword = $state('');
  let error = $state('');
  let submitting = $state(false);

  function validate(): string {
    if (!USERNAME_RE.test(username)) return 'Tên đăng nhập 3-20 ký tự, chữ thường/số/_';
    if (password.length < 6) return 'Mật khẩu tối thiểu 6 ký tự';
    if (mode === 'register') {
      const trimmedName = displayName.trim();
      if (trimmedName.length < 1 || trimmedName.length > 20) return 'Tên hiển thị 1-20 ký tự';
      if (password !== confirmPassword) return 'Mật khẩu nhập lại không khớp';
    }
    return '';
  }

  function clearError(): void {
    error = '';
  }

  function switchMode(next: Mode): void {
    mode = next;
    error = '';
  }

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const clientError = validate();
    if (clientError) {
      error = clientError;
      return;
    }
    submitting = true;
    try {
      const user =
        mode === 'login'
          ? await api.login({ username, password })
          : await api.register({ username, displayName: displayName.trim(), password });
      setUser(user);
      go('#/home');
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Không thể kết nối máy chủ';
    } finally {
      submitting = false;
    }
  }
</script>

<div class="screen login-screen">
  <div class="hero">
    <div class="fan">
      <div class="fan-card fan-card-1">A<span>♠</span></div>
      <div class="fan-card fan-card-2 red">2<span>♥</span></div>
      <div class="fan-card fan-card-3">K<span>♣</span></div>
    </div>
    <h1 class="hero-title">Sâm Lốc</h1>
    <p class="hero-sub">Bàn chơi riêng của hội bạn</p>
    <p class="hero-foot">Ứng dụng nội bộ · chỉ dành cho thành viên được mời</p>
  </div>

  <form class="login-form" onsubmit={submit}>
    <div class="auth-tabs" role="tablist">
      <button type="button" role="tab" class="auth-tab" class:on={mode === 'login'} aria-selected={mode === 'login'} onclick={() => switchMode('login')}>
        Đăng nhập
      </button>
      <button type="button" role="tab" class="auth-tab" class:on={mode === 'register'} aria-selected={mode === 'register'} onclick={() => switchMode('register')}>
        Tạo tài khoản
      </button>
    </div>

    {#if error}
      <p class="form-error" aria-live="polite">⚠ {error}</p>
    {/if}

    <TextField id="username" label="Tên đăng nhập" bind:value={username} autocomplete="username" oninput={clearError} />
    {#if mode === 'register'}
      <TextField id="display-name" label="Tên hiển thị" bind:value={displayName} autocomplete="nickname" oninput={clearError} />
    {/if}
    <TextField
      id="password"
      label="Mật khẩu"
      type="password"
      bind:value={password}
      autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
      oninput={clearError}
    />
    {#if mode === 'register'}
      <TextField id="confirm-password" label="Nhập lại mật khẩu" type="password" bind:value={confirmPassword} autocomplete="new-password" oninput={clearError} />
    {/if}

    <AppButton type="submit" disabled={submitting}>{mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</AppButton>
    <AppButton variant="ghost" onclick={() => switchMode(mode === 'login' ? 'register' : 'login')}>
      {mode === 'login' ? 'Chưa có tài khoản? Tạo tài khoản' : 'Đã có tài khoản? Đăng nhập'}
    </AppButton>
  </form>
</div>

<style>
  .login-screen {
    display: grid;
    grid-template-columns: 1fr 340px;
    gap: var(--sp-6);
  }
  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    background: radial-gradient(ellipse 60% 60% at 50% 50%, var(--felt-light), var(--felt) 60%, transparent 100%);
    border-radius: var(--r-lg);
  }
  .fan { position: relative; width: 150px; height: 100px; margin-bottom: var(--sp-3); }
  .fan-card {
    position: absolute; top: 0; left: 43px; width: 64px; height: 90px;
    background: var(--card-face); border-radius: var(--r-card); border: 1px solid rgba(0, 0, 0, 0.15);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.45); font-weight: 700; color: var(--card-black);
    display: flex; align-items: flex-start; justify-content: center; padding-top: 6px;
    font-size: 20px; transform-origin: 50% 120%;
  }
  .fan-card.red { color: var(--card-red); }
  .fan-card-1 { transform: rotate(-14deg) translateX(-42px); }
  .fan-card-2 { transform: translateY(-8px); z-index: 1; }
  .fan-card-3 { transform: rotate(14deg) translateX(42px); }
  .hero-title { font-size: var(--fs-3xl); line-height: var(--lh-3xl); font-weight: 700; color: var(--gold); letter-spacing: 0.02em; margin: 0; }
  .hero-sub { font-size: var(--fs-sm); color: var(--text-muted); margin: 4px 0 0; }
  .hero-foot { position: absolute; bottom: 12px; font-size: var(--fs-xs); color: var(--text-muted); margin: 0; }
  .login-form { display: flex; flex-direction: column; justify-content: center; }
  .auth-tabs { display: flex; background: var(--surface); border-radius: var(--r-md); padding: 4px; margin-bottom: var(--sp-3); }
  .auth-tab {
    flex: 1; height: 36px; border: 0; border-radius: 9px; font-size: var(--fs-sm); font-weight: 600;
    color: var(--text-muted); background: transparent; cursor: pointer;
  }
  .auth-tab.on { background: var(--surface-2); color: var(--text); }
  @media (max-height: 339px) {
    .login-screen { grid-template-columns: 1fr; }
    .hero { display: none; }
  }
</style>
