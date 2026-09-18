export type ScreenName = 'login' | 'home' | 'profile' | 'lobby' | 'room' | 'table';

export const route = $state<{ name: ScreenName; params: Record<string, string> }>({
  name: 'login',
  params: {},
});

function parse(hash: string): { name: ScreenName; params: Record<string, string> } {
  const path = hash.replace(/^#\/?/, '');
  const [head, param] = path.split('/');
  if (head === 'home') return { name: 'home', params: {} };
  if (head === 'profile') return { name: 'profile', params: {} };
  if (head === 'lobby') return { name: 'lobby', params: {} };
  if (head === 'room' && param) return { name: 'room', params: { code: param.toUpperCase() } };
  if (head === 'table' && param) return { name: 'table', params: { code: param.toUpperCase() } };
  return { name: 'login', params: {} };
}

function sync(): void {
  const next = parse(location.hash);
  route.name = next.name;
  route.params = next.params;
}

export function go(hash: string): void {
  location.hash = hash;
}

export function initRouter(): void {
  sync();
  window.addEventListener('hashchange', sync);
}
