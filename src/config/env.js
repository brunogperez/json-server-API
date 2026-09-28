// Validación de variables de entorno al arrancar. Falla rápido en vez de
// operar con secretos derivados, vacíos o credenciales sin cifrar.

const MIN_SECRET_LENGTH = 32;

export const validateEnv = (env = process.env) => {
  const errors = [];
  const isProd = env.NODE_ENV === 'production';

  if (!isProd && !env.JWT_SECRET) {
    errors.push('JWT_SECRET es obligatorio');
  }

  if (isProd) {
    for (const name of ['JWT_SECRET', 'REFRESH_TOKEN_SECRET', 'PASSWORD_RESET_SECRET']) {
      if (!env[name] || env[name].length < MIN_SECRET_LENGTH) {
        errors.push(`${name} es obligatorio en producción (mínimo ${MIN_SECRET_LENGTH} caracteres)`);
      }
    }
    if (!/^[0-9a-fA-F]{64}$/.test(env.ENCRYPTION_KEY || '')) {
      errors.push('ENCRYPTION_KEY es obligatoria en producción (64 caracteres hex)');
    }
  }

  return errors;
};
