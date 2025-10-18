# Tiny-LinkPix Dockerfile
FROM node:20-alpine

ENV NODE_ENV=production

WORKDIR /app

# Install dependencies first for better caching
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy source
COPY server.js db.js README.md ./
COPY public ./public

# Non-root user
RUN addgroup -S app && adduser -S app -G app
RUN mkdir -p /data/uploads && chown -R app:app /data
USER app

EXPOSE 3000
CMD ["node", "server.js"]
