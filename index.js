const TelegramBot = require('node-telegram-bot-api')
const express = require('express')
const bodyParser = require('body-parser')
const path = require('path')
const dotenv = require('dotenv')
const { handleAdminScenario } = require('./src/scenarios/admin')
const { handleGroupScenario } = require('./src/scenarios/group')
const {
  handleBotStatusChange,
  setupBotHandlers
} = require('./src/scenarios/init')
const {
  createAdminOnPrivateChat
} = require('./src/scenarios/admin/controllers/create-admin')

dotenv.config({ path: path.resolve(__dirname, '.', '.env') })

const token = process.env.TELEGRAM_BOT_TOKEN
const bot = new TelegramBot(token, { polling: true })

// Создайте экземпляр Express
const app = express()
const port = process.env.PORT || 3000

// Установите вебхук
const url = 'https://3f37-178-90-75-249.ngrok-free.app' // Убедитесь, что это ваш действующий URL

// Настройка тела запроса в формате JSON
app.use(bodyParser.json())

// Обработчик вебхуков
app.post('/webhook', (req, res) => {
  const update = req.body

  // Передайте обновление в Telegram Bot API
  bot.processUpdate(update)

  res.sendStatus(200)
})

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  })
})

// Установите вебхук
bot.setWebHook(`${url}/webhook`)

// Запустите сервер
app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})

// Обработка команды /start
bot.onText(/\/start/, (msg) => {
	const chatId = msg.chat.id
	bot.sendMessage(chatId, 'Привет! Я ваш новый Telegram-бот.')
})

// Слушаем сообщения
bot.on('message', async (msg) => {
  try {
    await handleMessage(bot, msg)
  } catch (error) {
    console.error('Error handling message:', error)
    await bot.sendMessage(
      msg.chat.id,
      '❌ Произошла ошибка. Попробуйте позже.'
    )
  }
})

// Обработка изменений статуса бота
bot.on('my_chat_member', async (update) => {
  await handleBotStatusChange(bot, update)
})

setupBotHandlers(bot)

// Основной обработчик сообщений
const handleMessage = async (bot, msg) => {
  const chatId = msg.chat.id
  const userId = msg.from.id
  const text = msg.text
  const username = msg.from.username
  const firstName = msg.from.first_name
  const lastName = msg.from.last_name

  // Проверяем тип чата
  if (msg.chat.type === 'private') {
    // ЛИЧНЫЙ ЧАТ - создаем/обновляем админа
    await createAdminOnPrivateChat(userId, username, firstName, lastName)

    // Обрабатываем как админский сценарий
    await handleAdminScenario(bot, chatId, userId, text, username, msg)
  } else if (['group', 'supergroup'].includes(msg.chat.type)) {
    // ГРУППОВОЙ ЧАТ - НЕ создаем админов, только обрабатываем игровую логику
    // Здесь можно обрабатывать реакции на опросы игр
    await handleGroupScenario(bot, msg)
  }
}

module.exports = {
  app
}
