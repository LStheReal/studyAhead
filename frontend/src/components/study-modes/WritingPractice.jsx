import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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

const WritingPractice = ({ preLoadedCards, onComplete, isTestMode }) => {
  const { planId: paramPlanId, id: paramId } = useParams()
  const planId = paramPlanId || paramId
  const navigate = useNavigate()

  const [flashcards, setFlashcards] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [userAnswer, setUserAnswer] = useState('')
  const [result, setResult] = useState(null)
  const [submitted, setSubmitted] = useState(false)

  const [cardStatus, setCardStatus] = useState({}) // { [id]: { known: bool, attempts: int } }
  const [correctCount, setCorrectCount] = useState(0)
  const [incorrectCount, setIncorrectCount] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [loading, setLoading] = useState(true)

  const [sideSwapped, setSideSwapped] = useState(false) // If true, show back (native) and ask for front (target)

  const inputRef = useRef(null)

  useEffect(() => {
    if (preLoadedCards) {
      if (preLoadedCards.length === 0) {
        setCompleted(true)
        if (onComplete) onComplete({})
        return
      }
      setFlashcards(preLoadedCards)

      // Initialize status
      const status = {}
      preLoadedCards.forEach(card => {
        status[card.id] = { known: false, attempts: 0 }
      })
      setCardStatus(status)
      setLoading(false)
    } else {
      fetchData()
    }
  }, [planId, preLoadedCards])

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
    } else {
      setIncorrectCount(prev => prev + 1)
      status.attempts = (status.attempts || 0) + 1
    }

    setCardStatus(prev => ({ ...prev, [cardId]: status }))
  }

  const handleContinue = () => {
    if (!currentCard) return

    const cardId = currentCard.id
    const status = cardStatus[cardId]

    if (result?.isCorrect || isTestMode) {
      // Remove gap from deck
      const newCards = flashcards.filter((_, i) => i !== currentIndex)
      if (newCards.length === 0) {
        setCompleted(true)
        if (onComplete) {
          onComplete(cardStatus)
        } else if (window.testFlowCallback) {
          window.testFlowCallback(cardStatus)
        }
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

    // Show correct answer before continuing
    setResult({
      isCorrect: false,
      diff: {
        user: [],
        correct: normalizeText(correctAnswer).split('').map(c => ({ char: c, status: 'missing' }))
      }
    })
    setSubmitted(true)
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
    setCurrentIndex(0)
    setUserAnswer('')
    setSubmitted(false)
    setResult(null)

    // Reshuffle
    const shuffled = [...flashcards].sort(() => Math.random() - 0.5)
    setFlashcards(shuffled)
  }


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
    if (isTestMode) return null
    const totalWords = Object.keys(cardStatus).length
    const firstTryCorrect = Object.values(cardStatus).filter(s => s.known && s.attempts === 0).length
    const totalAttempts = correctCount + incorrectCount
    const avgAttempts = totalWords > 0 ? (totalAttempts / totalWords).toFixed(1) : 0
    const accuracy = totalAttempts > 0 ? (correctCount / totalAttempts) * 100 : 0

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
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50 dark:bg-slate-900 overflow-hidden h-[100dvh] w-full pb-24 pt-4">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => navigate(`/plans/${planId}`)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} />
          </button>

          <div className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Card {currentIndex + 1} / {flashcards.length}
          </div>

          <button
            onClick={() => setSideSwapped(!sideSwapped)}
            className="px-3 py-1 text-sm btn-secondary"
          >
            {sideSwapped ? 'Q: Answer' : 'Q: Question'} ↔️
          </button>
        </div>

        <div className="flex justify-center gap-6 text-sm mt-2 font-medium">
          <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
            <CheckCircle2 size={16} /> {correctCount}
          </span>
          <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
            <XCircle size={16} /> {incorrectCount}
          </span>
        </div>
      </div>

      {/* Question Card */}
      <div className="flex-1 p-4 overflow-y-auto flex flex-col items-center justify-center">
        <div className="w-full max-w-2xl">
          <div className="card p-8 md:p-12 mb-6 text-center shadow-lg">
            <div className="text-sm text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 font-bold">
              Translate this term
            </div>
            <div className="text-3xl md:text-4xl font-bold mb-8 text-slate-800 dark:text-white">
              {displayQuestion}
            </div>

            {/* Input Field */}
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (!submitted && userAnswer.trim()) {
                      handleCheckAnswer()
                    } else if (submitted) {
                      handleContinue()
                    }
                  }
                }}
                placeholder="Type the answer..."
                disabled={submitted}
                className={`w-full px-6 py-4 text-xl md:text-2xl text-center border-b-4 bg-transparent focus:outline-none transition-all ${submitted
                  ? result?.isCorrect
                    ? 'border-green-500 text-green-600'
                    : 'border-red-500 text-red-600'
                  : 'border-gray-300 dark:border-slate-600 focus:border-blue-500 text-slate-800 dark:text-white'
                  }`}
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
              />
              {!submitted && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium hidden md:block">
                  Press Enter
                </div>
              )}
            </div>
          </div>

          {/* Result Display */}
          {submitted && result && (
            <div className="card p-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              {result.isCorrect ? (
                <div className="flex items-center gap-4 text-green-600 dark:text-green-400">
                  <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                    <CheckCircle2 size={32} />
                  </div>
                  <div>
                    <div className="text-lg font-bold">Correct!</div>
                    <div className="text-slate-600 dark:text-slate-400">You got it right.</div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-4 text-red-600 dark:text-red-400 mb-6">
                    <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                      <XCircle size={32} />
                    </div>
                    <div>
                      <div className="text-lg font-bold">Incorrect</div>
                      <div className="text-slate-600 dark:text-slate-400">Study this one carefully.</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        You said
                      </div>
                      <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl font-mono text-lg">
                        {result.diff.user.length > 0 ? result.diff.user.map((item, idx) => (
                          <span
                            key={idx}
                            className={
                              item.status === 'correct'
                                ? 'text-slate-400'
                                : 'text-red-600 font-bold bg-red-100 dark:bg-red-900/30 px-0.5 rounded'
                            }
                          >
                            {item.char}
                          </span>
                        )) : <span className="text-slate-400 italic">(empty)</span>}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Correct Answer
                      </div>
                      <div className="p-4 bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 rounded-xl font-mono text-lg">
                        {result.diff.correct.map((item, idx) => (
                          <span
                            key={idx}
                            className={
                              item.status === 'correct'
                                ? 'text-slate-800 dark:text-slate-200'
                                : 'text-green-600 font-bold'
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
      <div className="p-4 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="max-w-2xl mx-auto space-y-3">
          {!submitted ? (
            <div className="flex gap-3">
              <button
                onClick={handleSkip}
                className="px-6 py-4 rounded-xl border-2 border-gray-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                Don't know
              </button>
              <button
                onClick={handleCheckAnswer}
                disabled={!userAnswer.trim()}
                className="flex-1 btn-primary py-4 text-lg font-bold shadow-lg shadow-blue-500/20 disabled:shadow-none disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Check Answer
              </button>
            </div>
          ) : (
            <button
              onClick={handleContinue}
              className="w-full btn-primary py-4 text-lg font-bold shadow-lg shadow-blue-500/20 transition-all"
            >
              Continue <span className="ml-2 text-white/60 text-sm font-normal">(Enter)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default WritingPractice
