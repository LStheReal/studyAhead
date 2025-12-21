import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../services/api'
import { logStudyActivity } from '../../utils/tracking'
import { ArrowLeft, ChevronLeft, ChevronRight, RotateCcw, Shuffle, CheckCircle2, XCircle, RefreshCw } from 'lucide-react'

const LearnMode = () => {
  const { planId: paramPlanId, id: paramId } = useParams()
  const planId = paramPlanId || paramId
  const [searchParams] = useSearchParams()
  const taskId = searchParams.get('taskId')
  const navigate = useNavigate()

  const [flashcards, setFlashcards] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sideSwapped, setSideSwapped] = useState(false)
  const [vocabularySentences, setVocabularySentences] = useState({}) // flashcardId -> sentences

  // Status tracking
  const [cardStatus, setCardStatus] = useState({}) // flashcardId -> { known: false, attempts: 0 }
  const [isProcessing, setIsProcessing] = useState(false)
  const [completed, setCompleted] = useState(false)

  // Swipe state
  const [dragStart, setDragStart] = useState(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0, rotation: 0 })
  const cardRef = useRef(null)

  // Tracking
  const [startTime, setStartTime] = useState(Date.now())

  useEffect(() => {
    setStartTime(Date.now())
  }, [currentIndex])

  const fetchData = async () => {
    try {
      setLoading(true)
      // Fetch flashcards
      const response = await api.get(`/flashcards/study-plan/${planId}`)
      const cards = response.data

      if (Array.isArray(cards)) {
        setFlashcards(cards)

        // Initialize status for all cards
        const initialStatus = {}
        cards.forEach(card => {
          initialStatus[card.id] = { known: false, attempts: 0 }
        })
        setCardStatus(initialStatus)

        // Fetch vocabulary sentences for all cards (if needed, or fetch on demand)
        // For now, let's try to fetch them in batch or individually if the API supports it
        // Assuming we might need to fetch them one by one or they come with flashcards.
        // If they don't come with flashcards, we might need a separate call.
        // Based on previous context, let's assume we fetch them or they are part of the card data?
        // If not, we can fetch for the current card.
        // Let's check if we can fetch sentences.
        try {
          const sentencesRes = await api.get(`/flashcards/study-plan/${planId}/sentences`)
          // Store sentences grouped by flashcard ID
          if (sentencesRes.data) {
            setVocabularySentences(sentencesRes.data)
          }
        } catch (err) {
          console.log('Could not fetch vocabulary sentences batch', err)
        }
      }
    } catch (error) {
      console.error('Failed to fetch flashcards:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [planId])

  // Fetch sentences for current card if missing
  useEffect(() => {
    const currentCard = flashcards[currentIndex]
    if (currentCard && !vocabularySentences[currentCard.id]) {
      api.get(`/flashcards/${currentCard.id}/sentences`)
        .then(res => {
          setVocabularySentences(prev => ({
            ...prev,
            [currentCard.id]: res.data
          }))
        })
        .catch(err => console.log('No sentences found', err))
    }
  }, [currentIndex, flashcards])

  const currentCard = flashcards[currentIndex]
  const totalCards = Object.keys(cardStatus).length
  const knownCards = Object.values(cardStatus).filter(s => s.known).length
  const progress = totalCards > 0 ? (knownCards / totalCards) * 100 : 0

  // Swipe gesture handlers
  const handleTouchStart = (e) => {
    if (isProcessing || completed) return
    const touch = e.touches[0]
    setDragStart({ x: touch.clientX, y: touch.clientY })
  }

  const handleTouchMove = (e) => {
    if (!dragStart || isProcessing || completed) return
    const touch = e.touches[0]
    const deltaX = touch.clientX - dragStart.x
    const deltaY = touch.clientY - dragStart.y
    const rotation = deltaX * 0.1 // Rotate based on X movement

    setDragOffset({ x: deltaX, y: deltaY, rotation })
  }

  const handleTouchEnd = () => {
    if (!dragStart || isProcessing || completed) return

    if (dragOffset.x > 100) {
      handleSwipe('right')
    } else if (dragOffset.x < -100) {
      handleSwipe('left')
    } else {
      // Reset
      setDragOffset({ x: 0, y: 0, rotation: 0 })
    }
    setDragStart(null)
  }

  const handleMouseDown = (e) => {
    if (isProcessing || completed) return
    setDragStart({ x: e.clientX, y: e.clientY })
  }

  const handleMouseMove = (e) => {
    if (!dragStart || isProcessing || completed) return
    const deltaX = e.clientX - dragStart.x
    const deltaY = e.clientY - dragStart.y
    const rotation = deltaX * 0.1

    setDragOffset({ x: deltaX, y: deltaY, rotation })
  }

  const handleMouseUp = () => {
    if (!dragStart || isProcessing || completed) return

    if (dragOffset.x > 100) {
      handleSwipe('right')
    } else if (dragOffset.x < -100) {
      handleSwipe('left')
    } else {
      setDragOffset({ x: 0, y: 0, rotation: 0 })
    }
    setDragStart(null)
  }

  const handleSwipe = async (direction) => {
    if (!currentCard || isProcessing) return
    setIsProcessing(true)

    // Animate off screen
    const endX = direction === 'right' ? 1000 : -1000
    setDragOffset({ x: endX, y: 0, rotation: direction === 'right' ? 45 : -45 })

    setTimeout(async () => {
      const isKnown = direction === 'right'
      const cardId = currentCard.id

      // Update status
      setCardStatus(prev => ({
        ...prev,
        [cardId]: {
          known: isKnown,
          attempts: (prev[cardId]?.attempts || 0) + 1
        }
      }))

      // Log Tracking
      const responseTime = Date.now() - startTime
      logStudyActivity(planId, 'learn', cardId, isKnown, responseTime, (cardStatus[cardId]?.attempts || 0) + 1)

      // Update counters
      if (isKnown) {
        // Update mastery level
        try {
          const newMastery = Math.min(100, (currentCard.mastery_level || 0) + 10)
          await api.post(`/flashcards/${cardId}/update-mastery?mastery_level=${newMastery}`)
        } catch (error) {
          console.error('Failed to update mastery:', error)
        }

        // Remove card from deck
        const newCards = flashcards.filter((_, i) => i !== currentIndex)
        if (newCards.length === 0) {
          setCompleted(true)
          setIsProcessing(false)
          setDragOffset({ x: 0, y: 0, rotation: 0 })
          return
        }

        // Adjust index
        const newIndex = currentIndex >= newCards.length ? newCards.length - 1 : currentIndex
        setFlashcards(newCards)
        setCurrentIndex(newIndex)
      } else {
        // Re-insert card 3-5 positions ahead
        const insertPosition = currentIndex + Math.floor(Math.random() * 3) + 3
        const newCards = [...flashcards]
        // Remove current
        newCards.splice(currentIndex, 1)
        // Insert ahead (handling bounds)
        const realInsertPos = Math.min(insertPosition, newCards.length)
        newCards.splice(realInsertPos, 0, currentCard)

        setFlashcards(newCards)
        // If we inserted after current index, we stay at current index (which is now the next card)
        // If we inserted before (unlikely given logic), we'd need to adjust.
        // Since we removed current, the next card slides into currentIndex.
        // So we just keep currentIndex, unless it's out of bounds.
        if (currentIndex >= newCards.length) {
          setCurrentIndex(0)
        }
      }

      setFlipped(false)
      setDragOffset({ x: 0, y: 0, rotation: 0 })
      setIsProcessing(false)
    }, 300)
  }

  const handleFlip = () => {
    if (!dragStart) { // Only flip if not dragging
      setFlipped(!flipped)
    }
  }

  const handleNext = () => {
    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setFlipped(false)
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      setFlipped(false)
    }
  }

  const handleShuffle = () => {
    const shuffled = [...flashcards].sort(() => Math.random() - 0.5)
    setFlashcards(shuffled)
    setCurrentIndex(0)
    setFlipped(false)
  }

  const handleSwapSides = () => {
    setSideSwapped(!sideSwapped)
  }

  const handleRestart = () => {
    setLoading(true)
    fetchData()
    setCompleted(false)
    setFlipped(false)
    setCurrentIndex(0)
    setCardStatus({})
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (completed) return

      switch (e.code) {
        case 'Space':
          e.preventDefault()
          handleFlip()
          break
        case 'ArrowLeft':
          handleSwipe('left')
          break
        case 'ArrowRight':
          handleSwipe('right')
          break
        case 'ArrowUp':
        case 'ArrowDown':
          setFlipped(prev => !prev)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [completed, currentIndex, flashcards, isProcessing]) // Dependencies for closure

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (flashcards.length === 0 && !completed) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-50 dark:bg-slate-900 p-4">
        <div className="card text-center py-12 w-full max-w-md">
          <div className="text-slate-400 mb-4">
            <RefreshCw size={48} className="mx-auto" />
          </div>
          <h2 className="text-xl font-bold mb-2">No Flashcards Found</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            This study plan doesn't have any flashcards yet.
          </p>
          <button
            onClick={() => navigate(`/plans/${planId}`)}
            className="btn-primary"
          >
            Back to Plan
          </button>
        </div>
      </div>
    )
  }

  if (completed) {
    const firstTryCorrect = Object.values(cardStatus).filter(s => s.known && s.attempts === 1).length
    const retriesNeeded = Object.values(cardStatus).filter(s => s.attempts > 1).length
    const totalAttempts = Object.values(cardStatus).reduce((sum, s) => sum + s.attempts, 0)

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-50 dark:bg-slate-900 p-4">
        <div className="card text-center py-12 w-full max-w-md">
          <CheckCircle2 size={64} className="mx-auto mb-4 text-green-500" />
          <h2 className="text-2xl font-bold mb-2">All Cards Mastered!</h2>

          <div className="mt-6 space-y-2 text-left max-w-md mx-auto">
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Total cards reviewed:</span>
              <span className="font-medium">{totalCards}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Correct on first attempt:</span>
              <span className="font-medium text-green-600">{firstTryCorrect}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Cards that needed retry:</span>
              <span className="font-medium text-yellow-600">{retriesNeeded}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Total attempts:</span>
              <span className="font-medium">{totalAttempts}</span>
            </div>
          </div>

          <div className="flex gap-3 mt-8 justify-center">
            <button
              onClick={handleRestart}
              className="btn-secondary"
            >
              <RotateCcw size={20} className="inline mr-2" />
              Restart Session
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

  const displayFront = sideSwapped ? currentCard.back_text : currentCard.front_text
  const displayBack = sideSwapped ? currentCard.front_text : currentCard.back_text
  const sentences = vocabularySentences[currentCard.id] || []

  // Calculate drag styles
  const dragStyle = {
    transform: `translate(${dragOffset.x}px, ${dragOffset.y}px) rotate(${dragOffset.rotation}deg)`,
    transition: dragStart ? 'none' : 'transform 0.3s ease-out',
    boxShadow: dragOffset.x > 50
      ? '0 4px 20px rgba(34, 197, 94, 0.3)'
      : dragOffset.x < -50
        ? '0 4px 20px rgba(239, 68, 68, 0.3)'
        : '0 2px 8px rgba(0, 0, 0, 0.1)'
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50 dark:bg-slate-900 overflow-hidden h-[100dvh] w-full pb-24 pt-4">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm flex-shrink-0 z-10 relative">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => navigate(`/plans/${planId}`)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="flex items-center gap-3">
            <div className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {currentIndex + 1} / {totalCards}
            </div>

            <button
              onClick={handleSwapSides}
              className="px-2 py-1 text-xs btn-secondary flex items-center gap-1.5"
            >
              <span>{sideSwapped ? 'Answer' : 'Term'}</span>
              <RefreshCw size={12} />
            </button>

            <button
              onClick={handleShuffle}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              title="Shuffle"
            >
              <Shuffle size={18} />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Card Area */}
      <div
        className="flex-1 flex items-center justify-center p-2 overflow-hidden relative w-full"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          ref={cardRef}
          className={`w-full max-w-md aspect-[3/4] md:aspect-[4/3] perspective-1000 cursor-pointer ${flipped ? 'flipped' : ''}`}
          style={{ ...dragStyle, maxHeight: '60vh' }}
          onClick={handleFlip}
        >
          <div className="card-flip-inner w-full h-full relative transition-transform duration-500 transform-style-3d">
            {/* Front Side */}
            <div className="card-flip-front absolute inset-0 w-full h-full backface-hidden bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-700 flex flex-col items-center justify-center p-6 md:p-8">
              <div className="text-center w-full">
                <div className="text-2xl md:text-4xl font-bold text-slate-800 dark:text-white mb-4 leading-tight">
                  {displayFront}
                </div>
                <div className="text-xs text-slate-400 dark:text-slate-500 mt-6 font-medium uppercase tracking-wide">
                  Tap or Space to flip
                </div>
              </div>
            </div>

            {/* Back Side */}
            <div className="card-flip-back absolute inset-0 w-full h-full backface-hidden bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-700 flex flex-col items-center justify-center p-6 md:p-8 rotate-y-180 overflow-y-auto">
              <div className="text-center w-full">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  {displayFront}
                </div>
                <div className="text-2xl md:text-4xl font-bold text-blue-600 dark:text-blue-400 mb-4 leading-tight">
                  {displayBack}
                </div>

                {/* Vocabulary Sentences */}
                {sentences.length > 0 && (
                  <div className="mt-6 text-left bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Examples
                    </div>
                    <div className="space-y-2">
                      {sentences.slice(0, 2).map((sentence, idx) => (
                        <div key={idx} className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                          {sentence.highlighted_words && sentence.highlighted_words.length > 0 ? (
                            <span>
                              {sentence.sentence_text.substring(0, sentence.highlighted_words[0].start_index)}
                              <span className="font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1 rounded">
                                {sentence.sentence_text.substring(
                                  sentence.highlighted_words[0].start_index,
                                  sentence.highlighted_words[0].end_index
                                )}
                              </span>
                              {sentence.sentence_text.substring(sentence.highlighted_words[0].end_index)}
                            </span>
                          ) : (
                            sentence.sentence_text
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="p-4 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 flex-shrink-0 z-10 relative">
        <div className="max-w-md mx-auto flex gap-3">
          <button
            onClick={(e) => { e.stopPropagation(); handleSwipe('left'); }}
            className="flex-1 py-2.5 rounded-full border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 font-medium hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <XCircle size={18} />
            <span>Still learning</span>
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); handleSwipe('right'); }}
            className="flex-1 py-2.5 rounded-full border border-green-200 dark:border-green-900/30 text-green-600 dark:text-green-400 font-medium hover:bg-green-50 dark:hover:bg-green-900/10 transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <CheckCircle2 size={18} />
            <span>Know it</span>
          </button>
        </div>

        <div className="flex justify-center gap-8 mt-3 text-slate-400">
          <button onClick={handlePrevious} disabled={currentIndex === 0} className="hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-30 transition-colors">
            <ChevronLeft size={20} />
          </button>
          <button onClick={handleFlip} className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors" title="Spacebar">
            <RefreshCw size={16} />
          </button>
          <button onClick={handleNext} disabled={currentIndex === flashcards.length - 1} className="hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-30 transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default LearnMode

