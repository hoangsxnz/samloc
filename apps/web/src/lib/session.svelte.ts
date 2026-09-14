import { api, type AuthUser } from './api';

export const session = $state<{ user: AuthUser | null; loading: boolean }>({
  user: null,
  loading: true,
});

export async function bootstrap(): Promise<void> {
  try {
    session.user = await api.me();
  } catch {
    session.user = null;
  } finally {
    session.loading = false;
  }
}

export function setUser(user: AuthUser | null): void {
  session.user = user;
}
