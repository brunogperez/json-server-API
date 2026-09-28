// Side-effect import: se ejecuta antes de cargar las rutas (orden de imports ESM)
// y corta el arranque si la configuración es insegura.
import { validateEnv } from './env.js';

const errors = validateEnv();
if (errors.length > 0) {
  console.error('Configuración inválida, el servidor no arranca:');
  errors.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
}
