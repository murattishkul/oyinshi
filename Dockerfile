# Dockerfile
FROM node:18-alpine

# Установка зависимостей системы
RUN apk add --no-cache \
    ca-certificates \
    curl \
    && rm -rf /var/cache/apk/*

# Создание пользователя приложения
RUN addgroup -g 1001 -S nodejs
RUN adduser -S oyinshi -u 1001

# Создание рабочей директории
WORKDIR /app

# Копирование package.json и package-lock.json
COPY package*.json ./
COPY prisma ./prisma/

# Установка зависимостей
RUN npm ci --only=production && npm cache clean --force

# Генерация Prisma Client
RUN npx prisma generate

# Копирование исходного кода
COPY --chown=oyinshi:nodejs . .

# Переключение на пользователя приложения
USER oyinshi

# Expose порт
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Запуск приложения
CMD ["npm", "start"]
