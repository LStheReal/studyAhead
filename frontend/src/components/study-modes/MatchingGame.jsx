import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../services/api'
import { ArrowLeft, Timer, RotateCcw, Trophy, Maximize2, Minimize2 } from 'lucide-react'

const MatchingGame = () => {
  const { planId } = useParams()
  const [searchParams] = useSearchParams()
  const taskId = searchParams.get('taskId')
  const testMode = searchParams.get('testMode') === 'true'
  const navigate = useNavigate()

  const [cards, setCards] = useState([]) // [{ id, text, type: 'term'|'def', pairId, state: 'default'|'selected'|'matched'|'wrong' }]
  const [selectedCards, setSelectedCards] = useState([])
  const [matchedPairs, setMatchedPairs] = useState([])
  const [loading, setLoading] = useState(true)
  const [completed, setCompleted] = useState(false)

  // Timer state
  const [startTime, setStartTime] = useState(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const timerRef = useRef(null)

  // Game stats
  const [attempts, setAttempts] = useState(0)
  const [bestTime, setBestTime] = useState(null)

  useEffect(() => {
    fetchData()
    return () => stopTimer()
  }, [planId])

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setElapsedTime(Date.now() - startTime)
      }, 100)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [timerRunning, startTime])

  const fetchData = async () => {
    try {
      const response = await api.get(`/flashcards/study-plan/${planId}`)
      initializeGame(response.data)
    } catch (error) {
      console.error('Failed to fetch flashcards:', error)
    } finally {
      setLoading(false)
    }
  }

  const initializeGame = (flashcards) => {
    // Take up to 8 pairs for the grid (16 cards total)
    const gamePairs = flashcards.slice(0, 8)

    const gameCards = []
    gamePairs.forEach(pair => {
      gameCards.push({
        id: `term-${pair.id}`,
        text: pair.front_text,
        type: 'term',
        pairId: pair.id,
        state: 'default'
      })
      gameCards.push({
        id: `def-${pair.id}`,
        text: pair.back_text,
        type: 'def',
        pairId: pair.id,
        state: 'default'
      })
    })

    // Shuffle cards
    const shuffled = gameCards.sort(() => Math.random() - 0.5)

    setCards(shuffled)
    setMatchedPairs([])
    setSelectedCards([])
    setAttempts(0)
    setCompleted(false)
    setElapsedTime(0)
    setStartTime(Date.now())
    setTimerRunning(true)
  }

  const handleCardClick = (card) => {
    if (
      completed ||
      card.state === 'matched' ||
      selectedCards.find(c => c.id === card.id) ||
      selectedCards.length >= 2
    ) return

    const newSelected = [...selectedCards, card]
    setSelectedCards(newSelected)

    // Update card state visually
    setCards(prev => prev.map(c =>
      c.id === card.id ? { ...c, state: 'selected' } : c
    ))

    if (newSelected.length === 2) {
      setAttempts(prev => prev + 1)
      checkMatch(newSelected)
    }
  }

  const checkMatch = (selection) => {
    const [card1, card2] = selection
    const isMatch = card1.pairId === card2.pairId

    if (isMatch) {
      // Handle correct match
      setTimeout(() => {
        setCards(prev => prev.map(c =>
          c.id === card1.id || c.id === card2.id
            ? { ...c, state: 'matched' }
            : c
        ))
        setMatchedPairs(prev => [...prev, card1.pairId])
        setSelectedCards([])

        // Check win condition
        if (matchedPairs.length + 1 === cards.length / 2) {
          handleGameComplete()
        }
      }, 300)
    } else {
      // Handle mismatch
      // Show error state briefly
      setCards(prev => prev.map(c =>
        c.id === card1.id || c.id === card2.id
          ? { ...c, state: 'wrong' }
          : c
      ))

      setTimeout(() => {
        setCards(prev => prev.map(c =>
          c.id === card1.id || c.id === card2.id
            ? { ...c, state: 'default' }
            : c
        ))
        setSelectedCards([])
      }, 1000)
    }
  }

  const handleGameComplete = () => {
    stopTimer()
    setCompleted(true)

    // Save score if needed
    if (testMode) {
      // In test mode, we might want to track time taken
    }
  }

  const stopTimer = () => {
    setTimerRunning(false)
    clearInterval(timerRef.current)
  }

  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const handleRestart = () => {
    setLoading(true)
    fetchData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (completed) {
    return (
      <div className="p-4">
        <div className="card text-center py-12">
          <Trophy size={64} className="mx-auto mb-4 text-yellow-500" />
          <h2 className="text-2xl font-bold mb-2">Great Job!</h2>
          <div className="text-4xl font-bold text-slate-800 dark:text-white mb-6">
            {formatTime(elapsedTime)}
          </div>

          <div className="mt-6 space-y-2 text-left max-w-md mx-auto">
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Pairs matched:</span>
              <span className="font-medium">{cards.length / 2}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Attempts needed:</span>
              <span className="font-medium">{attempts}</span>
            </div>
          </div>

          <div className="flex gap-3 mt-8 justify-center">
            <button
              onClick={handleRestart}
              className="btn-secondary"
            >
              <RotateCcw size={20} className="inline mr-2" />
              Play Again
            </button>
            {testMode ? (
              <button
                onClick={() => {
                  if (window.testFlowCallback) {
                    window.testFlowCallback({ mode: 'match', results: { time: elapsedTime, attempts } })
                  }
                }}
                className="btn-primary"
              >
                Continue to Next Phase
              </button>
            ) : (
              <button
                onClick={() => navigate(`/plans/${planId}`)}
                className="btn-primary"
              >
                Back to Overview
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(`/plans/${planId}`)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} />
          </button>

          <div className="flex items-center gap-2 font-mono text-xl font-bold text-slate-700 dark:text-slate-200 bg-gray-100 dark:bg-slate-700 px-4 py-2 rounded-lg">
            <Timer size={20} className="text-blue-500" />
            {formatTime(elapsedTime)}
          </div>

          <button
            onClick={handleRestart}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            title="Restart"
          >
            <RotateCcw size={20} />
          </button>
        </div>
      </div>

      {/* Game Grid */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {cards.map((card) => {
            let cardClass = "aspect-[4/3] p-4 rounded-xl flex items-center justify-center text-center cursor-pointer transition-all duration-200 shadow-sm border-2 select-none text-sm md:text-base font-medium"

            if (card.state === 'matched') {
              cardClass += " opacity-0 pointer-events-none transform scale-90"
            } else if (card.state === 'selected') {
              cardClass += " bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300 shadow-md transform -translate-y-1"
            } else if (card.state === 'wrong') {
              cardClass += " bg-red-50 dark:bg-red-900/30 border-red-500 text-red-700 dark:text-red-300 animate-shake"
            } else {
              cardClass += " bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5 text-slate-700 dark:text-slate-200"
            }

            return (
              <div
                key={card.id}
                className={cardClass}
                onClick={() => handleCardClick(card)}
              >
                {card.text}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default MatchingGame
