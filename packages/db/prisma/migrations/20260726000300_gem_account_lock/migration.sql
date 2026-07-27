-- CreateTable
CREATE TABLE `GemAccount` (
    `userId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `GemAccount_projectId_idx`(`projectId`),
    PRIMARY KEY (`userId`, `projectId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `GemAccount`
ADD CONSTRAINT `GemAccount_userId_fkey`
FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GemAccount`
ADD CONSTRAINT `GemAccount_projectId_fkey`
FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`)
ON DELETE RESTRICT ON UPDATE CASCADE;
