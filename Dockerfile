# ---- Build ----
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ---- Runtime ----
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
# ffmpeg é necessário para transcodificar o áudio.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
# Executa como usuário não-root (já existente na imagem node).
USER node
CMD ["node", "dist/index.js"]
