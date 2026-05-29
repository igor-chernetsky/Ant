# Single-stage build — lower peak disk use on small EC2 (no COPY node_modules between stages).
# For CI/production with more disk, a multi-stage variant can be used later.

FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

ENV PORT=3000

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

ENV NODE_ENV=production

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
