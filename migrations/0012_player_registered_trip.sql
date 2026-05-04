ALTER TABLE players ADD COLUMN registered_trip_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_players_registered_trip_hash ON players(registered_trip_hash);
