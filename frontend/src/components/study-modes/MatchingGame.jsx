import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../services/api'
import { ArrowLeft, Timer, RotateCcw, Trophy } from 'lucide-react'

const MatchingGame = () => {
  const { planId } = useParams()
  const [searchParams] = useSearchParams()
  const testMode = searchParams.get('testMode') === 'true'
  const navigate = useNavigate()

  // Game State
  const [queue, setQueue] = useState([]) // For UI and completion check
  const queueRef = useRef([]) // For logic (source of truth to avoid race conditions)
  const retryQueueRef = useRef([]) // Pairs that were matched wrong - go to end of queue
  const flashcardsMapRef = useRef({}) // Store flashcard data by pairId for retry
  // Columns now hold "slots". Each slot is an object or null.
  // To ensure stability, we initialize with placeholders if needed.
  const [leftSlots, setLeftSlots] = useState([])
  const [rightSlots, setRightSlots] = useState([])

  const [selectedCard, setSelectedCard] = useState(null)
  const [failedPairIds, setFailedPairIds] = useState(new Set())
  const [masteredCount, setMasteredCount] = useState(0)
  const [totalPairs, setTotalPairs] = useState(0)

  const [loading, setLoading] = useState(true)
  const [completed, setCompleted] = useState(false)

  // Timer state
  const [startTime, setStartTime] = useState(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const timerRef = useRef(null)

  // Constants
  const BOARD_SIZE = 5 // Number of pairs on board at once (batches of 5)
  const REFILL_THRESHOLD = 5 // Wait for ALL 5 slots to be empty before refilling

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
    const shuffledPairs = [...flashcards].sort(() => Math.random() - 0.5)
    setTotalPairs(shuffledPairs.length)

    // Store flashcard data for retry logic
    const flashcardsMap = {}
    shuffledPairs.forEach(fc => {
      flashcardsMap[fc.id] = fc
    })
    flashcardsMapRef.current = flashcardsMap

    // We need to fill slots initially.
    // If fewer pairs than BOARD_SIZE, we just fill what we can.
    const initialBoardPairs = shuffledPairs.slice(0, BOARD_SIZE)
    const remainingQueue = shuffledPairs.slice(BOARD_SIZE)

    // Create initial items
    const leftItems = initialBoardPairs.map(p => ({
      id: `term-${p.id}`,
      text: p.front_text,
      pairId: p.id,
      type: 'term',
      state: 'default'
    }))

    const rightItems = initialBoardPairs.map(p => ({
      id: `def-${p.id}`,
      text: p.back_text,
      pairId: p.id,
      type: 'def',
      state: 'default'
    }))

    // Shuffle positions for the slots
    // We want the slots to be random, so Term A is in slot 0, but Def A might be in slot 3.
    // But we need to track which slot holds which card.

    // Helper to pad with nulls if not enough items
    const padSlots = (items) => {
      const slots = [...items]
      while (slots.length < BOARD_SIZE) {
        slots.push(null)
      }
      return slots.sort(() => Math.random() - 0.5)
    }

    setLeftSlots(padSlots(leftItems))
    setRightSlots(padSlots(rightItems))

    setQueue(remainingQueue)
    queueRef.current = remainingQueue
    retryQueueRef.current = []
    setFailedPairIds(new Set())
    setMasteredCount(0)
    setSelectedCard(null)
    setCompleted(false)
    setElapsedTime(0)
    setStartTime(Date.now())
    setTimerRunning(true)
  }

  const handleCardClick = (card, colType, slotIndex) => {
    if (completed || !card || card.state !== 'default') return

    // If clicking the already selected card, deselect it
    if (selectedCard?.id === card.id) {
      setSelectedCard(null)
      updateSlotState(colType, slotIndex, 'default')
      return
    }

    // If no card selected, select this one
    if (!selectedCard) {
      setSelectedCard({ ...card, colType, slotIndex }) // Store location
      updateSlotState(colType, slotIndex, 'selected')
      return
    }

    // If clicking a card of the same type, switch selection
    if (selectedCard.type === card.type) {
      // Deselect previous
      updateSlotState(selectedCard.colType, selectedCard.slotIndex, 'default')
      // Select new
      setSelectedCard({ ...card, colType, slotIndex })
      updateSlotState(colType, slotIndex, 'selected')
      return
    }

    // Two different cards selected - check match
    checkMatch(selectedCard, { ...card, colType, slotIndex })
  }

  const updateSlotState = (colType, slotIndex, state) => {
    if (colType === 'left') {
      setLeftSlots(prev => prev.map((item, i) => i === slotIndex && item ? { ...item, state } : item))
    } else {
      setRightSlots(prev => prev.map((item, i) => i === slotIndex && item ? { ...item, state } : item))
    }
  }

  const checkMatch = (card1, card2) => {
    const isMatch = card1.pairId === card2.pairId

    if (isMatch) {
      handleCorrectMatch(card1, card2)
    } else {
      handleWrongMatch(card1, card2)
    }
  }

  const handleCorrectMatch = (card1, card2) => {
    const pairId = card1.pairId
    const isRetry = failedPairIds.has(pairId)
    const matchState = isRetry ? 'matched-retry' : 'matched-first'

    updateSlotState(card1.colType, card1.slotIndex, matchState)
    updateSlotState(card2.colType, card2.slotIndex, matchState)
    setSelectedCard(null)

    setTimeout(() => {
      // Always count as mastered when matched correctly
      // Even if it was wrong before, getting it right means it's learned
      setMasteredCount(prev => prev + 1)

      // Clear the matched slots
      setLeftSlots(prev => prev.map((item, i) =>
        (i === card1.slotIndex && card1.colType === 'left') || (i === card2.slotIndex && card2.colType === 'left')
          ? null
          : item
      ))
      setRightSlots(prev => prev.map((item, i) =>
        (i === card1.slotIndex && card1.colType === 'right') || (i === card2.slotIndex && card2.colType === 'right')
          ? null
          : item
      ))

      // Check if we should refill
      // We need to check the state AFTER clearing. 
      // Since setState is async, we can't rely on leftSlots immediately.
      // But we know we just cleared 1 slot in each column.
      // So we can check the previous state or just pass a callback.
      // Better: Use a separate effect or just check inside the setState callback? 
      // No, let's just trigger a check function.
      // We can pass the *current* state of slots to the check function by using the functional update pattern, 
      // but that's tricky for triggering side effects.
      // Instead, let's just assume we cleared them and check the *count* of nulls.
      // We can count nulls in the *current* render cycle + 1 (the one we just made null).

      // Actually, simpler: Just call batchRefill. It will check the slots.
      // But batchRefill needs the updated state.
      // So we'll use a useEffect to trigger refill if threshold is met.
      // OR, we can pass the "next" state to batchRefill.

      // Let's use a small timeout or just rely on the next render cycle?
      // No, we want it to feel responsive.
      // Let's force the refill logic to run after state update.
      // We can use a useEffect on [leftSlots, rightSlots].

    }, 1000) // Increased delay to 1s so user sees the color
  }

  // Effect to handle batch refilling
  useEffect(() => {
    if (loading || completed) return

    const emptyLeftCount = leftSlots.filter(s => s === null).length
    // const emptyRightCount = rightSlots.filter(s => s === null).length // Should be same

    // Refill if:
    // 1. Empty slots >= Threshold
    // 2. OR Queue is empty (and we have empty slots) -> Wait, if queue is empty we can't refill.
    //    But if queue has items and we have empty slots, we should refill eventually.
    //    If queue is empty, we just wait for user to clear board.
    // 3. OR Board is empty (e.g. 5 matches made, threshold might be 3, but if we cleared all 5 fast?)
    //    Actually if emptyLeftCount >= REFILL_THRESHOLD, we refill.

    // Also check if we have items in queue to refill with (including retry queue).
    const hasItemsToRefill = queueRef.current.length > 0 || retryQueueRef.current.length > 0
    if (hasItemsToRefill && emptyLeftCount >= REFILL_THRESHOLD) {
      batchRefill()
    } else if (hasItemsToRefill && emptyLeftCount === BOARD_SIZE) {
      // Special case: if board is completely empty but threshold wasn't triggered
      batchRefill()
    }
  }, [leftSlots, rightSlots, completed, loading])

  const batchRefill = () => {
    // Find empty indices
    const emptyLeftIndices = leftSlots.map((item, i) => item === null ? i : -1).filter(i => i !== -1)
    const emptyRightIndices = rightSlots.map((item, i) => item === null ? i : -1).filter(i => i !== -1)

    if (emptyLeftIndices.length === 0) return

    // Prioritize retry queue, then regular queue
    const availablePairs = [...retryQueueRef.current, ...queueRef.current]
    const countToRefill = Math.min(emptyLeftIndices.length, availablePairs.length)
    if (countToRefill === 0) return

    // Get pairs (retry queue first)
    const newPairs = []
    for (let i = 0; i < countToRefill; i++) {
      if (retryQueueRef.current.length > 0) {
        newPairs.push(retryQueueRef.current.shift())
      } else {
        newPairs.push(queueRef.current.shift())
      }
    }
    setQueue([...queueRef.current]) // Sync UI queue

    // Create cards
    const newTerms = newPairs.map(p => ({
      id: `term-${p.id}-${Date.now()}`,
      text: p.front_text,
      pairId: p.id,
      type: 'term',
      state: 'default'
    }))

    const newDefs = newPairs.map(p => ({
      id: `def-${p.id}-${Date.now()}`,
      text: p.back_text,
      pairId: p.id,
      type: 'def',
      state: 'default'
    }))

    // Shuffle assignments
    const shuffledTerms = [...newTerms].sort(() => Math.random() - 0.5)
    const shuffledDefs = [...newDefs].sort(() => Math.random() - 0.5)

    setLeftSlots(prev => {
      const next = [...prev]
      for (let i = 0; i < countToRefill; i++) {
        const slotIndex = emptyLeftIndices[i]
        next[slotIndex] = shuffledTerms[i]
      }
      return next
    })

    setRightSlots(prev => {
      const next = [...prev]
      for (let i = 0; i < countToRefill; i++) {
        const slotIndex = emptyRightIndices[i]
        next[slotIndex] = shuffledDefs[i]
      }
      return next
    })
  }

  const handleWrongMatch = (card1, card2) => {
    updateSlotState(card1.colType, card1.slotIndex, 'wrong')
    updateSlotState(card2.colType, card2.slotIndex, 'wrong')

    const pairId = card1.pairId
    setFailedPairIds(prev => {
      const newSet = new Set(prev)
      newSet.add(pairId)
      return newSet
    })

    // Add this pair to retry queue (will appear in next batch)
    const flashcard = flashcardsMapRef.current[pairId]
    if (flashcard && !retryQueueRef.current.find(fc => fc.id === pairId)) {
      retryQueueRef.current.push(flashcard)
    }

    setTimeout(() => {
      updateSlotState(card1.colType, card1.slotIndex, 'default')
      updateSlotState(card2.colType, card2.slotIndex, 'default')
      setSelectedCard(null)
    }, 1000)
  }


  useEffect(() => {
    // Check completion
    // Completed if queue is empty AND all slots are empty AND we have mastered some pairs
    const allLeftEmpty = leftSlots.every(s => s === null)
    const allRightEmpty = rightSlots.every(s => s === null)

    if (queue.length === 0 && allLeftEmpty && allRightEmpty && masteredCount > 0) {
      handleGameComplete()
    }
  }, [queue.length, leftSlots, rightSlots, masteredCount])

  const handleGameComplete = () => {
    stopTimer()
    setCompleted(true)
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
              <span className="text-slate-600 dark:text-slate-400">Total Pairs:</span>
              <span className="font-medium">{totalPairs}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Retries needed:</span>
              <span className="font-medium">{failedPairIds.size}</span>
            </div>
          </div>

          <div className="flex gap-3 mt-8 justify-center">
            <button onClick={handleRestart} className="btn-secondary">
              <RotateCcw size={20} className="inline mr-2" />
              Play Again
            </button>
            {testMode ? (
              <button
                onClick={() => {
                  if (window.testFlowCallback) {
                    window.testFlowCallback({ mode: 'match', results: { time: elapsedTime } })
                  }
                }}
                className="btn-primary"
              >
                Continue to Next Phase
              </button>
            ) : (
              <button onClick={() => navigate(`/plans/${planId}`)} className="btn-primary">
                Back to Overview
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50 dark:bg-slate-900 overflow-hidden h-[100dvh] w-full pb-24 pt-4">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
        <div className="flex items-center justify-between max-w-4xl mx-auto w-full">
          <button
            onClick={() => navigate(`/plans/${planId}`)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} />
          </button>

          <div className="flex items-center gap-2 font-mono text-xl font-bold text-slate-700 dark:text-slate-200 bg-gray-100 dark:bg-slate-700 px-4 py-2 rounded-lg">
            <Trophy size={20} className="text-yellow-500" />
            {masteredCount} / {totalPairs}
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
        <div className="max-w-4xl mx-auto grid grid-cols-2 gap-4 md:gap-8 h-full content-start">
          {/* Left Column - Terms */}
          <div className="space-y-3">
            {leftSlots.map((card, index) => (
              <div key={`left-${index}`} className="h-[80px]">
                {card && (
                  <Card
                    card={card}
                    onClick={() => handleCardClick(card, 'left', index)}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Right Column - Definitions */}
          <div className="space-y-3">
            {rightSlots.map((card, index) => (
              <div key={`right-${index}`} className="h-[80px]">
                {card && (
                  <Card
                    card={card}
                    onClick={() => handleCardClick(card, 'right', index)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const Card = ({ card, onClick }) => {
  let cardClass = "w-full h-full p-4 rounded-xl flex items-center justify-center text-center cursor-pointer transition-all duration-200 shadow-sm border-2 select-none text-sm md:text-base font-medium"

  if (card.state === 'matched-first') {
    cardClass += " bg-green-100 dark:bg-green-900/30 border-green-500 text-green-700 dark:text-green-300 transform scale-95"
  } else if (card.state === 'matched-retry') {
    cardClass += " bg-yellow-100 dark:bg-yellow-900/30 border-yellow-500 text-yellow-700 dark:text-yellow-300 transform scale-95"
  } else if (card.state === 'selected') {
    // Blue border only, no background change (or very subtle)
    cardClass += " border-blue-500 border-2 shadow-md transform -translate-y-1"
  } else if (card.state === 'wrong') {
    cardClass += " bg-red-100 dark:bg-red-900/30 border-red-500 text-red-700 dark:text-red-300 animate-shake"
  } else {
    cardClass += " bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5 text-slate-700 dark:text-slate-200"
  }

  return (
    <div
      className={cardClass}
      onClick={onClick}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      {card.text}
    </div>
  )
}

export default MatchingGame
