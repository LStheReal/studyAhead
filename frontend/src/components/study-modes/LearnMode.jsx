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
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => navigate(`/plans/${planId}`)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
          >
            <ArrowLeft size={24} />
          </button>
          
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <span className="font-medium">Card {currentIndex + 1} / {totalCards}</span>
            </div>
            
            <button
              onClick={handleSwapSides}
              className="px-3 py-1 text-sm btn-secondary"
            >
              {sideSwapped ? 'Q: Answer' : 'Q: Question'} ↔️
            </button>
            
            <button
              onClick={handleShuffle}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
              title="Shuffle"
            >
              <Shuffle size={20} />
            </button>
          </div>
        </div>
        
        {/* Progress Ring */}
        <div className="flex items-center justify-center gap-4">
          <div className="relative w-16 h-16">
            <svg className="transform -rotate-90 w-16 h-16">
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                className="text-gray-200 dark:text-slate-700"
              />
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 28}`}
                strokeDashoffset={`${2 * Math.PI * 28 * (1 - progress / 100)}`}
                className="text-blue-500 transition-all duration-300"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-medium">{Math.round(progress)}%</span>
            </div>
          </div>
          <div className="text-sm">
            <div className="font-medium">{knownCards} / {totalCards} mastered</div>
            <div className="flex gap-4 mt-1">
              <span className="text-green-600 dark:text-green-400">✓ {correctCount}</span>
              <span className="text-red-600 dark:text-red-400">✗ {incorrectCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Card Area */}
      <div 
        className="flex-1 flex items-center justify-center p-4"
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
          className={`w-full max-w-md ${flipped ? 'flipped' : ''}`}
          style={dragStyle}
        >
          <div className="card-flip">
            <div className="card-flip-inner">
              {/* Front Side */}
              <div className="card-flip-front">
                <div 
                  className="card h-96 flex flex-col items-center justify-center cursor-pointer"
                  onClick={handleFlip}
                >
                  <div className="text-center p-6 w-full">
                    <div className="text-3xl font-semibold mb-4">{displayFront}</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400 mt-8">
                      Tap to reveal answer
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Back Side */}
              <div className="card-flip-back">
                <div 
                  className="card h-96 flex flex-col items-center justify-center cursor-pointer bg-blue-50 dark:bg-blue-900/20 overflow-y-auto"
                  onClick={handleFlip}
                >
                  <div className="text-center p-6 w-full">
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                      {displayFront}
                    </div>
                    <div className="text-3xl font-semibold mb-4 text-blue-600 dark:text-blue-400">
                      {displayBack}
                    </div>
                    
                    {/* Vocabulary Sentences (only for vocabulary category) */}
                    {sentences.length > 0 && (
                      <div className="mt-6 text-left">
                        <div className="text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
                          Example Sentences:
                        </div>
                        {sentences.slice(0, 3).map((sentence, idx) => (
                          <div key={idx} className="text-sm text-slate-600 dark:text-slate-400 mb-2 p-2 bg-white dark:bg-slate-800 rounded">
                            {sentence.highlighted_words && sentence.highlighted_words.length > 0 ? (
                              <span>
                                {sentence.sentence_text.substring(0, sentence.highlighted_words[0].start_index)}
                                <span className="font-bold bg-yellow-200 dark:bg-yellow-800 px-1 rounded">
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
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="p-4 border-t border-gray-200 dark:border-slate-700 space-y-4">
        {/* Navigation */}
        <div className="flex gap-2">
          <button
            onClick={handlePrevious}
            disabled={currentIndex === 0 || flashcards.length === 1}
            className="flex-1 btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={20} className="inline mr-1" />
            Previous
          </button>
          <button
            onClick={handleFlip}
            className="flex-1 btn-secondary"
          >
            {flipped ? 'Show Question' : 'Flip Card'}
          </button>
          <button
            onClick={handleNext}
            disabled={currentIndex === flashcards.length - 1 || flashcards.length === 1}
            className="flex-1 btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight size={20} className="inline ml-1" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => handleSwipe('left')}
            className="flex-1 btn-secondary text-red-600 dark:text-red-400 border-red-300 dark:border-red-700"
          >
            <XCircle size={20} className="inline mr-2" />
            Need Practice
          </button>
          <button
            onClick={() => handleSwipe('right')}
            className="flex-1 btn-primary"
          >
            <CheckCircle2 size={20} className="inline mr-2" />
            I Know This
          </button>
        </div>
      </div>
    </div>
  )
}

export default LearnMode

