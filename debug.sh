#!/bin/bash

echo "🔍 Диагностика проблем с Docker контейнерами"

# Остановка всех контейнеров
echo "🛑 Остановка контейнеров..."
docker-compose down

# Очистка логов
echo "🧹 Очистка логов..."
rm -rf logs/*

# Запуск только PostgreSQL
echo "🗄️ Запуск только PostgreSQL..."
docker-compose up -d postgres

# Ожидание запуска PostgreSQL
echo "⏳ Ожидание PostgreSQL..."
sleep 15

# Проверка PostgreSQL
echo "🔍 Проверка PostgreSQL..."
docker-compose exec postgres pg_isready -U oyinshi_user -d oyinshi

if [ $? -eq 0 ]; then
    echo "✅ PostgreSQL работает"
else
    echo "❌ PostgreSQL не работает"
    echo "📋 Логи PostgreSQL:"
    docker-compose logs postgres
    exit 1
fi

# Проверка переменных окружения
echo "🔍 Проверка .env файла..."
if [ ! -f .env ]; then
    echo "❌ Файл .env не найден!"
    exit 1
fi

# Показать переменные (без токенов)
echo "📋 Переменные окружения:"
grep -v "TOKEN\|PASSWORD" .env || echo "Нет переменных для показа"

# Проверка Dockerfile
echo "🔍 Проверка сборки образа..."
docker build -t oyinshi-debug . || {
    echo "❌ Ошибка сборки Docker образа"
    exit 1
}

# Проверка что приложение может запуститься
echo "🔍 Тест запуска приложения..."
docker run --rm \
    --link oyinshi_postgres_debug:postgres \
    -e DATABASE_URL="postgresql://oyinshi_user:your_secure_password@postgres:5432/oyinshi?schema=public" \
    -e TELEGRAM_BOT_TOKEN="dummy_token_for_test" \
    -e NODE_ENV="development" \
    oyinshi-debug \
    sh -c "echo 'Testing app startup...' && node --version && npm --version && ls -la"

echo "🔍 Попытка выполнить Prisma команды..."
docker run --rm \
    --link oyinshi_postgres_debug:postgres \
    -e DATABASE_URL="postgresql://oyinshi_user:your_secure_password@postgres:5432/oyinshi?schema=public" \
    oyinshi-debug \
    sh -c "npx prisma db push --accept-data-loss || npx prisma migrate deploy || echo 'Prisma commands failed'"

# Запуск приложения в отладочном режиме
echo "🚀 Запуск приложения в отладочном режиме..."
docker-compose -f docker-compose.debug.yml up app
