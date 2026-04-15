import { Server as NetServer } from 'http'
import { Server as SocketServer } from 'socket.io'
import type { LeaderboardEntry, ScoreUpdateEvent } from '@/types'

let io: SocketServer | null = null

export function getSocketServer(server: NetServer): SocketServer {
  if (!io) {
    io = new SocketServer(server, {
      path: '/api/socket',
      cors: {
        origin: process.env.NODE_ENV === 'development' 
          ? 'http://localhost:3000' 
          : process.env.NEXT_PUBLIC_URL,
        methods: ['GET', 'POST'],
      },
    })
    
    io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`)
      
      // Join a session room
      socket.on('join-session', (sessionId: string, userId: string) => {
        socket.join(`session:${sessionId}`)
        socket.data.sessionId = sessionId
        socket.data.userId = userId
        
        // Notify others
        socket.to(`session:${sessionId}`).emit('player-joined', {
          userId,
          timestamp: new Date(),
        })
        
        console.log(`User ${userId} joined session ${sessionId}`)
      })
      
      // Leave a session room
      socket.on('leave-session', (sessionId: string) => {
        socket.leave(`session:${sessionId}`)
        
        socket.to(`session:${sessionId}`).emit('player-left', {
          userId: socket.data.userId,
          timestamp: new Date(),
        })
      })
      
      // Score update
      socket.on('score-update', (data: ScoreUpdateEvent) => {
        // Broadcast to all in session except sender
        socket.to(`session:${data.sessionId}`).emit('score-updated', data)
        
        console.log(`Score update in session ${data.sessionId}:`, {
          player: data.playerName,
          hole: data.holeNumber,
          strokes: data.score.strokes,
        })
      })
      
      // Leaderboard update
      socket.on('leaderboard-update', (sessionId: string, leaderboard: LeaderboardEntry[]) => {
        io?.to(`session:${sessionId}`).emit('leaderboard-updated', leaderboard)
      })
      
      // Session status change
      socket.on('session-status', (sessionId: string, status: string) => {
        io?.to(`session:${sessionId}`).emit('session-status-changed', { status })
      })
      
      // Chat message in session
      socket.on('chat-message', (sessionId: string, message: {
        userId: string
        userName: string
        text: string
      }) => {
        io?.to(`session:${sessionId}`).emit('new-chat-message', {
          ...message,
          timestamp: new Date(),
        })
      })
      
      // Disconnection
      socket.on('disconnect', () => {
        if (socket.data.sessionId) {
          socket.to(`session:${socket.data.sessionId}`).emit('player-disconnected', {
            userId: socket.data.userId,
            timestamp: new Date(),
          })
        }
        console.log(`Client disconnected: ${socket.id}`)
      })
    })
  }
  
  return io
}

// Helper to emit from API routes
export function emitToSession(sessionId: string, event: string, data: any) {
  if (io) {
    io.to(`session:${sessionId}`).emit(event, data)
  }
}

export function emitScoreUpdate(data: ScoreUpdateEvent) {
  if (io) {
    io.to(`session:${data.sessionId}`).emit('score-updated', data)
  }
}

export function emitLeaderboardUpdate(sessionId: string, leaderboard: LeaderboardEntry[]) {
  if (io) {
    io.to(`session:${sessionId}`).emit('leaderboard-updated', leaderboard)
  }
}
