import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../services/api'
// ... (previous imports)
import { ArrowLeft, CheckCircle2, XCircle, RotateCcw, Trophy, Menu, Settings } from 'lucide-react'

// ... (inside component)
const MultipleChoiceQuiz = () => {
  const { planId } = useParams()
  const [searchParams] = useSearchParams()
  const taskId = searchParams.get('taskId')
  const testMode = searchParams.get('testMode') === 'true'
  const navigate = useNavigate()

  const [flashcards, setFlashcards] = useState([])
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [currentFlashcard, setCurrentFlashcard] = useState(null)
  const [shuffledOptions, setShuffledOptions] = useState([])
  const [correctAnswerIndex, setCorrectAnswerIndex] = useState(null)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [completed, setCompleted] = useState(false)

  // Stats
  const [correctCount, setCorrectCount] = useState(0)
  const [wrongCount, setWrongCount] = useState(0)
  const [progressMap, setProgressMap] = useState({}) // flashcardId -> { correctOnFirstTry: bool, hasBeenWrongInCurrentRound: bool }
  const [testResults, setTestResults] = useState([])

  // Question filter controls (training mode only)
  const [filterStandard, setFilterStandard] = useState(true)
  const [filterReverse, setFilterReverse] = useState(false) // Default false
  const [filterCreative, setFilterCreative] = useState(false) // Default false
  const [randomMode, setRandomMode] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    fetchData()
  }, [planId])

  const fetchData = async () => {
    try {
      const response = await api.get(`/study-plans/${planId}/quiz`)
      const flashcardsData = response.data

      if (flashcardsData.length === 0) {
        setLoading(false)
        return
      }

      setFlashcards(flashcardsData)
      loadNextQuestion(flashcardsData, {})
      setLoading(false)
    } catch (error) {
      console.error('Failed to fetch quiz data:', error)
      setLoading(false)
    }
  }

  const loadNextQuestion = (flashcardsData, currentProgressMap) => {
    // Filter flashcards that haven't been correctly answered on first try
    const remaining = flashcardsData.filter(fc => !currentProgressMap[fc.id]?.correctOnFirstTry)

    if (remaining.length === 0) {
      setCompleted(true)
      return
    }

    // Pick next flashcard (random or sequential)
    const nextFlashcard = randomMode
      ? remaining[Math.floor(Math.random() * remaining.length)]
      : remaining[0]

    // Get MCQ questions for this flashcard
    const questions = nextFlashcard.mcq_questions || []

    // Filter by question type settings
    const filteredQuestions = questions.filter(q => {
      if (q.question_type === 'standard' && filterStandard) return true
      if (q.question_type === 'reverse' && filterReverse) return true
      if (q.question_type === 'creative' && filterCreative) return true
      return false
    })

    if (filteredQuestions.length === 0) {
      // No questions match filters, skip this flashcard
      const newProgress = { ...currentProgressMap }
      newProgress[nextFlashcard.id] = { correctOnFirstTry: true, hasBeenWrongInCurrentRound: false }
      loadNextQuestion(flashcardsData, newProgress)
      return
    }

    const question = filteredQuestions[Math.floor(Math.random() * filteredQuestions.length)]

    // Shuffle options
    const options = [...question.options]
    const correctAnswer = options[question.correct_answer_index]
    const shuffled = options.sort(() => Math.random() - 0.5)
    const newCorrectIndex = shuffled.indexOf(correctAnswer)

    setCurrentFlashcard(nextFlashcard)
    setCurrentQuestion(question)
    setShuffledOptions(shuffled)
    setCorrectAnswerIndex(newCorrectIndex)
    setSelectedAnswer(null)
    setSubmitted(false)
  }

  const handleContinue = () => {
    loadNextQuestion(flashcards, progressMap)
  }

  const handleRestart = () => {
    setProgressMap({})
    setCorrectCount(0)
    setWrongCount(0)
    setCompleted(false)
    setTestResults([])
    loadNextQuestion(flashcards, {})
  }

  // ... (fetchData and loadNextQuestion remain mostly same, just ensure defaults are respected)

  const handleSelectAnswer = (index) => {
    if (!submitted) {
      setSelectedAnswer(index)
      // Auto-submit
      handleSubmit(index)
    }
  }

  const handleSubmit = (selectedIndex) => {
    // if (selectedAnswer === null) return // Removed check as we pass index directly now

    setSubmitted(true)
    const isCorrect = selectedIndex === correctAnswerIndex

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (completed || loading) return

      if (submitted) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleContinue()
        }
        return
      }

      // Option selection (1-4)
      if (['1', '2', '3', '4'].includes(e.key)) {
        const index = parseInt(e.key) - 1
        if (index < shuffledOptions.length) {
          handleSelectAnswer(index)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [completed, loading, submitted, shuffledOptions, handleContinue])

  // ... (handleContinue, handleRestart remain same)

  // Removed vocabularySentences useEffect and state

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (completed) {
    // ... (keep completion screen but maybe remove borders if needed, though card style is fine there)
    const totalQuestions = correctCount + wrongCount
    const accuracy = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0
    const firstTryCorrect = Object.values(progressMap).filter(p => p.correctOnFirstTry).length

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-50 dark:bg-slate-900 p-4">
        <div className="card text-center py-12 w-full max-w-md">
          <Trophy size={64} className="mx-auto mb-4 text-yellow-500" />
          <h2 className="text-2xl font-bold mb-2">Quiz Complete!</h2>

          {/* ... stats ... */}
          <div className="mt-6 space-y-2 text-left max-w-md mx-auto">
            {/* ... same stats ... */}
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Total questions answered:</span>
              <span className="font-medium">{totalQuestions}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Overall accuracy:</span>
              <span className="font-medium">{accuracy.toFixed(1)}%</span>
            </div>
            {/* ... */}
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
    // ... (keep empty state)
    return (
      <div className="p-4 h-screen flex items-center justify-center">
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
  // We want to show progress like "17/36". 
  // 36 is likely the total number of flashcards (if 1 question per card per round).
  // Or just "Correct: 17".
  // Let's use "Correct: {correctCount} / {flashcards.length}" assuming 1 pass.
  // Or just "{correctCount} / {flashcards.length}" with a label.

  const showAnswer = submitted

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50 dark:bg-slate-900 overflow-hidden h-[100dvh] w-full pb-24 pt-4">
      {/* Header */}
      <div className="p-4 bg-white dark:bg-slate-800 shadow-sm flex-shrink-0 z-10 relative">
        <div className="flex items-center justify-between max-w-4xl mx-auto w-full">
          <button
            onClick={() => navigate(`/plans/${planId}`)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} />
          </button>

          <div className="flex items-center gap-2 font-mono text-xl font-bold text-slate-700 dark:text-slate-200 bg-gray-100 dark:bg-slate-700 px-4 py-2 rounded-lg">
            <CheckCircle2 size={20} className="text-green-500" />
            {correctCount} / {flashcards.length}
          </div>

          {!testMode && (
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <Menu size={24} />
              </button>

              {showSettings && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSettings(false)}></div>
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 p-4 z-50">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                      Question Types
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center p-2 hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filterStandard}
                          onChange={(e) => setFilterStandard(e.target.checked)}
                          className="mr-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium">Standard</span>
                      </label>
                      <label className="flex items-center p-2 hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filterReverse}
                          onChange={(e) => setFilterReverse(e.target.checked)}
                          className="mr-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium">Reverse</span>
                      </label>
                      <label className="flex items-center p-2 hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filterCreative}
                          onChange={(e) => setFilterCreative(e.target.checked)}
                          className="mr-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium">Creative</span>
                      </label>
                      <div className="h-px bg-gray-200 dark:bg-slate-700 my-2"></div>
                      <label className="flex items-center p-2 hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={randomMode}
                          onChange={(e) => setRandomMode(e.target.checked)}
                          className="mr-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium">Random Mode</span>
                      </label>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          {testMode && <div className="w-10"></div>} {/* Spacer */}
        </div>
      </div>

      {/* Question Card */}
      <div className="flex-1 p-4 overflow-y-auto flex flex-col justify-center">
        <div className="max-w-2xl mx-auto w-full">
          <div className="card mb-8 p-8 text-center shadow-md bg-white dark:bg-slate-800 rounded-2xl">
            <div className="text-xl md:text-3xl font-bold leading-relaxed text-slate-800 dark:text-white">
              {currentQuestion.question_text}
            </div>
          </div>

          {/* Answer Options */}
          <div className="grid grid-cols-1 gap-4">
            {shuffledOptions.map((option, index) => {
              const isSelected = selectedAnswer === index
              const isCorrectOption = index === correctAnswerIndex
              let optionClass = "p-5 border-2 rounded-xl text-left cursor-pointer transition-all duration-200 relative overflow-hidden group"

              if (showAnswer) {
                if (isCorrectOption) {
                  optionClass += " bg-green-50 dark:bg-green-900/20 border-green-500 shadow-[0_0_0_1px_rgba(34,197,94,1)]"
                } else if (isSelected && !isCorrectOption) {
                  optionClass += " bg-red-50 dark:bg-red-900/20 border-red-500 shadow-[0_0_0_1px_rgba(239,68,68,1)]"
                } else {
                  optionClass += " border-gray-200 dark:border-slate-700 opacity-50 grayscale"
                }
              } else {
                optionClass += " bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5"
              }

              return (
                <div
                  key={index}
                  className={optionClass}
                  onClick={() => !showAnswer && handleSelectAnswer(index)}
                >
                  <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center font-bold mr-4 text-sm transition-colors ${isSelected || (showAnswer && isCorrectOption)
                      ? 'border-current bg-current text-white'
                      : 'border-gray-300 dark:border-slate-600 text-gray-400 group-hover:border-blue-400 group-hover:text-blue-400'
                      }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 font-medium text-lg text-slate-700 dark:text-slate-200">{option}</div>
                    {showAnswer && isCorrectOption && (
                      <CheckCircle2 size={24} className="text-green-500 ml-2 flex-shrink-0" />
                    )}
                    {showAnswer && isSelected && !isCorrectOption && (
                      <XCircle size={24} className="text-red-500 ml-2 flex-shrink-0" />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      {showAnswer && (
        <div className="p-4 bg-white dark:bg-slate-800 flex-shrink-0 z-10 relative">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={handleContinue}
              className="w-full btn-primary py-4 text-lg font-semibold shadow-lg shadow-blue-500/20 transition-all"
            >
              Continue <span className="ml-2 text-white/60 text-sm font-normal">(Enter)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default MultipleChoiceQuiz
