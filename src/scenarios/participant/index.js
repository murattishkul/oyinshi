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
		const messageId = callbackQuery.message.message_id;
		const chatId = callbackQuery.message.chat.id;
		
		// Парсим callback data: game_123_going
		const match = data.match(/^game_(\d+)_(.+)$/);
		if (!match) {
			return bot.answerCallbackQuery(callbackQuery.id, { text: "Неверная команда" });
		}
		
		const gameId = parseInt(match[1]);
		const action = match[2];
		
		// Проверяем, существует ли игра
		const game = await prisma.game.findUnique({
			where: { id: gameId }
		});
		
		if (!game || game.status !== 'ACTIVE') {
			return bot.answerCallbackQuery(callbackQuery.id, {
				text: "Игра не найдена или завершена"
			});
		}
		
		// Определяем статус
		let status;
		let statusText;
		switch (action) {
			case 'going':
				status = 'GOING';
				statusText = 'записались на игру';
				break;
			case 'not_going':
				status = 'NOT_GOING';
				statusText = 'отказались от игры';
				break;
			case 'maybe':
				status = 'MAYBE';
				statusText = 'возможно придете';
				break;
			default:
				return bot.answerCallbackQuery(callbackQuery.id, { text: "Неверное действие" });
		}
		
		// Создаем или обновляем участника
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
		
		// Обновляем сообщение с новым списком участников
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
		
		await bot.editMessageText(updatedMessage, {
			chat_id: chatId,
			message_id: messageId,
			reply_markup: keyboard,
			parse_mode: 'HTML'
		});
		
		// Отвечаем пользователю
		await bot.answerCallbackQuery(callbackQuery.id, {
			text: `✅ Вы ${statusText}!`,
			show_alert: false
		});
		
		console.log(`Participant ${username} (${userId}) ${status} for game ${gameId}`);
		
	} catch (error) {
		console.error('Error handling callback query:', error);
		bot.answerCallbackQuery(callbackQuery.id, {
			text: "Произошла ошибка. Попробуйте позже."
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
