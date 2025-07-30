#!/bin/bash

set -e  # Остановка при ошибке

echo "🚀 Деплой Oyinshi Telegram бота"

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Функция для цветного вывода
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Проверка Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker не установлен!"
    echo "Запустите: bash install-docker.sh"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose не установлен!"
    echo "Запустите: bash install-docker.sh"
    exit 1
fi

# Проверка .env файла
if [ ! -f .env ]; then
    print_error "Файл .env не найден!"
    echo "Создайте .env файл с необходимыми переменными"
    exit 1
fi

# Создание необходимых директорий
print_status "Создание директорий..."
mkdir -p logs backups

# Создание nginx директорий только если nginx включен в compose
if grep -q "container_name: oyinshi_nginx" docker-compose.yml && ! grep -q "# *nginx:" docker-compose.yml; then
    print_status "Создание директорий для Nginx..."
    mkdir -p nginx/logs nginx/ssl

    # Создание базового nginx.conf если не существует
    if [ ! -f nginx/nginx.conf ]; then
        print_warning "Создание базового nginx.conf..."
        # Здесь можно добавить создание базового конфига
    fi
fi

# Остановка и удаление старых контейнеров
print_status "Остановка старых контейнеров..."
docker-compose down --remove-orphans

# Очистка старых образов (опционально)
read -p "Очистить старые Docker образы? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Очистка старых образов..."
    docker system prune -f
    docker image prune -f
fi

# Сборка образов
print_status "Сборка Docker образа..."
docker-compose build --no-cache

# Запуск сервисов
print_status "Запуск сервисов..."
docker-compose up -d

# Ожидание запуска базы данных
print_status "Ожидание запуска PostgreSQL..."
sleep 15

# Проверка здоровья базы данных
print_status "Проверка подключения к базе данных..."
for i in {1..30}; do
    if docker-compose exec -T postgres pg_isready -U oyinshi_user -d oyinshi; then
        print_status "База данных готова!"
        break
    fi
    if [ $i -eq 30 ]; then
        print_error "База данных не запустилась за 30 попыток"
        docker-compose logs postgres
        exit 1
    fi
    echo "Попытка $i/30..."
    sleep 2
done

# Запуск миграций
print_status "Применение миграций базы данных..."
docker-compose exec -T app npx prisma migrate deploy

# Генерация Prisma Client (на всякий случай)
print_status "Генерация Prisma Client..."
docker-compose exec -T app npx prisma generate

# Проверка статуса сервисов
print_status "Проверка статуса сервисов..."
docker-compose ps

# Проверка логов
print_status "Последние логи приложения:"
docker-compose logs --tail=20 app

# Health check
print_status "Проверка работоспособности..."
sleep 5
if curl -f http://localhost:3000/health; then
    print_status "✅ Приложение успешно запущено!"
else
    print_warning "Health check не прошел, проверьте логи"
    docker-compose logs app
fi

# Информация для настройки webhook
echo ""
echo "🔗 Настройка Telegram Webhook:"
echo "curl -X POST https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook -d url=https://your-domain.com/webhook"
echo ""
echo "📊 Полезные команды:"
echo "  Логи:           docker-compose logs -f"
echo "  Перезапуск:     docker-compose restart"
echo "  Остановка:      docker-compose down"
echo "  Статус:         docker-compose ps"
echo ""
print_status "🎉 Деплой завершен!"
