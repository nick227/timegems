-- A session in REVIEWING is still the user's active session, but all timing
-- intervals are closed. This makes Stop authoritative before final notes and
-- gem settlement are committed.
ALTER TABLE `WorkSession`
MODIFY `status` ENUM('RUNNING', 'PAUSED', 'REVIEWING', 'STOPPED') NOT NULL DEFAULT 'RUNNING';
