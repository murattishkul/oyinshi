const prisma = require('../../../db/prisma')
const { isValidTime, isValidDate } = require('../../utils')

// Состояния админа
const ADMIN_STATES = {
  IDLE: 'IDLE',
  SELECTING_GROUP: 'SELECTING_GROUP',
  COLLECTING_METADATA: 'COLLECTING_METADATA',
  CONFIRMING_LAUNCH: 'CONFIRMING_LAUNCH'
}

// Временное хранилище состояний пользователей (в продакшене лучше использовать Redis)
const userStates = new Map()
const gameData = new Map()

const handleAdminScenario = async (
  bot,
  chatId,
  userId,
  text,
  username,
  msg
) => {
  const currentState = userStates.get(userId) || ADMIN_STATES.IDLE

  switch (currentState) {
    case ADMIN_STATES.IDLE:
      await handleIdleState(bot, chatId, userId, text, msg)
      break

    case ADMIN_STATES.SELECTING_GROUP:
      await handleGroupSelection(bot, chatId, userId, text, msg)
      break

    case ADMIN_STATES.COLLECTING_METADATA:
      await handleMetadataCollection(bot, chatId, userId, text, username)
      break

    case ADMIN_STATES.CONFIRMING_LAUNCH:
      await handleLaunchConfirmation(bot, chatId, userId, text)
      break

    default:
      userStates.set(userId, ADMIN_STATES.IDLE)
      await showMainMenu(bot, chatId)
  }
}

async function handleIdleState (bot, chatId, userId, text, msg) {
  switch (text) {
    case '/start':
      await showMainMenu(bot, chatId)
      break

    case '/create_game':
      userStates.set(userId, ADMIN_STATES.SELECTING_GROUP)
      gameData.set(userId, {})
      await handleGroupSelection(bot, chatId, userId, text, msg)
      break

    case '/my_games':
      await showUserGames(bot, chatId, userId)
      break

    case '/help':
      await showHelp(bot, chatId)
      break

    default:
      await bot.sendMessage(
        chatId,
        '❓ Неизвестная команда. Используйте /help для списка команд.'
      )
  }
}

async function handleGroupSelection (bot, chatId, userId, text, msg) {
  if (text === '/cancel') {
    userStates.set(userId, ADMIN_STATES.IDLE)
    gameData.delete(userId)
    return bot.sendMessage(chatId, '❌ Создание игры отменено.')
  }

  const currentGame = gameData.get(userId)

  // Если это первый вход в состояние - показываем список групп
  if (!currentGame?.availableGroups) {
    await loadAndShowAvailableGroups(bot, chatId, userId)
    return
  }

  const availableGroups = currentGame.availableGroups
  let selectedGroup = null

  // Проверяем, ввел ли пользователь номер группы
  const groupIndex = parseInt(text)
  if (groupIndex && groupIndex > 0 && groupIndex <= availableGroups.length) {
    selectedGroup = availableGroups[groupIndex - 1]
  }
  // Или ввел ID группы напрямую
  else if (text.startsWith('-')) {
    const groupId = text
    selectedGroup = availableGroups.find((g) => g.telegramId === groupId)
  }

  if (!selectedGroup) {
    return bot.sendMessage(
      chatId,
      '❌ Неверный выбор.\n\n' +
        '💡 Введите номер группы из списка (например: 1)\n' +
        '🔄 Для обновления списка используйте /create_game'
    )
  }

  try {
    // Проверяем права бота в выбранной группе
    const botInfo = await bot.getMe()
    const chatMember = await bot.getChatMember(
      selectedGroup.telegramId,
      botInfo.id
    )

    if (chatMember.status !== 'administrator') {
      await prisma.group.update({
        where: { telegramId: selectedGroup.telegramId },
        data: { isActive: false }
      })

      return bot.sendMessage(
        chatId,
        `❌ Бот больше не является администратором в группе "${selectedGroup.title}".\n\n` +
          '🔧 Проверьте права бота и попробуйте снова.\n' +
          '🔄 Используйте /create_game для обновления списка групп.'
      )
    }

    // Проверяем участие пользователя в группе
    try {
      const userMember = await bot.getChatMember(
        selectedGroup.telegramId,
        userId
      )
      if (['left', 'kicked'].includes(userMember.status)) {
        return bot.sendMessage(
          chatId,
          `❌ Вы больше не являетесь участником группы "${selectedGroup.title}".\n\n` +
            '👥 Присоединитесь к группе и попробуйте снова.'
        )
      }
    } catch (error) {
      return bot.sendMessage(
        chatId,
        `❌ Не удалось проверить ваше участие в группе "${selectedGroup.title}".\n\n` +
          '👥 Убедитесь, что вы являетесь участником группы.'
      )
    }

    // Сохраняем выбранную группу
    currentGame.groupId = selectedGroup.telegramId
    currentGame.groupName = selectedGroup.title
    delete currentGame.availableGroups
    gameData.set(userId, currentGame)

    userStates.set(userId, ADMIN_STATES.COLLECTING_METADATA)

    await bot.sendMessage(
      chatId,
      `✅ Группа выбрана: <b>${selectedGroup.title}</b>\n\n` +
        '⚙️ Переходим к настройке игры...',
      { parse_mode: 'HTML' }
    )

    await startMetadataCollection(bot, chatId, userId)
  } catch (error) {
    console.error('Error selecting group:', error)
    bot.sendMessage(chatId, '❌ Ошибка при проверке группы. Попробуйте позже.')
  }
}

async function loadAndShowAvailableGroups (bot, chatId, userId) {
  try {
    const dbGroups = await prisma.group.findMany({
      where: { isActive: true },
      orderBy: { title: 'asc' }
    })

    if (dbGroups.length === 0) {
      userStates.set(userId, ADMIN_STATES.IDLE)
      gameData.delete(userId)
      return bot.sendMessage(
        chatId,
        '❌ <b>Нет доступных групп</b>\n\n' +
          '🤖 Добавьте бота в группу как администратора:\n' +
          '1️⃣ Добавьте бота в нужную группу\n' +
          '2️⃣ Сделайте бота администратором\n' +
          '3️⃣ Попробуйте создать игру снова\n\n' +
          '📱 Группа появится в списке автоматически!',
        { parse_mode: 'HTML' }
      )
    }

    // Фильтруем группы где пользователь является участником
    const availableGroups = []
    const processingMessage = await bot.sendMessage(
      chatId,
      '🔄 Проверяем доступные группы...'
    )

    for (const group of dbGroups) {
      try {
        const userMember = await bot.getChatMember(group.telegramId, userId)

        if (!['left', 'kicked'].includes(userMember.status)) {
          const botInfo = await bot.getMe()
          const botMember = await bot.getChatMember(
            group.telegramId,
            botInfo.id
          )

          if (botMember.status === 'administrator') {
            availableGroups.push(group)
          } else {
            await prisma.group.update({
              where: { id: group.id },
              data: { isActive: false }
            })
          }
        }
      } catch (error) {
        console.error(
          `Error checking access to group ${group.telegramId}:`,
          error
        )
        await prisma.group.update({
          where: { id: group.id },
          data: { isActive: false }
        })
      }
    }

    // Удаляем сообщение о проверке
    await bot.deleteMessage(chatId, processingMessage.message_id)

    if (availableGroups.length === 0) {
      userStates.set(userId, ADMIN_STATES.IDLE)
      gameData.delete(userId)
      return bot.sendMessage(
        chatId,
        '❌ <b>Нет подходящих групп</b>\n\n' +
          '📋 Требования:\n' +
          '✅ Вы должны быть участником группы\n' +
          '✅ Бот должен быть администратором группы\n\n' +
          '🔧 Проверьте настройки и попробуйте снова',
        { parse_mode: 'HTML' }
      )
    }

    // Сохраняем список доступных групп
    const currentGame = gameData.get(userId) || {}
    currentGame.availableGroups = availableGroups
    gameData.set(userId, currentGame)

    // Формируем красивое сообщение со списком групп
    let message = '🏟️ <b>Выберите группу для игры:</b>\n\n'

    availableGroups.forEach((group, index) => {
      const number = `${index + 1}️⃣`
      const groupType = group.type === 'supergroup' ? '🏆' : '👥'
      const username = group.username
        ? `@${group.username}`
        : '🆔 ' + group.telegramId

      message += `${number} ${groupType} <b>${group.title}</b>\n`
      message += `   📝 ${username}\n\n`
    })

    message += '💡 <b>Как выбрать:</b>\n'
    message += '🔢 Введите номер группы (например: <code>1</code>)\n\n'
    message += '❌ Для отмены используйте /cancel'

    await bot.sendMessage(chatId, message, { parse_mode: 'HTML' })
  } catch (error) {
    console.error('Error loading available groups:', error)
    userStates.set(userId, ADMIN_STATES.IDLE)
    gameData.delete(userId)
    bot.sendMessage(
      chatId,
      '❌ Ошибка при загрузке списка групп. Попробуйте позже.'
    )
  }
}

async function handleMetadataCollection (bot, chatId, userId, text, username) {
  if (text === '/cancel') {
    userStates.set(userId, ADMIN_STATES.IDLE)
    gameData.delete(userId)
    return bot.sendMessage(chatId, '❌ Создание игры отменено.')
  }

  const currentGame = gameData.get(userId)

  // Сохраняем данные пользователя для последующего добавления в БД
  if (!currentGame.username) {
    currentGame.username = username
    gameData.set(userId, currentGame)
  }

  if (!currentGame.date) {
    // Собираем дату
    if (isValidDate(text)) {
      currentGame.date = text
      gameData.set(userId, currentGame)
      return bot.sendMessage(
        chatId,
        '⏰ Введите время игры (например: 18:00):'
      )
    } else {
      return bot.sendMessage(
        chatId,
        '❌ Неверный формат даты. Используйте формат ДД.ММ.ГГГГ (например: 25.12.2024)'
      )
    }
  }

  if (!currentGame.time) {
    // Собираем время
    if (isValidTime(text)) {
      currentGame.time = text
      gameData.set(userId, currentGame)
      return bot.sendMessage(
        chatId,
        '👥 Введите количество игроков (например: 10):'
      )
    } else {
      return bot.sendMessage(
        chatId,
        '❌ Неверный формат времени. Используйте формат ЧЧ:ММ (например: 18:00)'
      )
    }
  }

  if (!currentGame.playersCount) {
    // Собираем количество игроков
    const count = parseInt(text)
    if (count && count > 0 && count <= 50) {
      currentGame.playersCount = count
      gameData.set(userId, currentGame)
      return bot.sendMessage(chatId, '📍 Введите место проведения игры:')
    } else {
      return bot.sendMessage(
        chatId,
        '❌ Введите корректное количество игроков (от 1 до 50)'
      )
    }
  }

  if (!currentGame.location) {
    // Собираем место
    currentGame.location = text
    gameData.set(userId, currentGame)

    userStates.set(userId, ADMIN_STATES.CONFIRMING_LAUNCH)
    await showGameConfirmation(bot, chatId, userId)
  }
}

async function handleLaunchConfirmation (bot, chatId, userId, text) {
  if (text === '✅ Запустить опрос') {
    await launchGamePoll(bot, chatId, userId)
  } else if (text === '❌ Отменить') {
    userStates.set(userId, ADMIN_STATES.IDLE)
    gameData.delete(userId)
    bot.sendMessage(chatId, '❌ Создание игры отменено.')
  } else if (text === '✏️ Редактировать') {
    userStates.set(userId, ADMIN_STATES.COLLECTING_METADATA)
    const currentGame = gameData.get(userId)
    // Очищаем данные для повторного ввода
    gameData.set(userId, { groupId: currentGame.groupId })
    await startMetadataCollection(bot, chatId, userId)
  } else {
    bot.sendMessage(chatId, '❓ Используйте кнопки для выбора действия.')
  }
}

async function showMainMenu (bot, chatId) {
  const keyboard = {
    keyboard: [['/create_game', '/my_games'], ['/help']],
    resize_keyboard: true,
    one_time_keyboard: false
  }

  await bot.sendMessage(
    chatId,
    '⚽ Добро пожаловать в Oyinshi Bot!\n\n' + 'Выберите действие:',
    { reply_markup: keyboard }
  )
}

async function showGroupSelection (bot, chatId, userId) {
  await bot.sendMessage(
    chatId,
    '1️⃣ Выберите группу для игры\n\n' +
      '💡 Способы добавления группы:\n\n' +
      '🔸 **Перешлите любое сообщение** из нужной группы\n' +
      '🔸 Введите @username группы (если есть)\n' +
      '🔸 Введите ID группы (если знаете)\n\n' +
      '❗ **Важно:** бот должен быть добавлен в группу как администратор\n\n' +
      'Для отмены используйте /cancel',
    { parse_mode: 'Markdown' }
  )
}

async function startMetadataCollection (bot, chatId, userId) {
  await bot.sendMessage(
    chatId,
    '2️⃣ Настройка игры\n\n' +
      '📅 Введите дату игры в формате ДД.ММ.ГГГГ (например: 25.12.2024):'
  )
}

async function showGameConfirmation (bot, chatId, userId) {
  const currentGame = gameData.get(userId)

  const keyboard = {
    keyboard: [['✅ Запустить опрос'], ['✏️ Редактировать', '❌ Отменить']],
    resize_keyboard: true,
    one_time_keyboard: true
  }

  console.log({ currentGame, gameData, userId })

  await bot.sendMessage(
    chatId,
    '3️⃣ Подтверждение игры\n\n' +
      `📅 Дата: ${currentGame.date}\n` +
      `⏰ Время: ${currentGame.time}\n` +
      `👥 Игроков: ${currentGame.playersCount}\n` +
      `📍 Место: ${currentGame.location}\n\n` +
      'Все верно?',
    { reply_markup: keyboard }
  )
}

// Обновленная функция запуска опроса с inline кнопками
async function launchGamePoll (bot, chatId, userId) {
  try {
    const currentGame = gameData.get(userId)
    const gameDate = `${currentGame.date} ${currentGame.time}`
    const [date, time] = gameDate.split(' ')
    const [day, month, year] = date.split('.')

    const isoString = `${year}-${month}-${day}T${time}:00`
    const dateObj = new Date(isoString)

    // Находим админа
    const admin = await prisma.admin.findUnique({
      where: { telegramId: userId.toString() }
    })

    if (!admin) {
      throw new Error('Admin not found')
    }

    // Создаем игру
    const game = await prisma.game.create({
      data: {
        adminId: admin.id,
        groupId: currentGame.groupId.toString(),
        date: dateObj,
        playersCount: currentGame.playersCount,
        location: currentGame.location,
        status: 'ACTIVE'
      }
    })

    // Создаем сообщение с кнопками
    const pollMessage = await createGamePollMessage(game)

    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ Иду', callback_data: `game_${game.id}_going` },
          { text: '❌ Не иду', callback_data: `game_${game.id}_not_going` }
        ],
        [{ text: '🤔 Возможно', callback_data: `game_${game.id}_maybe` }]
      ]
    }

    // Отправляем опрос в группу
    const sentMessage = await bot.sendMessage(
      currentGame.groupId,
      pollMessage,
      {
        reply_markup: keyboard,
        parse_mode: 'HTML'
      }
    )

    // Сохраняем ID сообщения для последующих обновлений
    await prisma.game.update({
      where: { id: game.id },
      data: {
        // Можно добавить поле messageId в схему, пока сохраним в памяти
      }
    })

    // Сохраняем связь gameId -> messageId для обновлений
    gameMessages.set(game.id, {
      chatId: currentGame.groupId,
      messageId: sentMessage.message_id
    })

    // Очищаем состояние
    userStates.set(userId, ADMIN_STATES.IDLE)
    gameData.delete(userId)

    await bot.sendMessage(
      chatId,
      '✅ Опрос успешно запущен в группе!\n\n' +
        'Используйте /my_games для просмотра ваших игр.',
      { reply_markup: { remove_keyboard: true } }
    )
  } catch (error) {
    console.error('Error launching poll:', error)
    bot.sendMessage(chatId, '❌ Ошибка при запуске опроса. Попробуйте позже.')
  }
}

// Хранилище для связи игр с сообщениями (в продакшене использовать Redis)
const gameMessages = new Map()

// Создание текста сообщения игры
async function createGamePollMessage (game) {
  try {
    // Получаем участников
    const participants = await prisma.participant.findMany({
      where: { gameId: game.id },
      orderBy: { createdAt: 'asc' }
    })

    // Группируем по статусу
    const going = participants.filter((p) => p.status === 'GOING')
    const notGoing = participants.filter((p) => p.status === 'NOT_GOING')
    const maybe = participants.filter((p) => p.status === 'MAYBE')

    // Получаем информацию о группе
    const group = await prisma.group.findUnique({
      where: { telegramId: game.groupId }
    })

    let message = '⚽ <b>ФУТБОЛ</b> ⚽\n\n'
    message += `📅 <b>Дата:</b> ${game.date.toLocaleDateString('ru-RU')}\n`
    message += `⏰ <b>Время:</b> ${game.date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}\n`
    message += `📍 <b>Место:</b> ${game.location}\n`
    message += `👥 <b>Нужно игроков:</b> ${game.playersCount}\n\n`

    // Статистика
    message += '📊 <b>Статистика:</b>\n'
    message += `✅ Идут: ${going.length}\n`
    message += `❌ Не идут: ${notGoing.length}\n`
    message += `🤔 Возможно: ${maybe.length}\n\n`

    // Список участников
    if (going.length > 0) {
      message += `✅ <b>Идут (${going.length}):</b>\n`
      going.forEach((participant, index) => {
        const name =
          participant.firstName || participant.username || 'Неизвестный'
        message += `${index + 1}. ${name}\n`
      })
      message += '\n'
    }

    if (maybe.length > 0) {
      message += `🤔 <b>Возможно (${maybe.length}):</b>\n`
      maybe.forEach((participant, index) => {
        const name =
          participant.firstName || participant.username || 'Неизвестный'
        message += `${index + 1}. ${name}\n`
      })
      message += '\n'
    }

    if (notGoing.length > 0) {
      message += `❌ <b>Не идут (${notGoing.length}):</b>\n`
      notGoing.forEach((participant, index) => {
        const name =
          participant.firstName || participant.username || 'Неизвестный'
        message += `${index + 1}. ${name}\n`
      })
      message += '\n'
    }

    // Статус набора
    if (going.length >= game.playersCount) {
      message += '🎉 <b>Набор завершен!</b> Ура!'
    } else {
      const needed = game.playersCount - going.length
      message += `⏳ Еще нужно: <b>${needed}</b> игроков`
    }

    return message
  } catch (error) {
    console.error('Error creating game poll message:', error)
    return 'Ошибка при создании сообщения'
  }
}

async function showUserGames (bot, chatId, userId) {
  try {
    const admin = await prisma.admin.findUnique({
      where: { telegramId: userId.toString() }
    })

    if (!admin) {
      return bot.sendMessage(
        chatId,
        '📝 У вас пока нет игр.\n' +
          '🎯 Создайте первую игру командой /create_game'
      )
    }

    const games = await prisma.game.findMany({
      where: {
        adminId: admin.id,
        status: 'ACTIVE'
      },
      include: {
        group: true,
        participants: true
      },
      orderBy: { date: 'asc' }
    })

    if (games.length === 0) {
      return bot.sendMessage(
        chatId,
        '📋 У вас пока нет активных игр.\n' +
          '⚽ Создайте новую игру командой /create_game'
      )
    }

    let message = '🏆 <b>Ваши активные игры:</b>\n\n'

    games.forEach((game, index) => {
      const goingCount = game.participants.filter(
        (p) => p.status === 'GOING'
      ).length
      const maybeCount = game.participants.filter(
        (p) => p.status === 'MAYBE'
      ).length
      const notGoingCount = game.participants.filter(
        (p) => p.status === 'NOT_GOING'
      ).length

      const gameDate = game.date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
      const gameTime = game.date.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
      })

      // Статус набора
      let statusEmoji = '⏳'
      let statusText = 'Набор открыт'
      if (goingCount >= game.playersCount) {
        statusEmoji = '✅'
        statusText = 'Набор завершен'
      } else if (goingCount === 0) {
        statusEmoji = '🔴'
        statusText = 'Пока никого нет'
      }

      message += `${statusEmoji} <b>Игра #${index + 1}</b>\n`
      message += `📅 ${gameDate} в ${gameTime}\n`
      message += `📍 ${game.location}\n`
      message += `🏟️ ${game.group.title}\n`
      message += `👥 ${goingCount}/${game.playersCount} игроков\n`

      if (maybeCount > 0 || notGoingCount > 0) {
        message += `📊 ✅${goingCount} 🤔${maybeCount} ❌${notGoingCount}\n`
      }

      message += `🔰 ${statusText}\n`

      // Список участников
      if (goingCount > 0) {
        const goingPlayers = game.participants
          .filter((p) => p.status === 'GOING')
          .slice(0, 5) // Показываем максимум 5
          .map((p) => p.firstName || p.username || 'Аноним')
          .join(', ')

        message += `✅ Идут: ${goingPlayers}`
        if (goingCount > 5) {
          message += ` и еще ${goingCount - 5}`
        }
        message += '\n'
      }

      message += '\n'
    })

    message += '📱 Используйте /create_game для создания новой игры'

    bot.sendMessage(chatId, message, { parse_mode: 'HTML' })
  } catch (error) {
    console.error('Error fetching user games:', error)
    bot.sendMessage(chatId, '❌ Ошибка при получении списка игр.')
  }
}

async function showHelp (bot, chatId) {
  const helpText =
    '🤖 Помощь по Oyinshi Bot\n\n' +
    '📋 Доступные команды:\n' +
    '/start - Главное меню\n' +
    '/create_game - Создать новую игру\n' +
    '/my_games - Мои игры\n' +
    '/help - Эта справка\n\n' +
    '❓ Как использовать:\n' +
    '1. Добавьте бота в вашу группу как администратора\n' +
    '2. Создайте игру через /create_game\n' +
    '3. Участники смогут записаться в группе'

  bot.sendMessage(chatId, helpText)
}

async function getAdminGamesCount (adminId) {
  try {
    const admin = await prisma.admin.findUnique({
      where: { telegramId: adminId.toString() },
      include: {
        _count: {
          select: { games: true }
        }
      }
    })

    return admin?._count?.games || 0
  } catch (error) {
    console.error('Error getting admin games count:', error)
    return 0
  }
}

// 5) Функция для получения статистики участника
async function getParticipantStats (telegramId) {
  try {
    const participantStats = await prisma.participant.groupBy({
      by: ['status'],
      where: { telegramId: telegramId.toString() },
      _count: {
        id: true
      }
    })

    return participantStats.reduce(
      (acc, stat) => {
        acc[stat.status] = stat._count.id
        return acc
      },
      { GOING: 0, NOT_GOING: 0, MAYBE: 0 }
    )
  } catch (error) {
    console.error('Error getting participant stats:', error)
    return { GOING: 0, NOT_GOING: 0, MAYBE: 0 }
  }
}

module.exports = {
  handleAdminScenario,
  ADMIN_STATES,
  userStates,
  gameData,
  createGamePollMessage,
  getAdminGamesCount,
  getParticipantStats
}
