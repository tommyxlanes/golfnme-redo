// Core types for Golf Score Tracker

// ============================================
// USER TYPES
// ============================================

export interface User {
  id: string
  email: string
  name: string
  username: string
  avatarUrl?: string
  handicap?: number
  homeCourseId?: string
  createdAt: Date
  updatedAt: Date
}

export interface UserStats {
  totalRounds: number
  averageScore: number
  bestRound: number
  worstRound: number
  totalBirdies: number
  totalPars: number
  totalBogeys: number
  fairwayPercentage: number
  girPercentage: number
  averagePutts: number
  handicapTrend: number[]
  recentScores: number[]
}

// ============================================
// COURSE & HOLE TYPES
// ============================================

export interface Course {
  id: string
  name: string
  city?: string
  state?: string
  country: string
  address?: string
  latitude?: number
  longitude?: number
  par: number
  numHoles: number
  rating?: number
  slope?: number
  imageUrl?: string
  isPublic: boolean
  holes?: Hole[]
}

export interface Hole {
  id: string
  courseId: string
  holeNumber: number
  par: number
  yardage?: number
  handicapRank?: number
}

// ============================================
// ROUND & SCORE TYPES
// ============================================

export type RoundStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED'

export interface Round {
  id: string
  userId: string
  courseId: string
  sessionId?: string
  playedAt: Date
  weather?: string
  notes?: string
  totalScore?: number
  totalPutts?: number
  fairwaysHit?: number
  greensInReg?: number
  status: RoundStatus
  course?: Course
  scores?: Score[]
  user?: User
}

export interface Score {
  id: string
  roundId: string
  holeId: string
  userId: string
  strokes: number
  putts?: number
  fairwayHit?: boolean
  greenInReg?: boolean
  penalties: number
  hole?: Hole
}

export type ScoreRelativeToPar = 
  | 'albatross'
  | 'eagle'
  | 'birdie'
  | 'par'
  | 'bogey'
  | 'double'
  | 'triple'
  | 'worse'

// ============================================
// FRIEND TYPES
// ============================================

export type RequestStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED'

export interface FriendRequest {
  id: string
  senderId: string
  receiverId: string
  status: RequestStatus
  sender?: User
  receiver?: User
  createdAt: Date
}

export interface Friendship {
  id: string
  user1Id: string
  user2Id: string
  user1?: User
  user2?: User
  createdAt: Date
}

export interface Friend extends User {
  friendshipId: string
  mutualFriends?: number
}

// ============================================
// GROUP SESSION TYPES (Real-time)
// ============================================

export type SessionStatus = 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

export interface GroupSession {
  id: string
  hostId: string
  courseId: string
  name?: string
  inviteCode: string
  status: SessionStatus
  maxPlayers: number
  startedAt?: Date
  endedAt?: Date
  host?: User
  course?: Course
  members?: SessionMember[]
}

export interface SessionMember {
  id: string
  sessionId: string
  userId: string
  joinedAt: Date
  isReady: boolean
  user?: User
}

// ============================================
// REAL-TIME EVENT TYPES
// ============================================

export interface ScoreUpdateEvent {
  sessionId: string
  roundId: string
  userId: string
  holeNumber: number
  score: Score
  playerName: string
  timestamp: Date
}

export interface LeaderboardEntry {
  userId: string
  userName: string
  avatarUrl?: string
  currentHole: number
  totalScore: number
  scoreToPar: number
  lastUpdate: Date
  scores: number[] // Array of 18 scores (0 = not played)
}

export interface SessionState {
  session: GroupSession
  leaderboard: LeaderboardEntry[]
  currentHole: number
}

// ============================================
// METRICS & AGGREGATION TYPES
// ============================================

export interface CourseStats {
  courseId: string
  courseName: string
  roundsPlayed: number
  bestScore: number
  averageScore: number
  lastPlayed: Date
  scoreTrend: number[] // Last 5 rounds
}

export interface HoleStats {
  holeNumber: number
  par: number
  averageScore: number
  bestScore: number
  birdieCount: number
  parCount: number
  bogeyCount: number
  averagePutts: number
}

export interface PerformanceMetrics {
  // Scoring Distribution
  scoringDistribution: {
    eagles: number
    birdies: number
    pars: number
    bogeys: number
    doubleBogeys: number
    worse: number
  }
  
  // Trends
  scoreTrend: {
    date: string
    score: number
    courseName: string
  }[]
  
  // Handicap progression
  handicapHistory: {
    date: string
    handicap: number
  }[]
  
  // Par performance
  parPerformance: {
    par3Average: number
    par4Average: number
    par5Average: number
  }
  
  // Best performances
  bestRound: Round
  bestNine: {
    front: number
    back: number
    roundId: string
    date: Date
  }
  
  // Streaks
  currentStreak: number // Consecutive rounds below average
  bestStreak: number
}

export interface HeadToHead {
  opponentId: string
  opponentName: string
  wins: number
  losses: number
  ties: number
  averageMargin: number
  lastMatchup: Date
  sharedRounds: {
    date: Date
    yourScore: number
    theirScore: number
    courseName: string
  }[]
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

// ============================================
// FORM TYPES
// ============================================

export interface CreateRoundInput {
  courseId: string
  sessionId?: string
  weather?: string
  notes?: string
}

export interface UpdateScoreInput {
  roundId: string
  holeId: string
  strokes: number
  putts?: number
  fairwayHit?: boolean
  greenInReg?: boolean
  penalties?: number
}

export interface CreateSessionInput {
  courseId: string
  name?: string
  maxPlayers?: number
}

export interface JoinSessionInput {
  inviteCode: string
}
