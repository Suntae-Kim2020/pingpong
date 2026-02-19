CREATE TABLE IF NOT EXISTS cumulative_match (
  id INT AUTO_INCREMENT PRIMARY KEY,
  club_id INT NOT NULL,
  recorder_member_id INT NOT NULL,
  player1_id INT NOT NULL,
  player2_id INT NOT NULL,
  player1_score INT NOT NULL DEFAULT 0,
  player2_score INT NOT NULL DEFAULT 0,
  match_date DATE NOT NULL,
  memo VARCHAR(200) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_club (club_id),
  INDEX idx_players (player1_id, player2_id),
  FOREIGN KEY (club_id) REFERENCES club(id),
  FOREIGN KEY (player1_id) REFERENCES member(id),
  FOREIGN KEY (player2_id) REFERENCES member(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
