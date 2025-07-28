# ⚽ Oyinshi Bot

> Telegram бот для организации футбольных матчей в группах

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.0+-blue.svg)](https://www.prisma.io/)
[![Telegram Bot API](https://img.shields.io/badge/Telegram_Bot_API-Latest-blue.svg)](https://core.telegram.org/bots/api)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 📖 Описание

Oyinshi Bot — это Telegram бот, который упрощает организацию футбольных игр в групповых чатах. Администраторы могут создавать игры с указанием даты, времени, места и количества игроков, а участники группы могут легко записываться на игру с помощью интерактивных кнопок.

### ✨ Основные возможности

- 🎯 **Создание игр** - Простое создание футбольных матчей с полной информацией
- 👥 **Управление участниками** - Автоматический подсчет записавшихся игроков
- 📊 **Статистика** - Личная статистика участников и администраторов
- 🏆 **Система рейтингов** - Звания для активных игроков
- 💬 **Интерактивные опросы** - Удобные кнопки для записи на игру
- 🔒 **Контроль доступа** - Только администраторы групп могут создавать игры

## 🚀 Быстрый старт

### Предварительные требования

- Node.js 18.0+
- PostgreSQL или любая другая БД, поддерживаемая Prisma
- Telegram Bot Token (получить у [@BotFather](https://t.me/botfather))

### Установка

1. **Клонируйте репозиторий**
   ```bash
   git clone https://github.com/murattishkul/oyinshi.git
   cd oyinshi
   ```

2. **Установите зависимости**
   ```bash
   npm install
   ```

3. **Настройте переменные окружения**
   ```bash
   cp .env.example .env
   ```

   Заполните `.env` файл:
   ```env
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   DATABASE_URL="postgresql://user:password@localhost:5432/football_bot"
   PORT=3000
   WEBHOOK_URL=https://your-domain.com
   ```

4. **Настройте базу данных**
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

5. **Запустите бота**
   ```bash
   npm start
   ```

## 🎮 Как использовать

### Для администраторов групп

1. **Добавьте бота в группу** как администратора
2. **Создайте игру** командой `/create_game` в личном чате с ботом
3. **Настройте параметры игры:**
    - 📅 Дата и время
    - 📍 Место проведения
    - 👥 Количество игроков
4. **Запустите опрос** в выбранной группе

### Для участников

1. **Найдите опрос** в групповом чате
2. **Нажмите кнопку:**
    - ✅ **Иду** - записаться на игру
    - ❌ **Не иду** - отказаться от участия
    - 🤔 **Возможно** - под вопросом
3. **Следите за обновлениями** статистики в реальном времени

## 📋 Команды бота

### Личный чат (для администраторов)
- `/start` - Главное меню и статистика
- `/create_game` - Создать новую игру
- `/my_games` - Посмотреть созданные игры
- `/profile` - Личная статистика участия
- `/stats` - Статистика администратора
- `/help` - Справка по командам

### Групповой чат
- Бот автоматически обрабатывает нажатия на кнопки опросов
- Обновляет статистику участников в реальном времени

## 🏆 Система рейтингов

Участники получают звания на основе количества игр:

- 🌱 **Начинающий** - 1+ игр
- ⚽ **Активный игрок** - 5+ игр
- ⭐ **Звезда команды** - 10+ игр
- 🏆 **Легенда поля** - 20+ игр

## 🔧 Архитектура

```
src/
├── scenarios/
│   ├── admin/           # Логика для администраторов
│   ├── group/           # Логика для групп
│   └── init/            # Инициализация и обработчики
├── utils/               # Вспомогательные функции
└── db/
    └── prisma/          # Схема и конфигурация БД
```

### Основные компоненты

- **Admin Scenarios** - Создание игр, управление, статистика
- **Group Scenarios** - Обработка участия в играх
- **Database Layer** - Prisma ORM для работы с БД
- **Bot Handlers** - Обработчики событий Telegram

## 🛠 API Endpoints

При использовании webhook режима:

- `POST /webhook` - Обработка обновлений от Telegram

## 📊 База данных

### Основные таблицы

- **Admin** - Администраторы, создающие игры
- **Group** - Telegram группы с активным ботом
- **Game** - Созданные игры
- **Participant** - Участники игр

## 🚀 Развертывание

### Heroku
```bash
heroku create your-football-bot
heroku config:set TELEGRAM_BOT_TOKEN=your_token
heroku config:set DATABASE_URL=your_database_url
git push heroku main
```

### Docker
```bash
docker build -t football-bot .
docker run -p 3000:3000 --env-file .env football-bot
```

### PM2 (Production)
```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 🤝 Вклад в проект

1. Fork репозиторий
2. Создайте feature branch (`git checkout -b feature/amazing-feature`)
3. Commit изменения (`git commit -m 'Add amazing feature'`)
4. Push в branch (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

## ⚠️ Требования к окружению

- **Node.js** 18.0 или выше
- **PostgreSQL** 13+ (или другая БД через Prisma)
- **Telegram Bot Token**
- **HTTPS** для webhook (в продакшене)

## 📝 Changelog

### v1.0.0
- ✅ Базовая функциональность создания игр
- ✅ Интерактивные опросы с кнопками
- ✅ Статистика участников и администраторов
- ✅ Система рейтингов
- ✅ Поддержка множественных групп

## 🐛 Известные проблемы

- При большом количестве участников сообщение может стать слишком длинным
- Webhook требует HTTPS соединения

## 📞 Поддержка

- 🐛 **Баги**: [GitHub Issues](https://github.com/murattishkul/oyinshi/issues)
- 💡 **Предложения**: [GitHub Discussions](https://github.com/murattishkul/oyinshi/discussions)
- 📧 **Email**: your.email@example.com

## 📄 Лицензия

Этот проект лицензирован под MIT License - смотрите [LICENSE](LICENSE) файл для деталей.

## 🙏 Благодарности

- [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api) - Telegram Bot API для Node.js
- [Prisma](https://www.prisma.io/) - Современная ORM для Node.js
- [Express.js](https://expressjs.com/) - Веб фреймворк для Node.js

---

<div align="center">

**⚽ Сделано с ❤️ для футбольного сообщества Mrazi**

[Демо](https://t.me/oyinshi_bot) • [Документация](https://github.com/murattishkul/oyinshi/wiki) • [Поддержка](mailto:murat.tishkul@gmail.com)

</div>
