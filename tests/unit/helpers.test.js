import { searchPattern } from '../../src/middleware/helpers.js';
import { validateEnv } from '../../src/config/env.js';

describe('searchPattern', () => {
  it('escapa metacaracteres de regex para buscarlos literalmente', () => {
    const pattern = searchPattern('(a+)+$');
    expect(pattern).toBe('\\(a\\+\\)\\+\\$');
    expect(new RegExp(pattern).test('(a+)+$')).toBe(true);
  });

  it.each([
    ['array (?search=a&search=b)', ['a', 'b']],
    ['objeto con operador (?search[$ne]=x)', { $ne: 'x' }],
    ['sólo espacios', '   '],
    ['undefined', undefined]
  ])('descarta %s', (_label, value) => {
    expect(searchPattern(value)).toBeNull();
  });

  it('limita el largo a 100 caracteres', () => {
    expect(searchPattern('x'.repeat(500))).toHaveLength(100);
  });
});

describe('validateEnv', () => {
  const secret = 's'.repeat(32);
  const prodEnv = {
    NODE_ENV: 'production',
    JWT_SECRET: secret,
    REFRESH_TOKEN_SECRET: secret,
    PASSWORD_RESET_SECRET: secret,
    ENCRYPTION_KEY: 'a'.repeat(64)
  };

  it('en desarrollo sólo exige JWT_SECRET', () => {
    expect(validateEnv({})).toEqual(['JWT_SECRET es obligatorio']);
    expect(validateEnv({ JWT_SECRET: 'x' })).toEqual([]);
  });

  it('en producción acepta una configuración completa', () => {
    expect(validateEnv(prodEnv)).toEqual([]);
  });

  it.each(['REFRESH_TOKEN_SECRET', 'PASSWORD_RESET_SECRET', 'JWT_SECRET'])(
    'en producción rechaza %s ausente o corto',
    (name) => {
      expect(validateEnv({ ...prodEnv, [name]: 'corto' })).toHaveLength(1);
      expect(validateEnv({ ...prodEnv, [name]: undefined })).toHaveLength(1);
    }
  );

  it('en producción rechaza una ENCRYPTION_KEY que no es hex de 64', () => {
    expect(validateEnv({ ...prodEnv, ENCRYPTION_KEY: 'zz' })).toHaveLength(1);
  });
});
