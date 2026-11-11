FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN npm install -g pnpm@11.18.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# QEMU can crash V8's optimizing amd64 JIT on ARM builders. Native CI keeps normal Node.
ARG BUILDARCH
ARG TARGETARCH
RUN if [ "$BUILDARCH" != "$TARGETARCH" ]; then node --no-opt node_modules/next/dist/bin/next build && node .neander/prepare-standalone.mjs; else pnpm build; fi

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY .neander/entrypoint.sh /entrypoint.sh
USER node
EXPOSE 8080
ENTRYPOINT ["sh", "/entrypoint.sh"]
CMD ["node", "server.js"]
