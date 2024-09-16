-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "chatIds" BIGINT[];
