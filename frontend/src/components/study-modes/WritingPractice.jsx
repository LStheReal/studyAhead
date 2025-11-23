import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../services/api'
import { ArrowLeft, RotateCcw, Trophy, CheckCircle2, XCircle } from 'lucide-react'

// LCS (Longest Common Subsequence) diff algorithm
const computeLCS = (str1, str2) => {
  const m = str1.length
  const n = str2.length
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }
  
  // Reconstruct LCS
  const lcs = []
  let i = m, j = n
  while (i > 0 && j > 0) {
    if (str1[i - 1] === str2[j - 1]) {
      lcs.unshift({ char: str1[i - 1], pos1: i - 1, pos2: j - 1 })
      i--
      j--
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--
    } else {
      j--
    }
  }
  
  return lcs
}

const normalizeText = (text) => {
  return text
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .trim()
    .replace(/\s+/g, ' ')
}

const compareAnswers = (userAnswer, correctAnswer) => {
  const normalizedUser = normalizeText(userAnswer)
  const normalizedCorrect = normalizeText(correctAnswer)
  
  if (normalizedUser === normalizedCorrect) {
    return { isCorrect: true, diff: null }
  }
  
  // Compute LCS
  const lcs = computeLCS(normalizedUser, normalizedCorrect)
  const lcsPositions = new Set(lcs.map(item => item.pos1))
  
  // Build diff for user answer
  const userDiff = []
  for (let i = 0; i < normalizedUser.length; i++) {
    if (lcsPositions.has(i)) {
      userDiff.push({ char: normalizedUser[i], status: 'correct' })
    } else {
      userDiff.push({ char: normalizedUser[i], status: 'incorrect' })
    }
  }
  
  // Build diff for correct answer (showing missing/wrong chars)
  const correctDiff = []
  const userLcsPositions = new Set(lcs.map(item => item.pos2))
  for (let i = 0; i < normalizedCorrect.length; i++) {
    if (userLcsPositions.has(i)) {
      correctDiff.push({ char: normalizedCorrect[i], status: 'correct' })
    } else {
      correctDiff.push({ char: normalizedCorrect[i], status: 'missing' })
    }
  }
  
  return { isCorrect: false, diff: { user: userDiff, correct: correctDiff } }
}

const WritingPractice = () => {
  const { planId } = useParams()
  const [searchParams] = useSearchParams()
  const taskId = searchParams.get('taskId')
  const testMode = searchParams.get('testMode') === 'true'
  const navigate = useNavigate()
  
  const [flashcards, setFlashcards] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [userAnswer, setUserAnswer] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sideSwapped, setSideSwapped] = useState(false)
  
  // Progress tracking
  const [cardStatus, setCardStatus] = useState({}) // flashcardId -> { known: false, attempts: 0 }
  const [correctCount, setCorrectCount] = useState(0)
  const [incorrectCount, setIncorrectCount] = useState(0)
  const [completed, setCompleted] = useState(false)
  
  // Test results
  const [testResults, setTestResults] = useState([])
  
  const inputRef = useRef(null)

  useEffect(() => {
    fetchData()
  }, [planId])

  useEffect(() => {
    if (!submitted && inputRef.current) {
      inputRef.current.focus()
    }
  }, [currentIndex, submitted])

  const fetchData = async () => {
    try {
      const response = await api.get(`/flashcards/study-plan/${planId}`)
      const cards = response.data
      
      // Shuffle
      const shuffled = [...cards].sort(() => Math.random() - 0.5)
      setFlashcards(shuffled)
      
      // Initialize status
      const status = {}
      cards.forEach(card => {
        status[card.id] = { known: false, attempts: 0 }
      })
      setCardStatus(status)
    } catch (error) {
      console.error('Failed to fetch flashcards:', error)
    } finally {
      setLoading(false)
    }
  }

  const currentCard = flashcards[currentIndex]
  const displayQuestion = sideSwapped ? currentCard?.back_text : currentCard?.front_text
  const correctAnswer = sideSwapped ? currentCard?.front_text : currentCard?.back_text

  const handleCheckAnswer = () => {
    if (!userAnswer.trim() || !currentCard) return
    
    const comparison = compareAnswers(userAnswer, correctAnswer)
    setResult(comparison)
    setSubmitted(true)
    
    const cardId = currentCard.id
    const status = cardStatus[cardId] || { known: false, attempts: 0 }
    
    if (comparison.isCorrect) {
      setCorrectCount(prev => prev + 1)
      status.known = true
      
      // Update mastery
      api.post(`/flashcards/${cardId}/update-mastery?mastery_level=${Math.min(100, (currentCard.mastery_level || 0) + 10)}`)
        .catch(console.error)
      
      // Track test results
      if (testMode) {
        setTestResults(prev => [...prev, { flashcardId: cardId, correct: true }])
      }
    } else {
      setIncorrectCount(prev => prev + 1)
      status.attempts = (status.attempts || 0) + 1
      
      // Track test results
      if (testMode) {
        setTestResults(prev => [...prev, { flashcardId: cardId, correct: false }])
      }
    }
    
    setCardStatus(prev => ({ ...prev, [cardId]: status }))
  }

  const handleContinue = () => {
    if (!currentCard) return
    
    const cardId = currentCard.id
    const status = cardStatus[cardId]
    
    if (result?.isCorrect) {
      // Remove card from deck
      const newCards = flashcards.filter((_, i) => i !== currentIndex)
      if (newCards.length === 0) {
        setCompleted(true)
        return
      }
      
      // Adjust index
      const newIndex = currentIndex >= newCards.length ? newCards.length - 1 : currentIndex
      setFlashcards(newCards)
      setCurrentIndex(newIndex)
    } else {
      // Re-insert 3-5 positions ahead
      const insertPosition = currentIndex + Math.floor(Math.random() * 3) + 3
      const newCards = [...flashcards]
      newCards.splice(insertPosition, 0, currentCard)
      setFlashcards(newCards)
      
      // Move to next
      if (currentIndex < flashcards.length - 1) {
        setCurrentIndex(currentIndex + 1)
      } else {
        setCurrentIndex(0)
      }
    }
    
    // Reset state
    setUserAnswer('')
    setSubmitted(false)
    setResult(null)
  }

  const handleSkip = () => {
    // Mark as incorrect and continue
    const cardId = currentCard.id
    const status = cardStatus[cardId] || { known: false, attempts: 0 }
    status.attempts = (status.attempts || 0) + 1
    setCardStatus(prev => ({ ...prev, [cardId]: status }))
    setIncorrectCount(prev => prev + 1)
    
    if (testMode) {
      setTestResults(prev => [...prev, { flashcardId: cardId, correct: false }])
    }
    
    handleContinue()
  }

  const handleRestart = () => {
    const status = {}
    flashcards.forEach(card => {
      status[card.id] = { known: false, attempts: 0 }
    })
    setCardStatus(status)
    setCorrectCount(0)
    setIncorrectCount(0)
    setCompleted(false)
    setTestResults([])
    setCurrentIndex(0)
    setUserAnswer('')
    setSubmitted(false)
    setResult(null)
    
    // Reshuffle
    const shuffled = [...flashcards].sort(() => Math.random() - 0.5)
    setFlashcards(shuffled)
  }

  // Check completion
  useEffect(() => {
    if (flashcards.length > 0) {
      const allKnown = flashcards.every(card => cardStatus[card.id]?.known)
      if (allKnown && flashcards.length > 0) {
        setCompleted(true)
      }
    }
  }, [cardStatus, flashcards])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (flashcards.length === 0) {
    return (
      <div className="p-4">
        <div className="card text-center py-12">
          <p className="text-slate-600 dark:text-slate-400">No flashcards available</p>
          <button
            onClick={() => navigate(`/plans/${planId}`)}
            className="mt-4 btn-primary"
          >
            Back to Plan
          </button>
        </div>
      </div>
    )
  }

  if (completed) {
    const totalWords = flashcards.length
    const firstTryCorrect = Object.values(cardStatus).filter(s => s.known && s.attempts === 1).length
    const totalAttempts = Object.values(cardStatus).reduce((sum, s) => sum + s.attempts, 0)
    const avgAttempts = totalWords > 0 ? (totalAttempts / totalWords).toFixed(1) : 0
    const accuracy = totalWords > 0 ? (correctCount / (correctCount + incorrectCount)) * 100 : 0
    
    if (testMode) {
      return (
        <div className="p-4">
          <div className="card text-center py-12">
            <Trophy size={64} className="mx-auto mb-4 text-yellow-500" />
            <h2 className="text-2xl font-bold mb-2">Writing Practice Complete!</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Score: {correctCount} / {totalWords} ({accuracy.toFixed(0)}%)
            </p>
            <button
              onClick={() => {
                if (window.testFlowCallback) {
                  window.testFlowCallback({ mode: 'write', results: testResults })
                }
              }}
              className="btn-primary"
            >
              Continue to Next Phase
            </button>
          </div>
        </div>
      )
    }
    
    return (
      <div className="p-4">
        <div className="card text-center py-12">
          <Trophy size={64} className="mx-auto mb-4 text-yellow-500" />
          <h2 className="text-2xl font-bold mb-2">Writing Practice Complete!</h2>
          
          <div className="mt-6 space-y-2 text-left max-w-md mx-auto">
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Total words practiced:</span>
              <span className="font-medium">{totalWords}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Correct on first attempt:</span>
              <span className="font-medium text-green-600">{firstTryCorrect} / {totalWords}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Average attempts per word:</span>
              <span className="font-medium">{avgAttempts}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Accuracy percentage:</span>
              <span className="font-medium">{accuracy.toFixed(1)}%</span>
            </div>
          </div>

          <div className="flex gap-3 mt-8 justify-center">
            <button
              onClick={handleRestart}
              className="btn-secondary"
            >
              <RotateCcw size={20} className="inline mr-2" />
              Practice Again
            </button>
            <button
              onClick={() => navigate(`/plans/${planId}`)}
              className="btn-primary"
            >
              Back to Overview
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => navigate(`/plans/${planId}`)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
          >
            <ArrowLeft size={24} />
          </button>
          
          <div className="text-sm">
            <span className="font-medium">Card {currentIndex + 1} / {flashcards.length}</span>
          </div>
          
          <button
            onClick={() => setSideSwapped(!sideSwapped)}
            className="px-3 py-1 text-sm btn-secondary"
          >
            {sideSwapped ? 'Q: Answer' : 'Q: Question'} ↔️
          </button>
        </div>
        
        <div className="flex justify-center gap-6 text-sm mt-2">
          <span className="text-green-600 dark:text-green-400">✓ {correctCount}</span>
          <span className="text-red-600 dark:text-red-400">✗ {incorrectCount}</span>
        </div>
      </div>

      {/* Question Card */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="card max-w-2xl mx-auto">
          <div className="text-center mb-6">
            <div className="text-2xl font-semibold mb-4">
              {displayQuestion}
            </div>
          </div>

          {/* Input Field */}
          <div className="mb-6">
            <input
              ref={inputRef}
              type="text"
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !submitted && userAnswer.trim()) {
                  handleCheckAnswer()
                }
              }}
              placeholder="Type your answer..."
              disabled={submitted}
              className="w-full px-4 py-3 text-lg border-2 border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:border-blue-500 bg-white dark:bg-white text-slate-900"
            />
          </div>

          {/* Result Display */}
          {submitted && result && (
            <div className="mb-6">
              {result.isCorrect ? (
                <div className="text-center">
                  <CheckCircle2 size={48} className="mx-auto mb-4 text-green-500" />
                  <div className="text-xl font-semibold text-green-600 dark:text-green-400 mb-2">
                    Correct!
                  </div>
                  <div className="text-lg text-slate-600 dark:text-slate-400">
                    Your answer: <span className="font-medium text-green-600">{userAnswer}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <XCircle size={48} className="mx-auto mb-4 text-red-500" />
                  <div className="text-xl font-semibold text-red-600 dark:text-red-400 mb-4">
                    Not quite
                  </div>
                  
                  {/* Character-by-character comparison */}
                  <div className="text-left space-y-3">
                    <div>
                      <div className="text-sm font-medium mb-1 text-slate-600 dark:text-slate-400">
                        Your answer:
                      </div>
                      <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                        {result.diff.user.map((item, idx) => (
                          <span
                            key={idx}
                            className={
                              item.status === 'correct'
                                ? 'bg-green-200 dark:bg-green-800'
                                : 'bg-red-200 dark:bg-red-800'
                            }
                          >
                            {item.char}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-sm font-medium mb-1 text-slate-600 dark:text-slate-400">
                        Correct answer:
                      </div>
                      <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                        {result.diff.correct.map((item, idx) => (
                          <span
                            key={idx}
                            className={
                              item.status === 'correct'
                                ? 'text-slate-600 dark:text-slate-400'
                                : 'font-bold text-red-600 dark:text-red-400'
                            }
                          >
                            {item.char}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="p-4 border-t border-gray-200 dark:border-slate-700 space-y-3">
        {!submitted ? (
          <button
            onClick={handleCheckAnswer}
            disabled={!userAnswer.trim()}
            className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Check Answer
          </button>
        ) : (
          <div className="flex gap-3">
            {!result?.isCorrect && (
              <button
                onClick={() => {
                  setUserAnswer('')
                  setSubmitted(false)
                  setResult(null)
                  if (inputRef.current) inputRef.current.focus()
                }}
                className="flex-1 btn-secondary"
              >
                Try Again
              </button>
            )}
            {!result?.isCorrect && (
              <button
                onClick={handleSkip}
                className="flex-1 btn-secondary"
              >
                Show Answer
              </button>
            )}
            <button
              onClick={handleContinue}
              className="flex-1 btn-primary"
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default WritingPractice

