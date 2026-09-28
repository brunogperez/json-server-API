import request from 'supertest';
import app from '../src/app.js';
import User from '../src/models/User.js';
import { connectTestDb, disconnectTestDb } from './helpers/db.js';

const PASSWORD = 'secret123';

const register = (email, extra = {}) =>
  request(app).post('/api/users').send({ firstName: 'Test', lastName: 'User', email, password: PASSWORD, ...extra });

const login = async (email) => {
  const res = await request(app).post('/api/users/login').send({ email, password: PASSWORD });
  return res.body;
};

beforeAll(() => connectTestDb('auth'));
afterAll(() => disconnectTestDb());

describe('POST /api/users (registro público)', () => {
  it('ignora el role enviado y crea siempre role=user', async () => {
    const res = await register('wannabe.admin@example.com', { role: 'admin' });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe('user');
    const stored = await User.findOne({ email: 'wannabe.admin@example.com' });
    expect(stored.role).toBe('user');
  });
});

describe('PUT/PATCH /api/users/:id (lista de campos permitidos)', () => {
  let user;
  let token;

  beforeAll(async () => {
    await register('self.editor@example.com');
    ({ token, ...user } = await login('self.editor@example.com'));
  });

  it('un usuario no puede escalar su rol ni tocar campos internos', async () => {
    const res = await request(app)
      .patch(`/api/users/${user.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Nuevo', role: 'admin', resellerProfile: user.id, tokenVersion: 99, failedLoginAttempts: -1 });

    expect(res.status).toBe(200);
    const stored = await User.findById(user.id);
    expect(stored.firstName).toBe('Nuevo');
    expect(stored.role).toBe('user');
    expect(stored.resellerProfile).toBeUndefined();
    expect(stored.tokenVersion).toBe(0);
    expect(stored.failedLoginAttempts).toBe(0);
  });

  it('PUT también descarta la contraseña', async () => {
    await request(app)
      .put(`/api/users/${user.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'hackeada' });

    const res = await request(app).post('/api/users/login').send({ email: 'self.editor@example.com', password: PASSWORD });
    expect(res.status).toBe(200);
  });
});

describe('Refresh tokens', () => {
  const email = 'refresh.user@example.com';

  beforeAll(() => register(email));

  it('rota el refresh token en cada uso', async () => {
    const { refreshToken } = await login(email);

    const res = await request(app).post('/api/users/refresh').send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.refreshToken).not.toBe(refreshToken);
  });

  it('reusar un refresh token ya rotado revoca todas las sesiones', async () => {
    const { token, refreshToken: first } = await login(email);
    const rotated = await request(app).post('/api/users/refresh').send({ refreshToken: first });
    const second = rotated.body.refreshToken;

    const reuse = await request(app).post('/api/users/refresh').send({ refreshToken: first });
    expect(reuse.status).toBe(401);

    const afterReuse = await request(app).post('/api/users/refresh').send({ refreshToken: second });
    expect(afterReuse.status).toBe(401);

    const profile = await request(app).get('/api/users/profile').set('Authorization', `Bearer ${token}`);
    expect(profile.status).toBe(401);
  });

  it('logout revoca sólo el refresh token de esa sesión', async () => {
    const sessionA = await login(email);
    const sessionB = await login(email);

    const out = await request(app).post('/api/users/logout').send({ refreshToken: sessionA.refreshToken });
    expect(out.status).toBe(200);

    const refreshA = await request(app).post('/api/users/refresh').send({ refreshToken: sessionA.refreshToken });
    const refreshB = await request(app).post('/api/users/refresh').send({ refreshToken: sessionB.refreshToken });
    expect(refreshA.status).toBe(401);
    expect(refreshB.status).toBe(200);
  });

  it('logout-all invalida los access tokens emitidos', async () => {
    const { token } = await login(email);

    const out = await request(app).post('/api/users/logout-all').set('Authorization', `Bearer ${token}`);
    expect(out.status).toBe(200);

    const profile = await request(app).get('/api/users/profile').set('Authorization', `Bearer ${token}`);
    expect(profile.status).toBe(401);
  });

  it('refresh con token inválido devuelve 401 y sin token 400', async () => {
    const invalid = await request(app).post('/api/users/refresh').send({ refreshToken: 'garbage.token.value' });
    const missing = await request(app).post('/api/users/refresh').send({});
    expect(invalid.status).toBe(401);
    expect(missing.status).toBe(400);
  });
});

describe('Password reset', () => {
  const email = 'reset.user@example.com';

  beforeAll(() => register(email));

  it('resetear la contraseña cierra las sesiones abiertas y el token es de un solo uso', async () => {
    const { token } = await login(email);
    const requested = await request(app).post('/api/users/password-reset/request').send({ email });
    const { resetToken } = requested.body;
    expect(resetToken).toBeTruthy(); // NODE_ENV=test lo expone

    const confirm = await request(app)
      .post('/api/users/password-reset/confirm')
      .send({ token: resetToken, newPassword: 'nueva1234' });
    expect(confirm.status).toBe(200);

    const profile = await request(app).get('/api/users/profile').set('Authorization', `Bearer ${token}`);
    expect(profile.status).toBe(401);

    const reuse = await request(app)
      .post('/api/users/password-reset/confirm')
      .send({ token: resetToken, newPassword: 'otra12345' });
    expect(reuse.status).toBe(401);
  });
});
