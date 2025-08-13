-- AlterTable
ALTER TABLE "participants" ADD COLUMN     "addedByUserId" TEXT,
ADD COLUMN     "isAddedByUser" BOOLEAN NOT NULL DEFAULT false;
