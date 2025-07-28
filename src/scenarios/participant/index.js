const prisma = require("../../../db/prisma");
const {createGamePollMessage} = require("../admin");

// Обработчик нажатий на inline кнопки
const handleCallbackQuery = async (bot, callbackQuery) => {
	try {
		const data = callbackQuery.data;
		const userId = callbackQuery.from.id;
		const username = callbackQuery.from.username;
		const firstName = callbackQuery.from.first_name;
		const lastName = callbackQuery.from.last_name;
		const chatId = callbackQuery.message.chat.id;
		
		const match = data.match(/^game_(\d+)_(.+)$/);
		if (!match) {
			return bot.answerCallbackQuery(callbackQuery.id, { text: "❌ Неверная команда" });
		}
		
		const gameId = parseInt(match[1]);
		const action = match[2];
		
		// 5) Проверяем существование игры с детальной проверкой
		const game = await prisma.game.findUnique({
			where: { id: gameId },
			include: {
				admin: true,
				group: true,
				participants: true
			}
		});
		
		if (!game) {
			return bot.answerCallbackQuery(callbackQuery.id, {
				text: "❌ Игра не найдена"
			});
		}
		
		if (game.status !== 'ACTIVE') {
			return bot.answerCallbackQuery(callbackQuery.id, {
				text: "🔒 Эта игра уже завершена"
			});
		}
		
		// Определяем статус
		let status, statusText, statusEmoji;
		switch (action) {
			case 'going':
				status = 'GOING';
				statusText = 'записались на игру';
				statusEmoji = '✅';
				break;
			case 'not_going':
				status = 'NOT_GOING';
				statusText = 'отказались от игры';
				statusEmoji = '❌';
				break;
			case 'maybe':
				status = 'MAYBE';
				statusText = 'возможно придете';
				statusEmoji = '🤔';
				break;
			default:
				return bot.answerCallbackQuery(callbackQuery.id, { text: "❌ Неверное действие" });
		}
		
		// 5) Улучшенная логика создания/обновления участника
		const existingParticipant = await prisma.participant.findUnique({
			where: {
				gameId_telegramId: {
					gameId: gameId,
					telegramId: userId.toString()
				}
			}
		});
		
		let isNewParticipant = !existingParticipant;
		let oldStatus = existingParticipant?.status;
		
		// Если статус не изменился, не делаем ничего
		if (existingParticipant && existingParticipant.status === status) {
			return bot.answerCallbackQuery(callbackQuery.id, {
				text: `${statusEmoji} Вы уже ${statusText}!`
			});
		}
		
		const participant = await prisma.participant.upsert({
			where: {
				gameId_telegramId: {
					gameId: gameId,
					telegramId: userId.toString()
				}
			},
			update: {
				status: status,
				username: username,
				firstName: firstName,
				lastName: lastName,
				updatedAt: new Date(),
			},
			create: {
				gameId: gameId,
				telegramId: userId.toString(),
				username: username,
				firstName: firstName,
				lastName: lastName,
				status: status,
			}
		});
		
		// 2) Отправляем НОВОЕ сообщение вместо редактирования старого
		const updatedMessage = await createGamePollMessage(game);
		
		const keyboard = {
			inline_keyboard: [
				[
					{ text: '✅ Иду', callback_data: `game_${game.id}_going` },
					{ text: '❌ Не иду', callback_data: `game_${game.id}_not_going` }
				],
				[
					{ text: '🤔 Возможно', callback_data: `game_${game.id}_maybe` }
				]
			]
		};
		
		// Отправляем новое сообщение
		await bot.sendMessage(chatId, updatedMessage, {
			reply_markup: keyboard,
			parse_mode: 'HTML'
		});
		
		// Формируем текст уведомления
		let notificationText = `${statusEmoji} Вы ${statusText}!`;
		if (!isNewParticipant && oldStatus) {
			const oldEmoji = oldStatus === 'GOING' ? '✅' : oldStatus === 'NOT_GOING' ? '❌' : '🤔';
			notificationText = `🔄 Изменили статус с ${oldEmoji} на ${statusEmoji}`;
		}
		
		await bot.answerCallbackQuery(callbackQuery.id, {
			text: notificationText,
			show_alert: false
		});
		
		// Логирование
		const actionLog = isNewParticipant ? 'registered' : `changed from ${oldStatus} to ${status}`;
		console.log(`Participant ${username} (${userId}) ${actionLog} for game ${gameId}`);
		
	} catch (error) {
		console.error('Error handling callback query:', error);
		bot.answerCallbackQuery(callbackQuery.id, {
			text: "💥 Произошла ошибка. Попробуйте позже."
		});
	}
};

// Дополнительная функция для админа - закрыть набор
const closeGameRegistration = async (bot, gameId, adminId) => {
	try {
		const game = await prisma.game.findUnique({
			where: { id: gameId },
			include: { admin: true }
		});
		
		if (!game || game.admin.telegramId !== adminId.toString()) {
			return false; // Не найдена или не принадлежит админу
		}
		
		await prisma.game.update({
			where: { id: gameId },
			data: { status: 'COMPLETED' }
		});
		
		// Обновляем сообщение
		const messageInfo = gameMessages.get(gameId);
		if (messageInfo) {
			const finalMessage = await createGamePollMessage(game);
			const closedMessage = finalMessage + `\n\n🔒 <b>Набор закрыт администратором</b>`;
			
			await bot.editMessageText(closedMessage, {
				chat_id: messageInfo.chatId,
				message_id: messageInfo.messageId,
				parse_mode: 'HTML'
				// Убираем кнопки
			});
		}
		
		return true;
	} catch (error) {
		console.error('Error closing game registration:', error);
		return false;
	}
};

module.exports = {
	handleCallbackQuery,
	closeGameRegistration
};
