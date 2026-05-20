# ⚽ Oyinshi Bot

> Telegram bot for organizing football matches in group chats

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.0+-blue.svg)](https://www.prisma.io/)
[![Telegram Bot API](https://img.shields.io/badge/Telegram_Bot_API-Latest-blue.svg)](https://core.telegram.org/bots/api)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 📖 Description

Oyinshi Bot is a Telegram bot that simplifies organizing football games in group chats. Administrators can create matches by specifying the date, time, location, and number of players, while group members can easily join games using interactive buttons.

### ✨ Key Features

- 🎯 **Game Creation** - Easily create football matches with complete details
- 👥 **Participant Management** - Automatic tracking of registered players
- 📊 **Statistics** - Personal stats for participants and administrators
- 🏆 **Ranking System** - Titles and ranks for active players
- 💬 **Interactive Polls** - Convenient buttons for joining games
- 🔒 **Access Control** - Only group admins can create games

## 🚀 Quick Start

### Prerequisites

- Node.js 18.0+
- PostgreSQL or any other database supported by Prisma
- Telegram Bot Token (get it from [@BotFather](https://t.me/botfather))

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/murattishkul/oyinshi.git
   cd oyinshi
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   ```bash
   cp .env.example .env
   ```

   Fill in the `.env` file:

   ```env
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   DATABASE_URL="postgresql://user:password@localhost:5432/oyinshi_bot"
   PORT=3000
   WEBHOOK_URL=https://your-domain.com
   ```

4. **Set up the database**

   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

5. **Start the bot**

   ```bash
   npm start
   ```

## 🎮 How to Use

### For Group Administrators

1. **Add the bot to a group** as an administrator
2. **Create a game** using the `/create_game` command in a private chat with the bot
3. **Configure game settings:**
   - 📅 Date and time
   - 📍 Location
   - 👥 Number of players
4. **Launch the poll** in the selected group

### For Participants

1. **Find the poll** in the group chat
2. **Click a button:**
   - ✅ **Going** - join the game
   - ❌ **Not Going** - decline participation
   - 🤔 **Maybe** - unsure
3. **Track live updates** of participant statistics in real time

## 📋 Bot Commands

### Private Chat (for administrators)

- `/start` - Main menu and statistics
- `/create_game` - Create a new game
- `/my_games` - View created games
- `/profile` - Personal participation statistics
- `/stats` - Administrator statistics
- `/help` - Command reference

### Group Chat

- The bot automatically processes poll button interactions
- Updates participant statistics in real time

## 🏆 Ranking System

Participants receive titles based on the number of games played:

- 🌱 **Beginner** - 1+ games
- ⚽ **Active Player** - 5+ games
- ⭐ **Team Star** - 10+ games
- 🏆 **Field Legend** - 20+ games

## 🔧 Architecture

```text
src/
├── scenarios/
│   ├── admin/           # Administrator logic
│   ├── group/           # Group logic
│   └── init/            # Initialization and handlers
├── utils/               # Utility functions
└── db/
    └── prisma/          # Database schema and configuration
```

### Main Components

- **Admin Scenarios** - Game creation, management, and statistics
- **Group Scenarios** - Handling game participation
- **Database Layer** - Prisma ORM for database operations
- **Bot Handlers** - Telegram event handlers

## 🛠 API Endpoints

When using webhook mode:

- `POST /webhook` - Handle Telegram updates

## 📊 Database

### Main Tables

- **Admin** - Administrators who create games
- **Group** - Telegram groups with the active bot
- **Game** - Created games
- **Participant** - Game participants

## 🚀 Deployment

### Heroku

```bash
heroku create your-oyinshi-bot
heroku config:set TELEGRAM_BOT_TOKEN=your_token
heroku config:set DATABASE_URL=your_database_url
git push heroku main
```

### Docker

```bash
docker build -t oyinshi-bot .
docker run -p 3000:3000 --env-file .env oyinshi-bot
```

### PM2 (Production)

```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## ⚠️ Environment Requirements

- **Node.js** 18.0 or higher
- **PostgreSQL** 13+ (or another database supported by Prisma)
- **Telegram Bot Token**
- **HTTPS** for webhooks (in production)

## 📝 Changelog

### v1.0.0

- ✅ Core game creation functionality
- ✅ Interactive polls with buttons
- ✅ Participant and administrator statistics
- ✅ Ranking system
- ✅ Multiple group support

## 🐛 Known Issues

- Messages may become too long with a large number of participants
- Webhooks require an HTTPS connection

## 📞 Support

- 🐛 **Bugs**: [GitHub Issues](https://github.com/murattishkul/oyinshi/issues)
- 💡 **Suggestions**: [GitHub Discussions](https://github.com/murattishkul/oyinshi/discussions)
- 📧 **Email**: murat.tishkul@gmail.com

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgements

- [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api) - Telegram Bot API for Node.js
- [Prisma](https://www.prisma.io/) - Modern ORM for Node.js
- [Express.js](https://expressjs.com/) - Web framework for Node.js

---

<div align="center">

**⚽ Made with ❤️ for the Mrazi football community**

[Demo](https://t.me/oyinshi_bot) • [Documentation](https://github.com/murattishkul/oyinshi/wiki) • [Support](mailto:murat.tishkul@gmail.com)

</div>
