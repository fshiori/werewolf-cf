/**
 * Tripcode 評分系統
 */

/**
 * Tripcode 評分資料
 */
export interface TripScoreData {
  trip: string;
  score: number;
  gamesPlayed: number;
  humanWins: number;
  wolfWins: number;
  foxWins: number;
  lastPlayed: number;
}

/**
 * Tripcode 評分管理器
 */
export class TripScoreManager {
  constructor(private db: any) {}

  /**
   * 獲取 Tripcode 評分
   */
  async getTripScore(trip: string): Promise<TripScoreData | null> {
    const result = await this.db
      .prepare('SELECT * FROM trip_scores WHERE trip = ?')
      .bind(trip)
      .first();

    return result as TripScoreData | null;
  }

  /**
   * 建立或更新 Tripcode 評分
   */
  async upsertTripScore(data: Partial<TripScoreData>): Promise<void> {
    const existing = await this.getTripScore(data.trip!);

    if (existing) {
      // 更新
      await this.db
        .prepare(`
          UPDATE trip_scores
          SET score = ?,
              games_played = games_played + 1,
              human_wins = human_wins + ?,
              wolf_wins = wolf_wins + ?,
              fox_wins = fox_wins + ?,
              last_played = ?
          WHERE trip = ?
        `)
        .bind(
          data.score || existing.score,
          data.humanWins || 0,
          data.wolfWins || 0,
          data.foxWins || 0,
          Date.now(),
          data.trip
        )
        .run();
    } else {
      // 新增
      await this.db
        .prepare(`
          INSERT INTO trip_scores (trip, score, games_played, human_wins, wolf_wins, fox_wins, last_played)
          VALUES (?, ?, 1, ?, ?, ?, ?)
        `)
        .bind(
          data.trip,
          data.score || 0,
          data.humanWins || 0,
          data.wolfWins || 0,
          data.foxWins || 0,
          Date.now()
        )
        .run();
    }
  }

  /**
   * 更新評分（遊戲結束時調用）
   */
  async updateScore(
    trip: string,
    role: string,
    won: boolean,
    mvp: boolean = false
  ): Promise<void> {
    const existing = await this.getTripScore(trip);
    
    let scoreChange = 0;
    
    // 基礎分
    if (won) {
      scoreChange += 10;
    } else {
      scoreChange -= 5;
    }

    // MVP 加分
    if (mvp) {
      scoreChange += 20;
    }

    // 角色加分
    if (role === 'human') {
      scoreChange += won ? 5 : 0;
    } else if (role.includes('wolf')) {
      scoreChange += won ? 10 : -5;
    } else if (role.includes('fox')) {
      scoreChange += won ? 15 : -5;
    }

    const newScore = (existing?.score || 0) + scoreChange;

    const winType = role.includes('wolf') ? 'wolfWins' 
      : role.includes('fox') ? 'foxWins' 
      : 'humanWins';

    await this.upsertTripScore({
      trip,
      score: newScore,
      [winType]: won ? 1 : 0
    });
  }

  /**
   * 獲取排行榜
   */
  async getLeaderboard(limit: number = 100): Promise<TripScoreData[]> {
    const result = await this.db
      .prepare(`
        SELECT * FROM trip_scores
        ORDER BY score DESC
        LIMIT ?
      `)
      .bind(limit)
      .all();

    return result.results as TripScoreData[];
  }

  /**
   * 獲取 Tripcode 排名
   */
  async getTripRank(trip: string): Promise<number> {
    const scoreData = await this.getTripScore(trip);
    
    if (!scoreData) {
      return 0;
    }

    const result = await this.db
      .prepare('SELECT COUNT(*) as count FROM trip_scores WHERE score > ?')
      .bind(scoreData.score)
      .first();

    return (result as any).count + 1;
  }

  /**
   * 獲取統計資料
   */
  async getStats(): Promise<{
    totalTrips: number;
    totalGames: number;
    averageScore: number;
  }> {
    const countResult = await this.db
      .prepare('SELECT COUNT(*) as count FROM trip_scores')
      .first();

    const totalResult = await this.db
      .prepare('SELECT SUM(games_played) as total, AVG(score) as avg FROM trip_scores')
      .first();

    return {
      totalTrips: (countResult as any).count,
      totalGames: (totalResult as any).total,
      averageScore: Math.round((totalResult as any).avg || 0)
    };
  }
}
