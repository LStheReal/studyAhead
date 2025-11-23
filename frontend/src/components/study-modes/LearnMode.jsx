import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../services/api'
import { ArrowLeft, ChevronLeft, ChevronRight, RotateCcw, Shuffle, CheckCircle2, XCircle, RefreshCw } from 'lucide-react'

const LearnMode = () => {
  const { planId } = useParams()
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
  const [correctCount, setCorrectCount] = useState(0)
  const [incorrectCount, setIncorrectCount] = useState(0)
  const [completed, setCompleted] = useState(false)

  // Swipe gesture state
  const [dragStart, setDragStart] = useState(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0, rotation: 0 })
  const cardRef = useRef(null)

  useEffect(() => {
    fetchData()
  }, [planId])

  const fetchData = async () => {
    try {
      const [flashcardsRes, planRes] = await Promise.all([
        api.get(`/flashcards/study-plan/${planId}`),
        api.get(`/study-plans/${planId}`)
      ])

      let cards = flashcardsRes.data

      // Initialize status map
      const status = {}
      cards.forEach(card => {
        status[card.id] = { known: false, attempts: 0 }
      })
      setCardStatus(status)

      // Shuffle cards
      cards = [...cards].sort(() => Math.random() - 0.5)
      setFlashcards(cards)

      // Fetch vocabulary sentences for vocabulary plans
      if (planRes.data.category === 'vocabulary') {
        const sentencesMap = {}
        for (const card of cards) {
          try {
            const sentencesRes = await api.get(`/flashcards/${card.id}/sentences`)
            if (sentencesRes.data && sentencesRes.data.length > 0) {
              sentencesMap[card.id] = sentencesRes.data
            }
          } catch (error) {
            // No sentences available for this card
          }
        }
        setVocabularySentences(sentencesMap)
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  const currentCard = flashcards[currentIndex]
  const knownCards = Object.values(cardStatus).filter(s => s.known).length
  const totalCards = flashcards.length
  const progress = totalCards > 0 ? (knownCards / totalCards) * 100 : 0

  // Swipe gesture handlers
  const handleTouchStart = (e) => {
    const touch = e.touches[0]
    setDragStart({ x: touch.clientX, y: touch.clientY })
  }

  const handleTouchMove = (e) => {
    if (!dragStart) return
    const touch = e.touches[0]
    const deltaX = touch.clientX - dragStart.x
    const deltaY = touch.clientY - dragStart.y

    // Calculate rotation based on horizontal drag
    const rotation = deltaX * 0.1 // Max rotation ~10 degrees per 100px
    setDragOffset({ x: deltaX, y: deltaY, rotation })
  }

  const handleTouchEnd = () => {
    if (!dragStart) return

    const threshold = 100
    if (dragOffset.x > threshold) {
      handleSwipe('right')
    } else if (dragOffset.x < -threshold) {
      handleSwipe('left')
    }

    // Reset drag state
    setDragStart(null)
    setDragOffset({ x: 0, y: 0, rotation: 0 })
  }

  // Mouse handlers for desktop
  const handleMouseDown = (e) => {
    setDragStart({ x: e.clientX, y: e.clientY })
  }

  const handleMouseMove = (e) => {
    if (!dragStart) return
    const deltaX = e.clientX - dragStart.x
    const deltaY = e.clientY - dragStart.y
    const rotation = deltaX * 0.1
    setDragOffset({ x: deltaX, y: deltaY, rotation })
  }

  const handleMouseUp = () => {
    if (!dragStart) return

    const threshold = 100
    if (dragOffset.x > threshold) {
      handleSwipe('right')
    } else if (dragOffset.x < -threshold) {
      handleSwipe('left')
    }

    setDragStart(null)
    setDragOffset({ x: 0, y: 0, rotation: 0 })
  }

  const handleSwipe = async (direction) => {
    if (!currentCard) return

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

    // Update counters
    if (isKnown) {
      setCorrectCount(prev => prev + 1)

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
        return
      }

      // Adjust index
      const newIndex = currentIndex >= newCards.length ? newCards.length - 1 : currentIndex
      setFlashcards(newCards)
      setCurrentIndex(newIndex)
    } else {
      setIncorrectCount(prev => prev + 1)

      // Re-insert card 3-5 positions ahead
      const insertPosition = currentIndex + Math.floor(Math.random() * 3) + 3
      const newCards = [...flashcards]
      newCards.splice(insertPosition, 0, currentCard)
      setFlashcards(newCards)

      // Move to next card
      if (currentIndex < flashcards.length - 1) {
        setCurrentIndex(currentIndex + 1)
      } else {
        setCurrentIndex(0)
      }
    }

    setFlipped(false)
  }

  const handleFlip = () => {
    setFlipped(!flipped)
  }

  const handleSwapSides = () => {
    setSideSwapped(!sideSwapped)
    setFlipped(false)
  }

  const handleShuffle = () => {
    const shuffled = [...flashcards].sort(() => Math.random() - 0.5)
    setFlashcards(shuffled)
    setCurrentIndex(0)
    setFlipped(false)
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      setFlipped(false)
    }
  }

  const handleNext = () => {
    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setFlipped(false)
    }
  }

  const handleRestart = () => {
    // Reset all state
    const status = {}
    flashcards.forEach(card => {
      status[card.id] = { known: false, attempts: 0 }
    })
    setCardStatus(status)
    setCorrectCount(0)
    setIncorrectCount(0)
    setCompleted(false)
    setFlipped(false)
    setCurrentIndex(0)
    // Reshuffle
    const shuffled = [...flashcards].sort(() => Math.random() - 0.5)
    setFlashcards(shuffled)
  }

  // Check completion
  useEffect(() => {
    if (totalCards > 0 && knownCards === totalCards) {
      setCompleted(true)
    }
  }, [knownCards, totalCards])

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
    return (
      <div className="p-4">
        <div className="card text-center py-12">
          <CheckCircle2 size={64} className="mx-auto mb-4 text-green-500" />
          <h2 className="text-2xl font-bold mb-2">All Cards Mastered!</h2>

          <div className="mt-6 space-y-2 text-left max-w-md mx-auto">
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Total cards reviewed:</span>
              <span className="font-medium">{totalCards}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Correct on first attempt:</span>
              <span className="font-medium text-green-600">{correctCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Cards that needed retry:</span>
              <span className="font-medium text-yellow-600">{incorrectCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Total attempts:</span>
              <span className="font-medium">
                {Object.values(cardStatus).reduce((sum, s) => sum + s.attempts, 0)}
              </span>
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
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => navigate(`/plans/${planId}`)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} />
          </button>

          <div className="flex items-center gap-4">
            <div className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {currentIndex + 1} / {totalCards}
            </div>

            <button
              onClick={handleSwapSides}
              className="px-3 py-1 text-sm btn-secondary flex items-center gap-2"
            >
              <span>{sideSwapped ? 'Answer' : 'Term'}</span>
              <RefreshCw size={14} />
            </button>

            <button
              onClick={handleShuffle}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              title="Shuffle"
            >
              <Shuffle size={20} />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-slate-500 font-medium">
          <span>{knownCards} mastered</span>
          <span>{totalCards - knownCards} remaining</span>
        </div>
      </div>

      {/* Card Area */}
      <div
        className="flex-1 flex items-center justify-center p-4 overflow-hidden"
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
          style={dragStyle}
          onClick={handleFlip}
        >
          <div className="card-flip-inner w-full h-full relative transition-transform duration-500 transform-style-3d">
            {/* Front Side */}
            <div className="card-flip-front absolute inset-0 w-full h-full backface-hidden bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-700 flex flex-col items-center justify-center p-8">
              <div className="text-center w-full">
                <div className="text-3xl md:text-4xl font-bold text-slate-800 dark:text-white mb-4 leading-tight">
                  {displayFront}
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400 mt-8 font-medium uppercase tracking-wide">
                  Tap to flip
                </div>
              </div>
            </div>

            {/* Back Side */}
            <div className="card-flip-back absolute inset-0 w-full h-full backface-hidden bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-700 flex flex-col items-center justify-center p-8 rotate-y-180 overflow-y-auto">
              <div className="text-center w-full">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                  {displayFront}
                </div>
                <div className="text-3xl md:text-4xl font-bold text-blue-600 dark:text-blue-400 mb-6 leading-tight">
                  {displayBack}
                </div>

                {/* Vocabulary Sentences */}
                {sentences.length > 0 && (
                  <div className="mt-8 text-left bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                      Examples
                    </div>
                    <div className="space-y-3">
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
      <div className="p-6 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700">
        <div className="max-w-md mx-auto flex gap-4">
          <button
            onClick={(e) => { e.stopPropagation(); handleSwipe('left'); }}
            className="flex-1 py-4 rounded-xl border-2 border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 font-bold hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors flex flex-col items-center justify-center gap-1"
          >
            <XCircle size={24} />
            <span>Still learning</span>
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); handleSwipe('right'); }}
            className="flex-1 py-4 rounded-xl bg-green-500 text-white font-bold hover:bg-green-600 transition-colors shadow-lg shadow-green-500/30 flex flex-col items-center justify-center gap-1"
          >
            <CheckCircle2 size={24} />
            <span>Know it</span>
          </button>
        </div>

        <div className="flex justify-center gap-8 mt-6 text-slate-400">
          <button onClick={handlePrevious} disabled={currentIndex === 0} className="hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-30 transition-colors">
            <ChevronLeft size={24} />
          </button>
          <button onClick={handleFlip} className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <RefreshCw size={20} />
          </button>
          <button onClick={handleNext} disabled={currentIndex === flashcards.length - 1} className="hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-30 transition-colors">
            <ChevronRight size={24} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default LearnMode

