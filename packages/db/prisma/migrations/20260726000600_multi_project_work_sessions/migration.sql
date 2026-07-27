-- Sessions now carry a display name (see sessionName.ts's generator), shown
-- wherever a session needs to be told apart from others in the same room.
ALTER TABLE `WorkSession` ADD COLUMN `name` VARCHAR(191) NOT NULL;

-- UserActiveSession is ephemeral, coordination-only state (no historical
-- value -- see its schema comment) restructured from "one global session per
-- user" to "one session per (user, project)", so a user can run several
-- concurrent sessions across different projects but never two on the same
-- project. Existing guard rows are dropped, not backfilled; they are
-- recreated from real WorkSession rows the next time a session starts.
ALTER TABLE `UserActiveSession` DROP FOREIGN KEY `UserActiveSession_userId_fkey`;
ALTER TABLE `UserActiveSession` DROP FOREIGN KEY `UserActiveSession_workSessionId_fkey`;
DROP TABLE `UserActiveSession`;

CREATE TABLE `UserActiveSession` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `workSessionId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `UserActiveSession_workSessionId_key`(`workSessionId`),
    UNIQUE INDEX `UserActiveSession_userId_projectId_key`(`userId`, `projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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
