const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const handleGroupScenario = async (bot, msg) => {
  // Здесь обрабатываем реакции на игры, но НЕ создаем админов

  // Например, обработка реакций на опросы игр
  if (msg.reply_to_message) {
    // Проверяем, является ли это реакцией на игровой опрос
    await handleGamePollReaction(bot, msg)
  }

  // Другая групповая логика...
  console.log('group')
  console.log({ msg })
  return 'group'
}

// Пример обработки реакций на игровые опросы в группах
const handleGamePollReaction = async (bot, msg) => {
  try {
    const text = msg.text?.toLowerCase()
    const userId = msg.from.id
    const username = msg.from.username
    const firstName = msg.from.first_name
    const lastName = msg.from.last_name

    // Проверяем, содержит ли исходное сообщение ID игры
    const originalMessage = msg.reply_to_message.text
    const gameIdMatch = originalMessage.match(/ID игры: (\d+)/)

    if (!gameIdMatch) return // Не игровое сообщение

    const gameId = parseInt(gameIdMatch[1])

    // Определяем статус участника
    let status = null
    if (text?.includes('✅') || text?.includes('иду') || text?.includes('+')) {
      status = 'GOING'
    } else if (
      text?.includes('❌') ||
      text?.includes('не иду') ||
      text?.includes('-')
    ) {
      status = 'NOT_GOING'
    } else if (
      text?.includes('🤔') ||
      text?.includes('может') ||
      text?.includes('?')
    ) {
      status = 'MAYBE'
    }

    if (!status) return // Не распознанная реакция

    // Сохраняем участника (НЕ как админа!)
    await prisma.participant.upsert({
      where: {
        gameId_telegramId: {
          gameId,
          telegramId: userId.toString()
        }
      },
      update: {
        status,
        username,
        firstName,
        lastName,
        updatedAt: new Date()
      },
      create: {
        gameId,
        telegramId: userId.toString(),
        username,
        firstName,
        lastName,
        status
      }
    })

    console.log(
      `Participant ${username} (${userId}) ${status} for game ${gameId}`
    )
  } catch (error) {
    console.error('Error handling game poll reaction:', error)
  }
}

module.exports = {
  handleGroupScenario
}
