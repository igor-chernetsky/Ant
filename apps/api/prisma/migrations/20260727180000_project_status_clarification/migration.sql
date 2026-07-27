-- AlterEnum (must be committed before the new value can be used in UPDATE on PG < 15)
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'clarification';
