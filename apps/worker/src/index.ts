import { Hono } from 'hono';
import { RULES_VERSION } from '@samloc/rules';
import { authMiddleware, type AuthedVariables } from './auth-middleware';
import { authRoutes } from './routes-auth';
import { profileRoutes } from './routes-profile';
import { rewardRoutes } from './routes-rewards';
import { roomRoutes } from './routes-rooms';
import { wsRoutes } from './routes-ws';

export { RoomDO } from './room-do';

const PUBLIC_API_PATHS = new Set(['/api/register', '/api/login', '/api/health']);

const app = new Hono<{ Bindings: Env; Variables: AuthedVariables }>();

app.get('/api/health', (c) => c.json({ ok: true, rules: RULES_VERSION }));

app.use('/api/*', (c, next) => {
  if (PUBLIC_API_PATHS.has(c.req.path)) return next();
  return authMiddleware(c, next);
});

app.route('/api', authRoutes);
app.route('/api', profileRoutes);
app.route('/api', rewardRoutes);
app.route('/api', roomRoutes);
app.route('/', wsRoutes);

app.onError((_err, c) => c.json({ error: 'Đã có lỗi xảy ra, vui lòng thử lại' }, 500));

export default { fetch: app.fetch } satisfies ExportedHandler<Env>;
