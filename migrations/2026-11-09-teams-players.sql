-- Additive migration: leave whiteboard_sets and all existing boards intact.
-- These tables use NoCodeBackend's default private policy. Only the authenticated
-- server gateway may read/write them; owner_key is never accepted from a client.
-- NoCodeBackend execute_sql accepts one statement per call: execute each CREATE
-- TABLE below separately, in this order.
CREATE TABLE IF NOT EXISTS volley_teams (
  id INT NOT NULL AUTO_INCREMENT,
  owner_key CHAR(64) NOT NULL,
  name VARCHAR(100) NOT NULL,
  board_state LONGTEXT NULL,
  deleted TINYINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY volley_teams_id_owner (id, owner_key),
  KEY volley_teams_owner (owner_key, id),
  CONSTRAINT volley_teams_deleted_check CHECK (deleted IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS volley_players (
  id INT NOT NULL AUTO_INCREMENT,
  owner_key CHAR(64) NOT NULL,
  team_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  number VARCHAR(20) NOT NULL DEFAULT '',
  rating_col TINYINT NULL,
  rating_o TINYINT NULL,
  rating_r TINYINT NULL,
  rating_c TINYINT NULL,
  rating_l TINYINT NULL,
  deleted TINYINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY volley_players_team_owner (team_id, owner_key),
  KEY volley_players_owner_team (owner_key, team_id, id),
  CONSTRAINT volley_players_team_fk FOREIGN KEY (team_id, owner_key)
    REFERENCES volley_teams (id, owner_key) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT volley_players_deleted_check CHECK (deleted IN (0, 1)),
  CONSTRAINT volley_players_rating_col_check CHECK (rating_col IS NULL OR rating_col BETWEEN 0 AND 5),
  CONSTRAINT volley_players_rating_o_check CHECK (rating_o IS NULL OR rating_o BETWEEN 0 AND 5),
  CONSTRAINT volley_players_rating_r_check CHECK (rating_r IS NULL OR rating_r BETWEEN 0 AND 5),
  CONSTRAINT volley_players_rating_c_check CHECK (rating_c IS NULL OR rating_c BETWEEN 0 AND 5),
  CONSTRAINT volley_players_rating_l_check CHECK (rating_l IS NULL OR rating_l BETWEEN 0 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
