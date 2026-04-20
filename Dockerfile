# syntax=docker/dockerfile:1.7

FROM node:lts-alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3 make g++ libtool autoconf automake

COPY package.json package-lock.json* ./
RUN npm install --include=dev

COPY tsconfig.json ./
COPY src ./src

RUN npm run build
RUN npm prune --omit=dev


FROM node:lts-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache ffmpeg yt-dlp python3 \
    && addgroup -S maple && adduser -S maple -G maple

COPY --from=builder --chown=maple:maple /app/node_modules ./node_modules
COPY --from=builder --chown=maple:maple /app/dist ./dist
COPY --chown=maple:maple package.json ./

USER maple

CMD ["node", "dist/index.js"]
