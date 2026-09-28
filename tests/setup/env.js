// Corre antes de cada archivo de test, antes de importar la app: las rutas leen
// process.env a nivel de módulo (rate limiters, secretos).
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-0123456789abcdef0123456789';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-0123456789abcdef012345';
process.env.PASSWORD_RESET_SECRET = 'test-reset-secret-0123456789abcdef01234567';
process.env.ENCRYPTION_KEY = 'a'.repeat(64);
process.env.RATE_LIMIT_MAX_REQUESTS = '100000';
process.env.LOGIN_RATE_LIMIT_MAX_REQUESTS = '100000';
process.env.PASSWORD_RESET_RATE_LIMIT_MAX = '100000';
process.env.LOG_LEVEL = 'error';
