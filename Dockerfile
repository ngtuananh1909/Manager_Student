# ==============================================================================
# ChauCaoJudge — Production Dockerfile
# ==============================================================================
FROM node:22-alpine

# Cài đặt trình biên dịch g++, python3 và build-tools để hỗ trợ Argon2 và C++ Judge
RUN apk add --no-cache python3 make g++ gcc musl-dev

WORKDIR /app

# Copy package files và cài đặt dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy toàn bộ source code
COPY . .

# Build Vite frontend production bundle
RUN npx vite build

# Mở cổng 4000 cho backend HTTP và Socket.IO
EXPOSE 4000

ENV NODE_ENV=production
ENV PORT=4000
ENV SCHOOLJUDGE_DB_MODE=postgres

# Khởi chạy máy chủ
CMD ["node", "server/index.cjs"]
