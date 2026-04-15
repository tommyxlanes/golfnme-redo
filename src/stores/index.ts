import { create } from 'zustand'
import { io, Socket } from 'socket.io-client'
import type { 
  User, 
  Round, 
  Score, 
  GroupSession, 
  LeaderboardEntry,
  ScoreUpdateEvent,
} from '@/types'

// ============================================
// AUTH STORE
// ============================================

interface AuthState {
  user: User | null
  isLoading: boolean
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
}))

// ============================================
// ACTIVE ROUND STORE
// ============================================

interface ActiveRoundState {
  round: Round | null
  scores: Map<string, Score> // holeId -> Score
  currentHole: number
  
  setRound: (round: Round | null) => void
  setScore: (holeId: string, score: Score) => void
  setCurrentHole: (hole: number) => void
  clearRound: () => void
  
  // Computed
  getTotalScore: () => number
  getScoreToPar: (coursePar: number) => number
}

export const useActiveRoundStore = create<ActiveRoundState>((set, get) => ({
  round: null,
  scores: new Map(),
  currentHole: 1,
  
  setRound: (round) => {
    const scores = new Map<string, Score>()
    if (round?.scores) {
      for (const score of round.scores) {
        scores.set(score.holeId, score)
      }
    }
    set({ round, scores })
  },
  
  setScore: (holeId, score) => {
    const scores = new Map(get().scores)
    scores.set(holeId, score)
    set({ scores })
  },
  
  setCurrentHole: (currentHole) => set({ currentHole }),
  
  clearRound: () => set({ round: null, scores: new Map(), currentHole: 1 }),
  
  getTotalScore: () => {
    const { scores } = get()
    let total = 0
    scores.forEach((score) => {
      total += score.strokes
    })
    return total
  },
  
  getScoreToPar: (coursePar) => {
    return get().getTotalScore() - coursePar
  },
}))

// ============================================
// SESSION STORE (Real-time multiplayer)
// ============================================

interface SessionState {
  session: GroupSession | null
  socket: Socket | null
  isConnected: boolean
  leaderboard: LeaderboardEntry[]
  chatMessages: Array<{
    userId: string
    userName: string
    text: string
    timestamp: Date
  }>
  
  // Actions
  initSocket: () => void
  disconnectSocket: () => void
  joinSession: (session: GroupSession, userId: string) => void
  leaveSession: () => void
  sendScoreUpdate: (data: ScoreUpdateEvent) => void
  sendChatMessage: (userId: string, userName: string, text: string) => void
  
  // Internal
  setSession: (session: GroupSession | null) => void
  updateLeaderboard: (leaderboard: LeaderboardEntry[]) => void
  addChatMessage: (message: SessionState['chatMessages'][0]) => void
}

export const useSessionStore = create<SessionState>((set, get) => ({
  session: null,
  socket: null,
  isConnected: false,
  leaderboard: [],
  chatMessages: [],
  
  initSocket: () => {
    const existingSocket = get().socket
    if (existingSocket) return
    
    const socket = io({
      path: '/api/socket',
      autoConnect: true,
    })
    
    socket.on('connect', () => {
      set({ isConnected: true })
      console.log('Socket connected')
    })
    
    socket.on('disconnect', () => {
      set({ isConnected: false })
      console.log('Socket disconnected')
    })
    
    socket.on('score-updated', (data: ScoreUpdateEvent) => {
      // Update leaderboard entry for this player
      const { leaderboard } = get()
      const updatedLeaderboard = leaderboard.map(entry => {
        if (entry.userId === data.userId) {
          const newScores = [...entry.scores]
          newScores[data.holeNumber - 1] = data.score.strokes
          const newTotal = newScores.reduce((a, b) => a + b, 0)
          
          return {
            ...entry,
            scores: newScores,
            totalScore: newTotal,
            currentHole: Math.max(entry.currentHole, data.holeNumber),
            lastUpdate: new Date(),
          }
        }
        return entry
      })
      
      // Sort by score
      updatedLeaderboard.sort((a, b) => a.totalScore - b.totalScore)
      set({ leaderboard: updatedLeaderboard })
    })
    
    socket.on('leaderboard-updated', (leaderboard: LeaderboardEntry[]) => {
      set({ leaderboard })
    })
    
    socket.on('new-chat-message', (message: SessionState['chatMessages'][0]) => {
      set({ chatMessages: [...get().chatMessages, message] })
    })
    
    socket.on('player-joined', ({ userId }: { userId: string }) => {
      console.log('Player joined:', userId)
    })
    
    socket.on('player-left', ({ userId }: { userId: string }) => {
      console.log('Player left:', userId)
    })
    
    socket.on('session-status-changed', ({ status }: { status: string }) => {
      const { session } = get()
      if (session) {
        set({ session: { ...session, status: status as any } })
      }
    })
    
    set({ socket })
  },
  
  disconnectSocket: () => {
    const { socket } = get()
    if (socket) {
      socket.disconnect()
      set({ socket: null, isConnected: false })
    }
  },
  
  joinSession: (session, userId) => {
    const { socket } = get()
    set({ 
      session, 
      leaderboard: [],
      chatMessages: [],
    })
    
    if (socket) {
      socket.emit('join-session', session.id, userId)
    }
  },
  
  leaveSession: () => {
    const { socket, session } = get()
    
    if (socket && session) {
      socket.emit('leave-session', session.id)
    }
    
    set({ 
      session: null, 
      leaderboard: [],
      chatMessages: [],
    })
  },
  
  sendScoreUpdate: (data) => {
    const { socket } = get()
    if (socket) {
      socket.emit('score-update', data)
    }
  },
  
  sendChatMessage: (userId, userName, text) => {
    const { socket, session } = get()
    if (socket && session) {
      socket.emit('chat-message', session.id, { userId, userName, text })
    }
  },
  
  setSession: (session) => set({ session }),
  updateLeaderboard: (leaderboard) => set({ leaderboard }),
  addChatMessage: (message) => set({ chatMessages: [...get().chatMessages, message] }),
}))

// ============================================
// UI STORE
// ============================================

interface UIState {
  sidebarOpen: boolean
  activeTab: 'play' | 'history' | 'stats' | 'friends' | 'profile'
  
  setSidebarOpen: (open: boolean) => void
  setActiveTab: (tab: UIState['activeTab']) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  activeTab: 'play',
  
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setActiveTab: (activeTab) => set({ activeTab }),
}))
