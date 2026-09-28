# ── Backend: Reseller Services API ──────────────────────────────────
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# Instalar solo dependencias de producción (mejor cache: copiamos manifests primero)
COPY package*.json ./
RUN npm ci --omit=dev

# Código fuente
COPY src ./src

# Usuario no-root (la imagen node trae el usuario `node`)
RUN mkdir -p logs && chown -R node:node /app
USER node

EXPOSE 3000

# Healthcheck contra el endpoint /health
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]
