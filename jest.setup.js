// jest.setup.js
const { PrismaClient } = require('@prisma/client')

// Мок для Prisma в тестах
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    admin: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    game: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    participant: {
      upsert: jest.fn(),
      findMany: jest.fn()
    }
  }))
}))

// Настройка таймаутов для тестов
jest.setTimeout(30000)
