FROM node:24-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY backend ./backend
COPY frontend ./frontend

RUN addgroup -g 10001 app \
    && adduser -D -H -u 10001 -G app app \
    && mkdir -p /data/uploads \
    && chown -R 10001:10001 /app /data

USER 10001:10001
ENV NODE_ENV=production \
    PORT=8080
EXPOSE 8080

CMD ["node", "backend/server.mjs"]
