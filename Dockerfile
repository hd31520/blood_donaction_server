FROM node:20-alpine AS base
WORKDIR /app

COPY package*.json ./
COPY server/package*.json ./server/
RUN npm install --omit=dev --workspace server --no-audit --no-fund

COPY server ./server

WORKDIR /app/server
EXPOSE 5000
CMD ["node", "src/server.js"]
