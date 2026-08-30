FROM node:24-alpine

WORKDIR /app
COPY package.json ./
COPY backend ./backend
COPY frontend ./frontend

RUN addgroup -g 10001 app \
    && adduser -D -H -u 10001 -G app app \
    && chown -R 10001:10001 /app

USER 10001:10001
ENV NODE_ENV=production \
    PORT=8080
EXPOSE 8080

CMD ["node", "backend/server.mjs"]

