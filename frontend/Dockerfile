# ── 빌드 스테이지 ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

# 의존성 먼저 설치 (캐시 활용)
COPY package.json package-lock.json* ./
RUN npm ci

# 소스 복사 및 빌드
COPY . .
RUN npm run build

# ── 서빙 스테이지 ───────────────────────────────────────────────────────────────
FROM nginx:stable-alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
