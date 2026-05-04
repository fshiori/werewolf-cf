ALTER TABLE players ADD COLUMN trip_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_players_trip_hash ON players(trip_hash);
