import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../services/api'
import { ArrowLeft, CheckCircle2, XCircle, RotateCcw, Trophy } from 'lucide-react'

const MultipleChoiceQuiz = () => {
  const { planId } = useParams()
  const [searchParams] = useSearchParams()
  const taskId = searchParams.get('taskId')
  const testMode = searchParams.get('testMode') === 'true'
  const navigate = useNavigate()
  
  const [flashcards, setFlashcards] = useState([])
  const [mcqQuestions, setMcqQuestions] = useState({}) // flashcardId -> [questions]
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)
  
  // Progress tracking
  const [progressMap, setProgressMap] = useState({}) // flashcardId -> { correctOnFirstTry, hasBeenWrongInCurrentRound }
  const [currentRound, setCurrentRound] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [wrongCount, setWrongCount] = useState(0)
  const [completed, setCompleted] = useState(false)
  
  // Question filter controls (training mode only)
  const [filterStandard, setFilterStandard] = useState(true)
  const [filterReverse, setFilterReverse] = useState(true)
  const [filterCreative, setFilterCreative] = useState(true)
  const [randomMode, setRandomMode] = useState(false)
  
  // Current question state
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [currentFlashcard, setCurrentFlashcard] = useState(null)
  const [shuffledOptions, setShuffledOptions] = useState([])
  const [correctAnswerIndex, setCorrectAnswerIndex] = useState(null)
  
  // Results for test mode
  const [testResults, setTestResults] = useState([]) // [{ flashcardId, correct }]

  useEffect(() => {
    fetchData()
  }, [planId])

  const fetchData = async () => {
    try {
      const flashcardsRes = await api.get(`/flashcards/study-plan/${planId}`)
      const cards = flashcardsRes.data
      
      // Shuffle flashcards
      const shuffled = [...cards].sort(() => Math.random() - 0.5)
      setFlashcards(shuffled)
      
      // Initialize progress map
      const progress = {}
      cards.forEach(card => {
        progress[card.id] = { correctOnFirstTry: false, hasBeenWrongInCurrentRound: false }
      })
      setProgressMap(progress)
      
      // Fetch MCQ questions for all flashcards
      const questionsMap = {}
      for (const card of cards) {
        try {
          const mcqRes = await api.get(`/flashcards/${card.id}/mcq`)
          if (mcqRes.data && mcqRes.data.length > 0) {
            questionsMap[card.id] = mcqRes.data
          }
        } catch (error) {
          console.error(`Failed to fetch MCQs for flashcard ${card.id}:`, error)
        }
      }
      setMcqQuestions(questionsMap)
      
      // Load first question
      loadNextQuestion(shuffled, questionsMap, progress)
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadNextQuestion = (cards, questionsMap, progress) => {
    // Filter flashcards based on progress
    let availableCards = cards
    
    if (!testMode && currentRound > 0) {
      // In training mode, only show unmastered flashcards
      availableCards = cards.filter(card => {
        const prog = progress[card.id] || progressMap[card.id]
        return !prog?.correctOnFirstTry
      })
    }
    
    if (availableCards.length === 0) {
      // All flashcards mastered
      setCompleted(true)
      return
    }
    
    // Select a random flashcard
    const randomCard = availableCards[Math.floor(Math.random() * availableCards.length)]
    const cardQuestions = questionsMap[randomCard.id] || []
    
    if (cardQuestions.length === 0) {
      // No questions for this card, try next
      const nextIndex = cards.indexOf(randomCard) + 1
      if (nextIndex < cards.length) {
        loadNextQuestion(cards, questionsMap, progress)
      } else {
        setCompleted(true)
      }
      return
    }
    
    // Select question based on mode
    let selectedQuestion
    if (testMode || randomMode) {
      // Random question type
      selectedQuestion = cardQuestions[Math.floor(Math.random() * cardQuestions.length)]
    } else {
      // Filter by enabled types
      const filtered = cardQuestions.filter(q => {
        const type = q.question_type || 'standard'
        return (
          (type === 'standard' && filterStandard) ||
          (type === 'reverse' && filterReverse) ||
          (type === 'creative' && filterCreative)
        )
      })
      
      if (filtered.length === 0) {
        // No questions match filter, use any
        selectedQuestion = cardQuestions[0]
      } else {
        selectedQuestion = filtered[Math.floor(Math.random() * filtered.length)]
      }
    }
    
    // Shuffle options
    const options = [...(selectedQuestion.options || [])]
    const correctIdx = selectedQuestion.correct_answer_index || 0
    const correctAnswer = options[correctIdx]
    
    // Fisher-Yates shuffle
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]]
    }
    
    // Find new index of correct answer
    const newCorrectIdx = options.indexOf(correctAnswer)
    
    setCurrentFlashcard(randomCard)
    setCurrentQuestion(selectedQuestion)
    setShuffledOptions(options)
    setCorrectAnswerIndex(newCorrectIdx)
    setSelectedAnswer(null)
    setSubmitted(false)
  }

  const handleSelectAnswer = (index) => {
    if (!submitted) {
      setSelectedAnswer(index)
    }
  }

  const handleSubmit = () => {
    if (selectedAnswer === null) return
    
    setSubmitted(true)
    const isCorrect = selectedAnswer === correctAnswerIndex
    
    // Update progress
    const flashcardId = currentFlashcard.id
    const newProgress = { ...progressMap }
    if (!newProgress[flashcardId]) {
      newProgress[flashcardId] = { correctOnFirstTry: false, hasBeenWrongInCurrentRound: false }
    }
    
    if (isCorrect) {
      setCorrectCount(prev => prev + 1)
      if (!newProgress[flashcardId].hasBeenWrongInCurrentRound) {
        newProgress[flashcardId].correctOnFirstTry = true
      }
    } else {
      setWrongCount(prev => prev + 1)
      newProgress[flashcardId].hasBeenWrongInCurrentRound = true
    }
    
    setProgressMap(newProgress)
    
    // Track test results
    if (testMode) {
      setTestResults(prev => [...prev, { flashcardId, correct: isCorrect }])
    }
  }

  const handleContinue = () => {
    // Check if all flashcards are mastered (training mode only)
    if (!testMode) {
      const allMastered = Object.values(progressMap).every(p => p.correctOnFirstTry)
      if (allMastered) {
        setCompleted(true)
        return
      }
      
      // Check if we need a new round
      const unmastered = Object.values(progressMap).filter(p => !p.correctOnFirstTry)
      if (unmastered.length > 0) {
        // Reset wrong flags for next round
        const resetProgress = { ...progressMap }
        Object.keys(resetProgress).forEach(id => {
          if (!resetProgress[id].correctOnFirstTry) {
            resetProgress[id].hasBeenWrongInCurrentRound = false
          }
        })
        setProgressMap(resetProgress)
        setCurrentRound(prev => prev + 1)
      }
    }
    
    // Load next question
    loadNextQuestion(flashcards, mcqQuestions, progressMap)
  }

  const handleRestart = () => {
    // Reset all state
    const progress = {}
    flashcards.forEach(card => {
      progress[card.id] = { correctOnFirstTry: false, hasBeenWrongInCurrentRound: false }
    })
    setProgressMap(progress)
    setCurrentRound(0)
    setCorrectCount(0)
    setWrongCount(0)
    setCompleted(false)
    setTestResults([])
    loadNextQuestion(flashcards, mcqQuestions, progress)
  }

  // Get vocabulary sentences for current flashcard
  const [vocabularySentences, setVocabularySentences] = useState([])
  useEffect(() => {
    if (currentFlashcard && submitted) {
      api.get(`/flashcards/${currentFlashcard.id}/sentences`)
        .then(res => setVocabularySentences(res.data || []))
        .catch(() => setVocabularySentences([]))
    }
  }, [currentFlashcard, submitted])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (completed) {
    const totalQuestions = correctCount + wrongCount
    const accuracy = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0
    const firstTryCorrect = Object.values(progressMap).filter(p => p.correctOnFirstTry).length
    
    // Calculate performance by question type
    const typeStats = { standard: { correct: 0, total: 0 }, reverse: { correct: 0, total: 0 }, creative: { correct: 0, total: 0 } }
    // This would need to track per question, simplified for now
    
    if (testMode) {
      // Return results to test flow
      return (
        <div className="p-4">
          <div className="card text-center py-12">
            <Trophy size={64} className="mx-auto mb-4 text-yellow-500" />
            <h2 className="text-2xl font-bold mb-2">Quiz Complete!</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Score: {correctCount} / {totalQuestions} ({accuracy.toFixed(0)}%)
            </p>
            <button
              onClick={() => {
                // Return results to parent test flow
                if (window.testFlowCallback) {
                  window.testFlowCallback({ mode: 'quiz', results: testResults })
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
          <h2 className="text-2xl font-bold mb-2">Quiz Complete!</h2>
          
          <div className="mt-6 space-y-2 text-left max-w-md mx-auto">
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Total questions answered:</span>
              <span className="font-medium">{totalQuestions}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Overall accuracy:</span>
              <span className="font-medium">{accuracy.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Correct on first attempt:</span>
              <span className="font-medium text-green-600">{firstTryCorrect}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Questions that needed retry:</span>
              <span className="font-medium text-yellow-600">{totalQuestions - firstTryCorrect}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Total rounds completed:</span>
              <span className="font-medium">{currentRound + 1}</span>
            </div>
          </div>

          <div className="flex gap-3 mt-8 justify-center">
            <button
              onClick={handleRestart}
              className="btn-secondary"
            >
              <RotateCcw size={20} className="inline mr-2" />
              Restart Quiz
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

  if (!currentQuestion || !currentFlashcard) {
    return (
      <div className="p-4">
        <div className="card text-center py-12">
          <p className="text-slate-600 dark:text-slate-400">No questions available</p>
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

  const totalQuestions = correctCount + wrongCount
  const isCorrect = submitted && selectedAnswer === correctAnswerIndex
  const showAnswer = submitted

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
          
          <div className="text-sm">
            <span className="font-medium">Question {totalQuestions + 1}</span>
            {!testMode && currentRound > 0 && (
              <span className="ml-2 text-slate-500">Round {currentRound + 1}</span>
            )}
          </div>
          
          <div className="text-sm">
            <span className="text-green-600 dark:text-green-400">✓ {correctCount}</span>
            <span className="mx-2">|</span>
            <span className="text-red-600 dark:text-red-400">✗ {wrongCount}</span>
          </div>
        </div>
        
        {/* Question Filter Controls (Training Mode Only) */}
        {!testMode && (
          <div className="mt-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
            <div className="text-xs font-medium mb-2 text-slate-600 dark:text-slate-400">
              Question Types:
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="flex items-center text-xs">
                <input
                  type="checkbox"
                  checked={filterStandard}
                  onChange={(e) => setFilterStandard(e.target.checked)}
                  className="mr-1"
                />
                Standard (Q1)
              </label>
              <label className="flex items-center text-xs">
                <input
                  type="checkbox"
                  checked={filterReverse}
                  onChange={(e) => setFilterReverse(e.target.checked)}
                  className="mr-1"
                />
                Reverse (Q2)
              </label>
              <label className="flex items-center text-xs">
                <input
                  type="checkbox"
                  checked={filterCreative}
                  onChange={(e) => setFilterCreative(e.target.checked)}
                  className="mr-1"
                />
                Creative (Q3)
              </label>
              <label className="flex items-center text-xs">
                <input
                  type="checkbox"
                  checked={randomMode}
                  onChange={(e) => setRandomMode(e.target.checked)}
                  className="mr-1"
                />
                Random Mode
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Question Card */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="card max-w-2xl mx-auto">
          <div className="text-center mb-6">
            <div className="text-xl font-semibold mb-4">
              {currentQuestion.question_text}
            </div>
          </div>

          {/* Answer Options */}
          <div className="space-y-3 mb-6">
            {shuffledOptions.map((option, index) => {
              const isSelected = selectedAnswer === index
              const isCorrectOption = index === correctAnswerIndex
              let optionClass = "p-4 border-2 rounded-lg text-left cursor-pointer transition-colors"
              
              if (showAnswer) {
                if (isCorrectOption) {
                  optionClass += " bg-green-100 dark:bg-green-900 border-green-500"
                } else if (isSelected && !isCorrectOption) {
                  optionClass += " bg-red-100 dark:bg-red-900 border-red-500"
                } else {
                  optionClass += " border-gray-200 dark:border-slate-700 opacity-50"
                }
              } else {
                if (isSelected) {
                  optionClass += " bg-blue-50 dark:bg-blue-900 border-blue-500"
                } else {
                  optionClass += " border-gray-200 dark:border-slate-700 hover:border-blue-300"
                }
              }
              
              return (
                <div
                  key={index}
                  className={optionClass}
                  onClick={() => !showAnswer && handleSelectAnswer(index)}
                >
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full border-2 border-current flex items-center justify-center font-bold mr-3">
                      {String.fromCharCode(65 + index)}
                    </div>
                    <div className="flex-1">{option}</div>
                    {showAnswer && isCorrectOption && (
                      <CheckCircle2 size={20} className="text-green-600 ml-2" />
                    )}
                    {showAnswer && isSelected && !isCorrectOption && (
                      <XCircle size={20} className="text-red-600 ml-2" />
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Rationale */}
          {showAnswer && currentQuestion.rationale && (
            <div className={`p-4 rounded-lg mb-4 ${
              isCorrect 
                ? 'bg-green-50 dark:bg-green-900/20' 
                : 'bg-red-50 dark:bg-red-900/20'
            }`}>
              <div className={`font-medium mb-1 ${
                isCorrect ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
              }`}>
                {isCorrect ? 'Correct!' : 'Incorrect'}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {currentQuestion.rationale}
              </div>
            </div>
          )}

          {/* Vocabulary Sentences (for vocabulary, after answering) */}
          {showAnswer && vocabularySentences.length > 0 && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
                Example Sentences:
              </div>
              {vocabularySentences.slice(0, 3).map((sentence, idx) => (
                <div key={idx} className="text-sm text-slate-600 dark:text-slate-400 mb-2">
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

      {/* Controls */}
      <div className="p-4 border-t border-gray-200 dark:border-slate-700">
        {!showAnswer ? (
          <button
            onClick={handleSubmit}
            disabled={selectedAnswer === null}
            className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Submit Answer
          </button>
        ) : (
          <button
            onClick={handleContinue}
            className="w-full btn-primary"
          >
            Continue
          </button>
        )}
      </div>
    </div>
  )
}

export default MultipleChoiceQuiz
