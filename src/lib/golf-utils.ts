import type { ScoreRelativeToPar, Score, Hole, Round, PerformanceMetrics } from '@/types'

// ============================================
// SCORE RELATIVE TO PAR
// ============================================

export function getScoreRelativeToPar(strokes: number, par: number): ScoreRelativeToPar {
  const diff = strokes - par
  
  if (diff <= -3) return 'albatross'
  if (diff === -2) return 'eagle'
  if (diff === -1) return 'birdie'
  if (diff === 0) return 'par'
  if (diff === 1) return 'bogey'
  if (diff === 2) return 'double'
  if (diff === 3) return 'triple'
  return 'worse'
}

export function getScoreColor(score: ScoreRelativeToPar): string {
  const colors: Record<ScoreRelativeToPar, string> = {
    albatross: 'text-purple-600 bg-purple-100',
    eagle: 'text-eagle bg-blue-100',
    birdie: 'text-birdie bg-emerald-100',
    par: 'text-par bg-gray-100',
    bogey: 'text-bogey bg-amber-100',
    double: 'text-double bg-red-100',
    triple: 'text-worse bg-red-200',
    worse: 'text-worse bg-red-300',
  }
  return colors[score]
}

export function getScoreLabel(score: ScoreRelativeToPar): string {
  const labels: Record<ScoreRelativeToPar, string> = {
    albatross: 'Albatross',
    eagle: 'Eagle',
    birdie: 'Birdie',
    par: 'Par',
    bogey: 'Bogey',
    double: 'Double',
    triple: 'Triple',
    worse: '+4',
  }
  return labels[score]
}

export function formatScoreToPar(scoreToPar: number): string {
  if (scoreToPar === 0) return 'E'
  if (scoreToPar > 0) return `+${scoreToPar}`
  return `${scoreToPar}`
}

// ============================================
// ROUND CALCULATIONS
// ============================================

export function calculateRoundTotal(scores: Score[]): number {
  return scores.reduce((total, score) => total + score.strokes, 0)
}

export function calculateScoreToPar(scores: Score[], holes: Hole[]): number {
  const totalStrokes = calculateRoundTotal(scores)
  const totalPar = holes.reduce((total, hole) => total + hole.par, 0)
  return totalStrokes - totalPar
}

export function calculateFrontNine(scores: Score[], holes: Hole[]): number {
  const frontScores = scores.filter(s => {
    const hole = holes.find(h => h.id === s.holeId)
    return hole && hole.holeNumber <= 9
  })
  return calculateRoundTotal(frontScores)
}

export function calculateBackNine(scores: Score[], holes: Hole[]): number {
  const backScores = scores.filter(s => {
    const hole = holes.find(h => h.id === s.holeId)
    return hole && hole.holeNumber > 9
  })
  return calculateRoundTotal(backScores)
}

export function calculatePutts(scores: Score[]): number {
  return scores.reduce((total, score) => total + (score.putts ?? 0), 0)
}

export function calculateFairwaysHit(scores: Score[], holes: Hole[]): { hit: number; total: number } {
  // Only count par 4s and par 5s
  const relevantScores = scores.filter(s => {
    const hole = holes.find(h => h.id === s.holeId)
    return hole && hole.par >= 4
  })
  
  const hit = relevantScores.filter(s => s.fairwayHit === true).length
  const total = relevantScores.length
  
  return { hit, total }
}

export function calculateGIR(scores: Score[]): { hit: number; total: number } {
  const hit = scores.filter(s => s.greenInReg === true).length
  return { hit, total: scores.length }
}

// ============================================
// HANDICAP CALCULATION
// ============================================

export function calculateHandicapDifferential(
  score: number,
  courseRating: number,
  slopeRating: number
): number {
  return ((score - courseRating) * 113) / slopeRating
}

export function calculateHandicapIndex(differentials: number[]): number {
  if (differentials.length < 3) return 0
  
  // Sort and take best differentials based on count
  const sorted = [...differentials].sort((a, b) => a - b)
  
  let numToUse: number
  if (differentials.length <= 5) numToUse = 1
  else if (differentials.length <= 8) numToUse = 2
  else if (differentials.length <= 11) numToUse = 3
  else if (differentials.length <= 14) numToUse = 4
  else if (differentials.length <= 16) numToUse = 5
  else if (differentials.length <= 18) numToUse = 6
  else numToUse = 8
  
  const bestDiffs = sorted.slice(0, numToUse)
  const average = bestDiffs.reduce((a, b) => a + b, 0) / numToUse
  
  // Apply 0.96 multiplier and round to 1 decimal
  return Math.round(average * 0.96 * 10) / 10
}

// ============================================
// STATISTICS CALCULATIONS
// ============================================

export function calculateScoringDistribution(scores: Score[], holes: Hole[]): PerformanceMetrics['scoringDistribution'] {
  const distribution = {
    eagles: 0,
    birdies: 0,
    pars: 0,
    bogeys: 0,
    doubleBogeys: 0,
    worse: 0,
  }
  
  for (const score of scores) {
    const hole = holes.find(h => h.id === score.holeId)
    if (!hole) continue
    
    const relative = getScoreRelativeToPar(score.strokes, hole.par)
    
    switch (relative) {
      case 'albatross':
      case 'eagle':
        distribution.eagles++
        break
      case 'birdie':
        distribution.birdies++
        break
      case 'par':
        distribution.pars++
        break
      case 'bogey':
        distribution.bogeys++
        break
      case 'double':
        distribution.doubleBogeys++
        break
      default:
        distribution.worse++
    }
  }
  
  return distribution
}

export function calculateParPerformance(scores: Score[], holes: Hole[]): PerformanceMetrics['parPerformance'] {
  const par3Scores: number[] = []
  const par4Scores: number[] = []
  const par5Scores: number[] = []
  
  for (const score of scores) {
    const hole = holes.find(h => h.id === score.holeId)
    if (!hole) continue
    
    if (hole.par === 3) par3Scores.push(score.strokes)
    else if (hole.par === 4) par4Scores.push(score.strokes)
    else if (hole.par === 5) par5Scores.push(score.strokes)
  }
  
  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
  
  return {
    par3Average: Math.round(avg(par3Scores) * 100) / 100,
    par4Average: Math.round(avg(par4Scores) * 100) / 100,
    par5Average: Math.round(avg(par5Scores) * 100) / 100,
  }
}

// ============================================
// INVITE CODE GENERATION
// ============================================

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Excluded confusing chars
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// ============================================
// DATE HELPERS
// ============================================

export function formatRoundDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - new Date(date).getTime()
  
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  
  return formatRoundDate(date)
}
