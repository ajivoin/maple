FROM node:24-alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3 make g++ libtool autoconf automake opus-dev

COPY package.json package-lock.json* ./
RUN npm install --include=dev

COPY tsconfig.json ./
COPY src ./src

RUN npm run build
RUN npm prune --omit=dev


FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache ffmpeg python3 py3-pip \
    && pip3 install --break-system-packages --no-cache-dir yt-dlp \
    && addgroup -S maple && adduser -S maple -G maple

COPY --from=builder --chown=maple:maple /app/node_modules ./node_modules
COPY --from=builder --chown=maple:maple /app/dist ./dist
COPY --chown=maple:maple package.json ./

USER maple

CMD ["node", "dist/index.js"]
