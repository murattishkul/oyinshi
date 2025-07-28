// Fix the import path - adjust this to match your actual prisma client location
const { PrismaClient } = require('@prisma/client');
const {handleCallbackQuery} = require("../participant");
const prisma = new PrismaClient();

const handleBotStatusChange = async (bot, update) => {
	try {
		// Check if this update is about the bot itself
		const botInfo = await bot.getMe();
		const botId = botInfo.id;
		
		// Make sure we're handling bot status changes, not regular user changes
		if (update.new_chat_member.user.id !== botId) {
			return; // This update is not about our bot
		}
		
		const chat = update.chat;
		const newStatus = update.new_chat_member.status;
		const oldStatus = update.old_chat_member.status;
		
		console.log(`Bot status change in ${chat.title} (${chat.id}): ${oldStatus} -> ${newStatus}`);
		
		// Если бота сделали администратором
		if (newStatus === 'administrator' && oldStatus !== 'administrator') {
			await saveGroupToDatabase(chat);
			console.log(`Bot became admin in group: ${chat.title} (${chat.id})`);
		}
		
		// Если бота исключили или лишили прав админа
		if (oldStatus === 'administrator' && (newStatus !== 'administrator' || newStatus === 'left' || newStatus === 'kicked')) {
			await removeGroupFromDatabase(chat.id);
			console.log(`Bot removed/demoted in group: ${chat.title} (${chat.id})`);
		}
		
	} catch (error) {
		console.error('Error handling bot status change:', error);
	}
};

const saveGroupToDatabase = async (chat) => {
	try {
		// Add validation to ensure we have required data
		if (!chat || !chat.id || !chat.title) {
			throw new Error('Invalid chat data provided');
		}
		
		const result = await prisma.group.upsert({
			where: { telegramId: String(chat.id) },
			update: {
				title: chat.title,
				type: chat.type || 'group',
				username: chat.username || null,
				isActive: true,
				updatedAt: new Date(),
			},
			create: {
				telegramId: String(chat.id),
				title: chat.title,
				type: chat.type || 'group',
				username: chat.username || null,
				isActive: true,
			},
		});
		
		console.log(`Group saved to database: ${result.title} (ID: ${result.id})`);
		return result;
		
	} catch (error) {
		console.error('Error saving group to database:', error);
		throw error; // Re-throw to handle upstream if needed
	}
};

const removeGroupFromDatabase = async (chatId) => {
	try {
		if (!chatId) {
			throw new Error('Chat ID is required');
		}
		
		const result = await prisma.group.updateMany({
			where: { telegramId: String(chatId) },
			data: {
				isActive: false,
				updatedAt: new Date(),
			},
		});
		
		console.log(`Groups updated (deactivated): ${result.count}`);
		return result;
		
	} catch (error) {
		console.error('Error removing group from database:', error);
		throw error;
	}
};

// Function to handle when bot is added to a group (not necessarily as admin)
const handleBotAddedToGroup = async (chat) => {
	try {
		// Check if bot has admin rights
		const botInfo = await bot.getMe();
		const botMember = await bot.getChatMember(chat.id, botInfo.id);
		
		if (botMember.status === 'administrator') {
			await saveGroupToDatabase(chat);
		} else {
			console.log(`Bot added to ${chat.title} but not as admin. Waiting for admin rights.`);
		}
	} catch (error) {
		console.error('Error handling bot added to group:', error);
	}
};

// Cleanup function to close Prisma connection (call this when your app shuts down)
const cleanup = async () => {
	await prisma.$disconnect();
};

// Настройка обработчиков в основном файле
const setupBotHandlers = (bot) => {
	// Обработчик inline кнопок
	bot.on('callback_query', async (callbackQuery) => {
		await handleCallbackQuery(bot, callbackQuery);
	});
	
	// Другие обработчики...
};

module.exports = {
	handleBotStatusChange,
	handleBotAddedToGroup,
	saveGroupToDatabase,
	removeGroupFromDatabase,
	cleanup,
	setupBotHandlers
};
