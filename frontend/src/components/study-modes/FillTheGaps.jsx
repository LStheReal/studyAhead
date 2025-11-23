import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../services/api'
import { ArrowLeft, RotateCcw, Trophy, CheckCircle2, XCircle } from 'lucide-react'

// Reuse LCS diff from WritingPractice
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
    return { isCorrect: true }
  }
  
  // Simple character-by-character comparison
  const userDiff = []
  const correctDiff = []
  const maxLen = Math.max(normalizedUser.length, normalizedCorrect.length)
  
  for (let i = 0; i < maxLen; i++) {
    const userChar = normalizedUser[i] || ''
    const correctChar = normalizedCorrect[i] || ''
    
    if (userChar === correctChar && userChar !== '') {
      userDiff.push({ char: userChar, status: 'correct' })
      correctDiff.push({ char: correctChar, status: 'correct' })
    } else {
      if (userChar) {
        userDiff.push({ char: userChar, status: 'incorrect' })
      }
      if (correctChar) {
        correctDiff.push({ char: correctChar, status: 'missing' })
      }
    }
  }
  
  return { isCorrect: false, diff: { user: userDiff, correct: correctDiff } }
}

const FillTheGaps = () => {
  const { planId } = useParams()
  const [searchParams] = useSearchParams()
  const taskId = searchParams.get('taskId')
  const testMode = searchParams.get('testMode') === 'true'
  const navigate = useNavigate()
  
  const [flashcards, setFlashcards] = useState([])
  const [vocabularySentences, setVocabularySentences] = useState({}) // flashcardId -> [sentences]
  const [gapItems, setGapItems] = useState([]) // { flashcardId, flashcardFront, flashcardBack, sentenceId, sentence, correctWord, hint }
  const [currentIndex, setCurrentIndex] = useState(0)
  const [userAnswer, setUserAnswer] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  
  // Progress tracking
  const [wordStatus, setWordStatus] = useState({}) // flashcardId -> { known: false, attempts: 0 }
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
      // Check if this is a vocabulary plan
      const planRes = await api.get(`/study-plans/${planId}`)
      if (planRes.data.category !== 'vocabulary') {
        setLoading(false)
        return
      }
      
      const flashcardsRes = await api.get(`/flashcards/study-plan/${planId}`)
      const cards = flashcardsRes.data
      
      if (cards.length === 0) {
        setLoading(false)
        return
      }
      
      setFlashcards(cards)
      
      // Initialize word status
      const status = {}
      cards.forEach(card => {
        status[card.id] = { known: false, attempts: 0 }
      })
      setWordStatus(status)
      
      // Fetch vocabulary sentences for all flashcards
      const sentencesMap = {}
      const items = []
      
      for (const card of cards) {
        try {
          const sentencesRes = await api.get(`/flashcards/${card.id}/sentences`)
          const sentences = sentencesRes.data || []
          
          if (sentences.length > 0) {
            sentencesMap[card.id] = sentences
            
            // Randomly select ONE sentence per flashcard
            const randomSentence = sentences[Math.floor(Math.random() * sentences.length)]
            
            // Extract correct word from highlighted words
            let correctWord = ''
            let hint = card.front_text // Use front as hint by default
            
            if (randomSentence.highlighted_words && randomSentence.highlighted_words.length > 0) {
              const firstHighlight = randomSentence.highlighted_words[0]
              correctWord = randomSentence.sentence_text.substring(
                firstHighlight.start_index,
                firstHighlight.end_index
              )
            } else {
              // Fallback: try to find the word in the sentence
              const backText = card.back_text.toLowerCase()
              const words = randomSentence.sentence_text.toLowerCase().split(/\s+/)
              const foundWord = words.find(w => w.includes(backText) || backText.includes(w))
              if (foundWord) {
                correctWord = foundWord
              }
            }
            
            if (correctWord) {
              items.push({
                flashcardId: card.id,
                flashcardFront: card.front_text,
                flashcardBack: card.back_text,
                sentenceId: randomSentence.id,
                sentence: randomSentence.sentence_text,
                correctWord: correctWord,
                hint: hint
              })
            }
          }
        } catch (error) {
          console.error(`Failed to fetch sentences for flashcard ${card.id}:`, error)
        }
      }
      
      if (items.length === 0) {
        setLoading(false)
        return
      }
      
      // Shuffle gap items
      const shuffled = [...items].sort(() => Math.random() - 0.5)
      setGapItems(shuffled)
      setVocabularySentences(sentencesMap)
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  const currentGap = gapItems[currentIndex]
  const displaySentence = currentGap ? currentGap.sentence.replace(
    currentGap.correctWord,
    '______'
  ) : ''

  const handleCheckAnswer = () => {
    if (!userAnswer.trim() || !currentGap) return
    
    const comparison = compareAnswers(userAnswer, currentGap.correctWord)
    setResult(comparison)
    setSubmitted(true)
    
    const flashcardId = currentGap.flashcardId
    const status = wordStatus[flashcardId] || { known: false, attempts: 0 }
    
    if (comparison.isCorrect) {
      setCorrectCount(prev => prev + 1)
      status.known = true
      
      // Update mastery
      const flashcard = flashcards.find(fc => fc.id === flashcardId)
      if (flashcard) {
        api.post(`/flashcards/${flashcardId}/update-mastery?mastery_level=${Math.min(100, (flashcard.mastery_level || 0) + 10)}`)
          .catch(console.error)
      }
      
      // Track test results
      if (testMode) {
        setTestResults(prev => [...prev, { flashcardId, correct: true }])
      }
    } else {
      setIncorrectCount(prev => prev + 1)
      status.attempts = (status.attempts || 0) + 1
      
      // Track test results
      if (testMode) {
        setTestResults(prev => [...prev, { flashcardId, correct: false }])
      }
    }
    
    setWordStatus(prev => ({ ...prev, [flashcardId]: status }))
  }

  const handleContinue = () => {
    if (!currentGap) return
    
    const flashcardId = currentGap.flashcardId
    const status = wordStatus[flashcardId]
    
    if (result?.isCorrect) {
      // Remove gap from deck
      const newGaps = gapItems.filter((_, i) => i !== currentIndex)
      if (newGaps.length === 0) {
        setCompleted(true)
        return
      }
      
      // Adjust index
      const newIndex = currentIndex >= newGaps.length ? newGaps.length - 1 : currentIndex
      setGapItems(newGaps)
      setCurrentIndex(newIndex)
    } else {
      // Re-insert 3-5 positions ahead
      const insertPosition = currentIndex + Math.floor(Math.random() * 3) + 3
      const newGaps = [...gapItems]
      newGaps.splice(insertPosition, 0, currentGap)
      setGapItems(newGaps)
      
      // Move to next
      if (currentIndex < gapItems.length - 1) {
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
    const flashcardId = currentGap.flashcardId
    const status = wordStatus[flashcardId] || { known: false, attempts: 0 }
    status.attempts = (status.attempts || 0) + 1
    setWordStatus(prev => ({ ...prev, [flashcardId]: status }))
    setIncorrectCount(prev => prev + 1)
    
    if (testMode) {
      setTestResults(prev => [...prev, { flashcardId, correct: false }])
    }
    
    handleContinue()
  }

  const handleRestart = () => {
    const status = {}
    flashcards.forEach(card => {
      status[card.id] = { known: false, attempts: 0 }
    })
    setWordStatus(status)
    setCorrectCount(0)
    setIncorrectCount(0)
    setCompleted(false)
    setTestResults([])
    setCurrentIndex(0)
    setUserAnswer('')
    setSubmitted(false)
    setResult(null)
    
    // Reshuffle
    const shuffled = [...gapItems].sort(() => Math.random() - 0.5)
    setGapItems(shuffled)
  }

  // Check completion
  useEffect(() => {
    if (gapItems.length > 0) {
      const allKnown = gapItems.every(gap => wordStatus[gap.flashcardId]?.known)
      if (allKnown) {
        setCompleted(true)
      }
    }
  }, [wordStatus, gapItems])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (gapItems.length === 0) {
    return (
      <div className="p-4">
        <div className="card text-center py-12">
          <p className="text-slate-600 dark:text-slate-400">
            No sentences available. This mode requires vocabulary flashcards with example sentences.
          </p>
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
    const totalSentences = gapItems.length
    const firstTryCorrect = Object.values(wordStatus).filter(s => s.known && s.attempts === 1).length
    const totalAttempts = Object.values(wordStatus).reduce((sum, s) => sum + s.attempts, 0)
    const avgAttempts = totalSentences > 0 ? (totalAttempts / totalSentences).toFixed(1) : 0
    const accuracy = totalSentences > 0 ? (correctCount / (correctCount + incorrectCount)) * 100 : 0
    
    if (testMode) {
      return (
        <div className="p-4">
          <div className="card text-center py-12">
            <Trophy size={64} className="mx-auto mb-4 text-yellow-500" />
            <h2 className="text-2xl font-bold mb-2">Fill the Gaps Complete!</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Score: {correctCount} / {totalSentences} ({accuracy.toFixed(0)}%)
            </p>
            <button
              onClick={() => {
                if (window.testFlowCallback) {
                  window.testFlowCallback({ mode: 'fill_gaps', results: testResults })
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
          <h2 className="text-2xl font-bold mb-2">Fill the Gaps Complete!</h2>
          
          <div className="mt-6 space-y-2 text-left max-w-md mx-auto">
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Total sentences completed:</span>
              <span className="font-medium">{totalSentences}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">First-try correct:</span>
              <span className="font-medium text-green-600">{firstTryCorrect} / {totalSentences}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Average attempts:</span>
              <span className="font-medium">{avgAttempts}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Accuracy:</span>
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
            <span className="font-medium">Sentence {currentIndex + 1} / {gapItems.length}</span>
          </div>
          
          <div className="w-8" />
        </div>
        
        <div className="flex justify-center gap-6 text-sm mt-2">
          <span className="text-green-600 dark:text-green-400">✓ {correctCount}</span>
          <span className="text-red-600 dark:text-red-400">✗ {incorrectCount}</span>
        </div>
      </div>

      {/* Question Card */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="card max-w-2xl mx-auto">
          {/* Context Hint */}
          <div className="text-sm text-slate-500 dark:text-slate-400 mb-4 text-center">
            Translation: {currentGap?.hint}
          </div>
          
          {/* Sentence with Gap */}
          <div className="text-center mb-6">
            <div className="text-xl font-medium mb-4 leading-relaxed">
              {displaySentence.split('______').map((part, idx, arr) => (
                <span key={idx}>
                  {part}
                  {idx < arr.length - 1 && (
                    <span className="inline-block w-32 h-8 border-b-2 border-blue-500 mx-2 align-middle" />
                  )}
                </span>
              ))}
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
              placeholder="Fill in the blank"
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
                    {currentGap.sentence.split(currentGap.correctWord).map((part, idx, arr) => (
                      <span key={idx}>
                        {part}
                        {idx < arr.length - 1 && (
                          <span className="font-bold bg-green-200 dark:bg-green-800 px-1 rounded">
                            {currentGap.correctWord}
                          </span>
                        )}
                      </span>
                    ))}
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
                        {result.diff?.user.map((item, idx) => (
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
                        {result.diff?.correct.map((item, idx) => (
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
                    
                    <div>
                      <div className="text-sm font-medium mb-1 text-slate-600 dark:text-slate-400">
                        Complete sentence:
                      </div>
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        {currentGap.sentence.split(currentGap.correctWord).map((part, idx, arr) => (
                          <span key={idx}>
                            {part}
                            {idx < arr.length - 1 && (
                              <span className="font-bold text-blue-600 dark:text-blue-400">
                                {currentGap.correctWord}
                              </span>
                            )}
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

export default FillTheGaps

