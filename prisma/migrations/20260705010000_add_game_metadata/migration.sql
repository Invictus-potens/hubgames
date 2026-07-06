-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "genre" TEXT,
ADD COLUMN     "synopsis" TEXT,
ADD COLUMN     "metacritic" INTEGER,
ADD COLUMN     "screenshots" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
