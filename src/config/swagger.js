import swaggerJSDoc from 'swagger-jsdoc';

/**
 * Spec OpenAPI 3 mínima. Documenta auth (Bearer JWT) y los recursos
 * principales. Las rutas se describen a alto nivel; se puede ampliar con
 * anotaciones JSDoc `@openapi` en los archivos de `routes/`.
 */
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Reseller Services API',
      version: '3.0.0',
      description:
        'API para gestión de resellers, clientes finales, planes, suscripciones y créditos. ' +
        'Autenticación con JWT Bearer. Las credenciales de suscripción se cifran en reposo (AES-256-GCM).',
    },
    servers: [
      { url: '/api/v1', description: 'v1 (versionada)' },
      { url: '/api', description: 'alias sin versión (compat)' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Login y usuarios' },
      { name: 'Resellers', description: 'Resellers y créditos' },
      { name: 'EndCustomers', description: 'Clientes finales' },
      { name: 'Plans', description: 'Planes de servicio' },
      { name: 'Subscriptions', description: 'Suscripciones y ciclo de vida' },
      { name: 'CreditTransactions', description: 'Historial de movimientos de crédito' },
    ],
  },
  apis: ['./src/routes/*.js'],
};

export const swaggerSpec = swaggerJSDoc(options);
