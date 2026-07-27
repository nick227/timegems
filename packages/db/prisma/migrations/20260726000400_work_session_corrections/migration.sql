-- Records an explicit audit signal for user/admin corrections after a
-- session was finalized. updatedAt alone cannot distinguish a correction
-- from the original Stop transaction.
ALTER TABLE `WorkSession`
ADD COLUMN `correctedAt` DATETIME(3) NULL;
