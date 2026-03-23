-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'text';

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "wabaId" TEXT;
