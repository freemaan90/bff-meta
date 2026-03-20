/*
  Warnings:

  - You are about to drop the column `wabaId` on the `Tenant` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Tenant" DROP COLUMN "wabaId",
ADD COLUMN     "chatbotEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "chatbotMode" TEXT NOT NULL DEFAULT 'rules',
ADD COLUMN     "chatbotPrompt" TEXT,
ADD COLUMN     "chatbotRules" JSONB;
