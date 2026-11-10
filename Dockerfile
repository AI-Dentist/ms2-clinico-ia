FROM --platform=linux/amd64 node:24-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
# CPU binaries ship in the npm package; do not run its source-only prepare lifecycle.
RUN node node_modules/onnxruntime-node/script/install --onnxruntime-node-install=skip \
    && node -e "require('onnxruntime-node'); require('sharp'); require('@tensorflow/tfjs'); console.log('native-ok')"
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY scripts/fetch-dental-model.mjs ./scripts/fetch-dental-model.mjs
RUN pnpm run build && node scripts/fetch-dental-model.mjs
RUN pnpm prune --prod

FROM --platform=linux/amd64 node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=8002 DENTAL_MODEL_PATH=/app/models/dental-panoramic/best.onnx
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/models ./models
USER node
EXPOSE 8002
CMD ["node", "dist/main.js"]
