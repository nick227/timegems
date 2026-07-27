-- CreateTable
CREATE TABLE `UserActiveSession` (
    `userId` VARCHAR(191) NOT NULL,
    `workSessionId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `UserActiveSession_workSessionId_key`(`workSessionId`),
    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Backfill the coordination row for sessions that were active before this
-- migration. If legacy data contains multiple active sessions for one user,
-- the primary-key violation intentionally aborts migration rather than
-- silently choosing a session and preserving corrupt state.
INSERT INTO `UserActiveSession` (`userId`, `workSessionId`, `createdAt`)
SELECT `userId`, `id`, `createdAt`
FROM `WorkSession`
WHERE `status` IN ('RUNNING', 'PAUSED');

-- AddForeignKey
ALTER TABLE `UserActiveSession`
ADD CONSTRAINT `UserActiveSession_userId_fkey`
FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserActiveSession`
ADD CONSTRAINT `UserActiveSession_workSessionId_fkey`
FOREIGN KEY (`workSessionId`) REFERENCES `WorkSession`(`id`)
ON DELETE RESTRICT ON UPDATE CASCADE;
