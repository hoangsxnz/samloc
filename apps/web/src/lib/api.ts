export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  avatarVer: number | null;
  budget: number;
}

export interface RecentSession {
  code: string;
  hands: number;
  netLa: number;
  netScore: number;
  stakePerLa: number;
  players: string[];
  open: boolean;
}

export interface RoomSettingsInput {
  maxPlayers: number;
  turnSeconds: number;
  stakePerLa: number;
}

export interface RoomLookup {
  exists: boolean;
  maxPlayers?: number;
  turnSeconds?: number;
  stakePerLa?: number;
  closed?: boolean;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function extractError(body: unknown): string {
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const error = (body as { error: unknown }).error;
    if (typeof error === 'string') return error;
  }
  return 'Đã có lỗi xảy ra';
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  const body: unknown = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, extractError(body));
  return body as T; // trusted worker response per phase-04 route contracts
}

export const api = {
  register: (input: { username: string; displayName: string; password: string }) =>
    req<AuthUser>('/api/register', { method: 'POST', body: JSON.stringify(input) }),

  login: (input: { username: string; password: string }) =>
    req<AuthUser>('/api/login', { method: 'POST', body: JSON.stringify(input) }),

  logout: () => req<{ ok: true }>('/api/logout', { method: 'POST' }),

  me: () => req<AuthUser>('/api/me'),

  recentSessions: () => req<{ sessions: RecentSession[] }>('/api/sessions'),

  createRoom: (settings: RoomSettingsInput) =>
    req<{ code: string } & RoomSettingsInput>('/api/rooms', {
      method: 'POST',
      body: JSON.stringify(settings),
    }),

  findRoom: (code: string) => req<RoomLookup>(`/api/rooms/${code}`),

  updateProfile: (input: { displayName: string }) =>
    req<AuthUser>('/api/me', { method: 'PATCH', body: JSON.stringify(input) }),

  uploadAvatar: (blob: Blob) =>
    req<{ avatarVer: number }>('/api/me/avatar', { method: 'PUT', headers: { 'content-type': 'image/jpeg' }, body: blob }),
};

/** Versioned so the immutable cache never shows a stale photo. */
export function avatarUrl(userId: string, avatarVer: number): string {
  return `/api/avatars/${userId}?v=${avatarVer}`;
}
