import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { ArrowLeft, RotateCcw, Shuffle, CheckCircle2, XCircle } from 'lucide-react'

const StudyMode = () => {
  const { planId, mode } = useParams()
  const navigate = useNavigate()
  const [flashcards, setFlashcards] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [results, setResults] = useState({ correct: 0, incorrect: 0 })
  const [completed, setCompleted] = useState(false)

  useEffect(() => {
    fetchFlashcards()
  }, [planId])

  const fetchFlashcards = async () => {
    try {
      const response = await api.get(`/flashcards/study-plan/${planId}`)
      let cards = response.data
      
      // Shuffle for learn mode
      if (mode === 'learn') {
        cards = [...cards].sort(() => Math.random() - 0.5)
      }
      
      setFlashcards(cards)
    } catch (error) {
      console.error('Failed to fetch flashcards:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFlip = () => {
    setFlipped(!flipped)
  }

  const handleSwipe = async (direction) => {
    const currentCard = flashcards[currentIndex]
    const isCorrect = direction === 'right'
    
    // Update mastery
    const newMastery = isCorrect
      ? Math.min(100, (currentCard.mastery_level || 0) + 10)
      : Math.max(0, (currentCard.mastery_level || 0) - 5)
    
    try {
      await api.post(`/flashcards/${currentCard.id}/update-mastery?mastery_level=${newMastery}`)
    } catch (error) {
      console.error('Failed to update mastery:', error)
    }

    // Update results
    setResults({
      correct: results.correct + (isCorrect ? 1 : 0),
      incorrect: results.incorrect + (isCorrect ? 0 : 1),
    })

    // Move to next card or remove if correct
    if (isCorrect) {
      const newCards = flashcards.filter((_, i) => i !== currentIndex)
      if (newCards.length === 0) {
        setCompleted(true)
      } else {
        setFlashcards(newCards)
        setCurrentIndex(Math.min(currentIndex, newCards.length - 1))
      }
    } else {
      // Move to next, but card stays in deck
      if (currentIndex < flashcards.length - 1) {
        setCurrentIndex(currentIndex + 1)
      } else {
        setCurrentIndex(0)
      }
    }
    setFlipped(false)
  }

  const handleShuffle = () => {
    const shuffled = [...flashcards].sort(() => Math.random() - 0.5)
    setFlashcards(shuffled)
    setCurrentIndex(0)
  }

  const handleSwap = () => {
    const updated = flashcards.map((card, i) => {
      if (i === currentIndex) {
        return { ...card, front_text: card.back_text, back_text: card.front_text }
      }
      return card
    })
    setFlashcards(updated)
    setFlipped(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (flashcards.length === 0 || completed) {
    return (
      <div className="p-4">
        <div className="card text-center py-12">
          <CheckCircle2 size={64} className="mx-auto mb-4 text-green-500" />
          <h2 className="text-2xl font-bold mb-2">Session Complete!</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            You got {results.correct} correct and {results.incorrect} incorrect
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

  const currentCard = flashcards[currentIndex]
  const progress = ((currentIndex + 1) / flashcards.length) * 100

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
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {currentIndex + 1} / {flashcards.length}
          </div>
          <div className="w-8" /> {/* Spacer */}
        </div>
        <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Card Area */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div
          className={`card-flip w-full max-w-md ${flipped ? 'flipped' : ''}`}
          onClick={handleFlip}
        >
          <div className="card-flip-inner">
            <div className="card-flip-front">
              <div className="card h-64 flex items-center justify-center cursor-pointer">
                <div className="text-center p-6">
                  <div className="text-2xl font-semibold mb-4">{currentCard.front_text}</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Tap to reveal answer
                  </div>
                </div>
              </div>
            </div>
            <div className="card-flip-back">
              <div className="card h-64 flex items-center justify-center cursor-pointer bg-blue-50 dark:bg-blue-900/20">
                <div className="text-center p-6">
                  <div className="text-2xl font-semibold mb-4">{currentCard.back_text}</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Swipe to rate
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="p-4 border-t border-gray-200 dark:border-slate-700 space-y-4">
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

        {/* Utility Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleSwap}
            className="flex-1 btn-secondary text-sm"
          >
            Swap Sides
          </button>
          <button
            onClick={handleShuffle}
            className="flex-1 btn-secondary text-sm"
          >
            <Shuffle size={16} className="inline mr-1" />
            Shuffle
          </button>
        </div>

        {/* Stats */}
        <div className="flex justify-center gap-6 text-sm">
          <div className="text-green-600 dark:text-green-400">
            ✓ {results.correct}
          </div>
          <div className="text-red-600 dark:text-red-400">
            ✗ {results.incorrect}
          </div>
        </div>
      </div>
    </div>
  )
}

export default StudyMode

