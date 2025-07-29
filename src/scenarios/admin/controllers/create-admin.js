const prisma = require('../../../../db/prisma')

// Функция для создания админа только при личном общении
async function createAdminOnPrivateChat (userId, username, firstName, lastName) {
  try {
    const admin = await prisma.admin.upsert({
      where: { telegramId: userId.toString() },
      update: {
        username,
        firstName,
        lastName,
        updatedAt: new Date()
      },
      create: {
        telegramId: userId.toString(),
        username,
        firstName,
        lastName
      }
    })

    console.log(`Admin created/updated: ${username} (${userId})`)
    return admin
  } catch (error) {
    console.error('Error creating admin:', error)
    throw error
  }
}

module.exports = {
  createAdminOnPrivateChat
}
