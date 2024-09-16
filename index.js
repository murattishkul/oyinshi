const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const dotenv = require("dotenv");
const prisma = require("./db/prisma");

dotenv.config({ path: path.resolve(__dirname, ".", ".env") });

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Создайте экземпляр Express
const app = express();
const port = process.env.PORT || 3000;

// Установите вебхук
const url = "https://3f37-178-90-75-249.ngrok-free.app"; // Убедитесь, что это ваш действующий URL

// Настройка тела запроса в формате JSON
app.use(bodyParser.json());

// Обработчик вебхуков
app.post("/webhook", (req, res) => {
  const update = req.body;

  // Передайте обновление в Telegram Bot API
  bot.processUpdate(update);

  res.sendStatus(200);
});

// Установите вебхук
bot.setWebHook(`${url}/webhook`);

// Запустите сервер
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

const inlineKeyboard = [
  [{ text: "Введите название арены", callback_data: "arena" }],
  [{ text: "Введите дату", callback_data: "date" }],
  [{ text: "Введите время", callback_data: "time" }],
  [{ text: "Введите кол-во игроков", callback_data: "playersNumber" }],
  [{ text: "Цена аренды поля?", callback_data: "price" }]
];

const options = {
  reply_markup: {
    inline_keyboard: inlineKeyboard,
  },
};

// Слушаем сообщения
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const messageText = msg.text;

  if (msg.chat.type !== "group" && msg.chat.type !== "supergroup") {
    bot.sendMessage(chatId, "Используйте меня в группе");
    return;
  }
  try {
    const botInfo = await bot.getMe();
    const chatMember = await bot.getChatMember(chatId, botInfo.id)

    if (chatMember.status !== "administrator" && chatMember.status !== "creator") {
      bot.sendMessage(chatId, "Сделайте меня администратором группы");
      return;
    } 
    if (messageText == "/football") {
      bot.sendMessage(chatId, "Выберите опцию:", options);
    }
  } catch (error) {
    console.error("Ошибка при получении информации о члене группы:", error);
    bot.sendMessage(chatId, "Используйте меня в группе");
  }
});

// Обработка команды /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "Привет! Я ваш новый Telegram-бот.");
});

const getUserAvatar = (userId, chatId) => {
  bot.getUserProfilePhotos(userId).then((photos) => {
    if (photos.total_count > 0) {
      const photoFileId = photos.photos[0][0].file_id;

      return bot.getFileLink(photoFileId).then((fileLink) => {
        // Send the profile photo link or use it as needed
        bot.sendMessage(chatId, `Profile Photo Link: ${fileLink}`);
        return fileLink;
      });
    } else {
      bot.sendMessage(chatId, "No profile photo found.");
      return "";
    }
  });
};

const choiceOptions = {
  reply_markup: {
    inline_keyboard: [
      [{ text: "+", callback_data: "in" }],
      [{ text: "-", callback_data: "pass" }],
      [{ text: "+1", callback_data: "plusOne" }],
    ],
  },
};

let gameData = {
  arena: "",
  date: "",
  time: "",
  playersNumber: 0,
};

/*
 * {firstName,}
 */
const playerList = [];

const displayPlayerList = () => {
  let list = "";
  let count = 1;
  playerList.forEach((player) => {
    const displayName = player.firstName;
    list = `${list}\n${count}. ${displayName}`;
    count++;
  });
  return list;
};

const getListOfPlayers = () => {
  const { arena, date, time } = gameData;
  return `
    ${arena} ${date} ${time}
    \n
    ${displayPlayerList()}
  `;
};

const getUserData = (query, chatId) => {
  return {
    userId: query.from.id,
    userName: query.from.username || "Unknown",
    firstName: query.from.first_name || "Unknown",
    lastName: query.from.last_name || "",
    photoLink: getUserAvatar(query.from.id, chatId),
  };
};

const addPlayer = (userData) => {
  playerList.push(userData);
};

bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  // console.log(query);

  if (data === "arena") {
    bot.sendMessage(chatId, "Где катаем?:");
    bot.once("message", (msg) => {
      const arenaName = msg.text;
      bot.sendMessage(chatId, "В какой день катаем?:");
      bot.once("message", (msg) => {
        const date = msg.text;
        bot.sendMessage(chatId, "Во сколько?:");
        bot.once("message", (msg) => {
          const time = msg.text;
          bot.sendMessage(chatId, "Сколько человек набрать?");
          bot.once("message", async (msg) => {
            const playersNumber = msg.text;
            // create game
            bot.sendMessage(chatId, "Цена аренды поля?");
            bot.once("message", async (msg) => {
              const price = msg.text;
              gameData = {
                date,
                time,
                playersNumber,
                arena: arenaName,
              };
              const newArena = await prisma.arena.create({
                data: {
                  name: arenaName
                }
              });
              const newGame = await prisma.game.create({
                data: {
                  chatId,
                  date,
                  time,
                  arena: { connect: { id: newArena.id } },
                  price: +price,
                  maxAllowedPlayers: +playersNumber
                }
              })
              console.log('=========================',newArena, newGame);
              bot.sendMessage(
                chatId,
                `${arenaName} ${date} ${time} ${playersNumber}`,
                choiceOptions
              );
            })
          });
        });
      });
    });
  }

  if (data === "in") {
    const userData = getUserData(query, chatId);
    // create player and add it to a game
    addPlayer(userData);
    bot.sendMessage(chatId, getListOfPlayers());
  }
});
