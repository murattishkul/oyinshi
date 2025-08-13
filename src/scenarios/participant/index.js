const prisma = require('../../../db/prisma')
const { createGamePollMessage, gameMessages } = require('../admin/index')

// Обработка callback-запросов (нажатий на inline кнопки)
const handleCallbackQuery = async (bot, callbackQuery) => {
	try {
		const data = callbackQuery.data
		const userId = callbackQuery.from.id
		const username = callbackQuery.from.username
		const firstName = callbackQuery.from.first_name
		const lastName = callbackQuery.from.last_name
		const chatId = callbackQuery.message.chat.id
		const messageId = callbackQuery.message.message_id
		
		// Парсим данные callback
		const [action, gameId, status] = data.split('_')
		
		if (action === 'game') {
			await handleGameAction(
				bot,
				callbackQuery,
				parseInt(gameId),
				status,
				userId,
				username,
				firstName,
				lastName,
				chatId,
				messageId
			)
		}
	} catch (error) {
		console.error('Error handling callback query:', error)
		bot.answerCallbackQuery(callbackQuery.id, {
			text: '❌ Произошла ошибка',
			show_alert: true
		})
	}
}

// Обработка действий с игрой
const handleGameAction = async (
	bot,
	callbackQuery,
	gameId,
	status,
	userId,
	username,
	firstName,
	lastName,
	chatId,
	messageId
) => {
	try {
		// Проверяем существование игры
		const game = await prisma.game.findUnique({
			where: { id: gameId }
		})
		
		if (!game || game.status !== 'ACTIVE') {
			return bot.answerCallbackQuery(callbackQuery.id, {
				text: '❌ Игра не найдена или неактивна',
				show_alert: true
			})
		}
		
		if (status === 'add' && callbackQuery.data.includes('friend')) {
			// Обработка добавления друга
			await handleAddFriend(bot, callbackQuery, gameId, userId, firstName, username)
		} else if (status === 'remove' && callbackQuery.data.includes('friend')) {
			// Обработка удаления друга
			await handleRemoveFriend(bot, callbackQuery, gameId, userId)
		} else {
			// Обработка обычных статусов (going, maybe)
			await handleParticipantStatus(
				bot,
				callbackQuery,
				gameId,
				status,
				userId,
				username,
				firstName,
				lastName,
				chatId,
				messageId
			)
		}
	} catch (error) {
		console.error('Error in handleGameAction:', error)
		bot.answerCallbackQuery(callbackQuery.id, {
			text: '❌ Произошла ошибка',
			show_alert: true
		})
	}
}

// Обработка изменения статуса участника
const handleParticipantStatus = async (
	bot,
	callbackQuery,
	gameId,
	status,
	userId,
	username,
	firstName,
	lastName,
	chatId,
	messageId
) => {
	try {
		let statusText = ''
		let statusEmoji = ''
		
		switch (status) {
			case 'going':
				statusText = 'Иду'
				statusEmoji = '✅'
				break
			case 'maybe':
				statusText = 'Возможно'
				statusEmoji = '🤔'
				break
			default:
				return bot.answerCallbackQuery(callbackQuery.id, {
					text: '❌ Неизвестное действие'
				})
		}
		
		// Проверяем, не пытается ли пользователь установить тот же статус
		const existingParticipant = await prisma.participant.findUnique({
			where: {
				gameId_telegramId: {
					gameId: gameId,
					telegramId: userId.toString()
				}
			}
		})
		
		if (existingParticipant && existingParticipant.status === status.toUpperCase()) {
			return bot.answerCallbackQuery(callbackQuery.id, {
				text: `${statusEmoji} Вы уже выбрали "${statusText}"`
			})
		}
		
		// Обновляем или создаем участника
		await prisma.participant.upsert({
			where: {
				gameId_telegramId: {
					gameId: gameId,
					telegramId: userId.toString()
				}
			},
			update: {
				status: status.toUpperCase(),
				username: username || null,
				firstName: firstName || null,
				lastName: lastName || null,
				updatedAt: new Date()
			},
			create: {
				gameId: gameId,
				telegramId: userId.toString(),
				username: username || null,
				firstName: firstName || null,
				lastName: lastName || null,
				status: status.toUpperCase(),
				isAddedByUser: false
			}
		})
		
		// Получаем обновленную игру для пересоздания сообщения
		const updatedGame = await prisma.game.findUnique({
			where: { id: gameId }
		})
		
		// Обновляем сообщение в группе
		const updatedMessage = await createGamePollMessage(updatedGame)
		
		// Создаем обновленную клавиатуру с кнопкой удаления друга (если есть добавленные друзья)
		const keyboard = await createGameKeyboard(gameId, userId)
		
		await bot.editMessageText(updatedMessage, {
			chat_id: chatId,
			message_id: messageId,
			parse_mode: 'HTML',
			reply_markup: keyboard
		})
		
		// Отправляем подтверждение пользователю (БЕЗ отправки сообщения в чат)
		bot.answerCallbackQuery(callbackQuery.id, {
			text: `${statusEmoji} ${statusText}!`
		})
		
	} catch (error) {
		console.error('Error updating participant status:', error)
		bot.answerCallbackQuery(callbackQuery.id, {
			text: '❌ Ошибка при обновлении статуса'
		})
	}
}

// Обработка добавления друга
const handleAddFriend = async (bot, callbackQuery, gameId, userId, firstName, username) => {
	try {
		const userDisplayName = firstName || username || 'Пользователь'
		const friendName = `Плюс (${userDisplayName})`
		
		// Проверяем, сколько друзей уже добавил этот пользователь
		const existingFriends = await prisma.participant.findMany({
			where: {
				gameId: gameId,
				addedByUserId: userId.toString(),
				isAddedByUser: true
			}
		})
		
		if (existingFriends.length >= 3) {
			return bot.answerCallbackQuery(callbackQuery.id, {
				text: '❌ Максимум 3 друга на игру',
				show_alert: true
			})
		}
		
		// Создаем уникальный telegramId для друга
		const friendTelegramId = `friend_${userId}_${Date.now()}`
		
		// Добавляем друга
		await prisma.participant.create({
			data: {
				gameId: gameId,
				telegramId: friendTelegramId,
				firstName: friendName,
				status: 'GOING',
				isAddedByUser: true,
				addedByUserId: userId.toString()
			}
		})
		
		// Обновляем сообщение
		const game = await prisma.game.findUnique({
			where: { id: gameId }
		})
		
		const updatedMessage = await createGamePollMessage(game)
		const keyboard = await createGameKeyboard(gameId, userId)
		
		await bot.editMessageText(updatedMessage, {
			chat_id: callbackQuery.message.chat.id,
			message_id: callbackQuery.message.message_id,
			parse_mode: 'HTML',
			reply_markup: keyboard
		})
		
		bot.answerCallbackQuery(callbackQuery.id, {
			text: `👥 Друг добавлен: ${friendName}`
		})
		
	} catch (error) {
		console.error('Error adding friend:', error)
		bot.answerCallbackQuery(callbackQuery.id, {
			text: '❌ Ошибка при добавлении друга'
		})
	}
}

// Обработка удаления друга
const handleRemoveFriend = async (bot, callbackQuery, gameId, userId) => {
	try {
		// Удаляем последнего добавленного друга этим пользователем
		const lastFriend = await prisma.participant.findFirst({
			where: {
				gameId: gameId,
				addedByUserId: userId.toString(),
				isAddedByUser: true
			},
			orderBy: {
				createdAt: 'desc'
			}
		})
		
		if (!lastFriend) {
			return bot.answerCallbackQuery(callbackQuery.id, {
				text: '❌ Нет друзей для удаления'
			})
		}
		
		await prisma.participant.delete({
			where: { id: lastFriend.id }
		})
		
		// Обновляем сообщение
		const game = await prisma.game.findUnique({
			where: { id: gameId }
		})
		
		const updatedMessage = await createGamePollMessage(game)
		const keyboard = await createGameKeyboard(gameId, userId)
		
		await bot.editMessageText(updatedMessage, {
			chat_id: callbackQuery.message.chat.id,
			message_id: callbackQuery.message.message_id,
			parse_mode: 'HTML',
			reply_markup: keyboard
		})
		
		bot.answerCallbackQuery(callbackQuery.id, {
			text: '👥 Друг удален'
		})
		
	} catch (error) {
		console.error('Error removing friend:', error)
		bot.answerCallbackQuery(callbackQuery.id, {
			text: '❌ Ошибка при удалении друга'
		})
	}
}

// Создание клавиатуры для игры
const createGameKeyboard = async (gameId, userId) => {
	try {
		// Проверяем, есть ли добавленные друзья у пользователя
		const userFriends = await prisma.participant.findMany({
			where: {
				gameId: gameId,
				addedByUserId: userId.toString(),
				isAddedByUser: true
			}
		})
		
		const keyboard = {
			inline_keyboard: [
				[
					{ text: '✅ Иду', callback_data: `game_${gameId}_going` },
					{ text: '🤔 Возможно', callback_data: `game_${gameId}_maybe` }
				]
			]
		}
		
		// Добавляем кнопку для друзей
		const friendButtons = []
		
		// Кнопка добавления друга (если меньше 3)
		if (userFriends.length < 3) {
			friendButtons.push({
				text: '👥 +Друг',
				callback_data: `game_${gameId}_add_friend`
			})
		}
		
		// Кнопка удаления друга (если есть друзья)
		if (userFriends.length > 0) {
			friendButtons.push({
				text: '➖ Убрать друга',
				callback_data: `game_${gameId}_remove_friend`
			})
		}
		
		if (friendButtons.length > 0) {
			keyboard.inline_keyboard.push(friendButtons)
		}
		
		return keyboard
		
	} catch (error) {
		console.error('Error creating game keyboard:', error)
		// Возвращаем базовую клавиатуру в случае ошибки
		return {
			inline_keyboard: [
				[
					{ text: '✅ Иду', callback_data: `game_${gameId}_going` },
					{ text: '🤔 Возможно', callback_data: `game_${gameId}_maybe` }
				],
				[
					{ text: '👥 +Друг', callback_data: `game_${gameId}_add_friend` }
				]
			]
		}
	}
}

module.exports = {
	handleCallbackQuery,
	handleGameAction,
	handleParticipantStatus,
	handleAddFriend,
	handleRemoveFriend,
	createGameKeyboard
}
