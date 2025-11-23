import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../services/api'
import { ArrowLeft, Trophy, Clock, AlertCircle } from 'lucide-react'
import MultipleChoiceQuiz from './MultipleChoiceQuiz'
import MatchingGame from './MatchingGame'
import WritingPractice from './WritingPractice'
import FillTheGaps from './FillTheGaps'

const TestFlow = () => {
  const { planId, mode } = useParams()
  const [searchParams] = useSearchParams()
  const taskId = searchParams.get('taskId')
  const testType = mode === 'long_test' ? 'long' : 'short' // 'short' or 'long'
  const navigate = useNavigate()
  
  const [flashcards, setFlashcards] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Test configuration
  const testConfig = {
    short: {
      multipleChoice: 2,
      matching: 5,
      writing: 4,
      fillGaps: 2,
      total: 13
    },
    long: {
      multipleChoice: 6,
      matching: 15,
      writing: 12,
      fillGaps: 6,
      total: 39
    }
  }
  
  const config = testConfig[testType] || testConfig.short
  
  // Test state
  const [currentPhase, setCurrentPhase] = useState(0) // 0: MC, 1: Matching, 2: Writing, 3: Fill Gaps, 4: Summary
  const [selectedFlashcards, setSelectedFlashcards] = useState({
    multipleChoice: [],
    matching: [],
    writing: [],
    fillGaps: []
  })
  const [phaseResults, setPhaseResults] = useState({
    multipleChoice: [],
    matching: [],
    writing: [],
    fillGaps: []
  })
  const [testStartTime, setTestStartTime] = useState(null)
  const [timeSpent, setTimeSpent] = useState(0)
  
  const phases = [
    { id: 'multipleChoice', name: 'Multiple Choice', component: MultipleChoiceQuiz },
    { id: 'matching', name: 'Matching Game', component: MatchingGame },
    { id: 'writing', name: 'Writing Practice', component: WritingPractice },
    { id: 'fillGaps', name: 'Fill the Gaps', component: FillTheGaps }
  ]

  useEffect(() => {
    fetchData()
    setTestStartTime(Date.now())
    
    // Set up test flow callback
    window.testFlowCallback = handlePhaseComplete
    
    return () => {
      delete window.testFlowCallback
    }
  }, [planId])

  useEffect(() => {
    if (testStartTime) {
      const interval = setInterval(() => {
        setTimeSpent(Math.floor((Date.now() - testStartTime) / 1000))
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [testStartTime])

  const fetchData = async () => {
    try {
      const response = await api.get(`/flashcards/study-plan/${planId}`)
      const cards = response.data
      
      if (cards.length === 0) {
        setLoading(false)
        return
      }
      
      // Shuffle all flashcards
      const shuffled = [...cards].sort(() => Math.random() - 0.5)
      setFlashcards(shuffled)
      
      // Select vocabulary for each mode (NO DUPLICATES)
      const usedIndices = new Set()
      const selections = {
        multipleChoice: [],
        matching: [],
        writing: [],
        fillGaps: []
      }
      
      // Select for Multiple Choice
      let count = 0
      for (let i = 0; i < shuffled.length && count < config.multipleChoice; i++) {
        if (!usedIndices.has(i)) {
          selections.multipleChoice.push(shuffled[i])
          usedIndices.add(i)
          count++
        }
      }
      
      // Select for Matching
      count = 0
      for (let i = 0; i < shuffled.length && count < config.matching; i++) {
        if (!usedIndices.has(i)) {
          selections.matching.push(shuffled[i])
          usedIndices.add(i)
          count++
        }
      }
      
      // Select for Writing
      count = 0
      for (let i = 0; i < shuffled.length && count < config.writing; i++) {
        if (!usedIndices.has(i)) {
          selections.writing.push(shuffled[i])
          usedIndices.add(i)
          count++
        }
      }
      
      // Select for Fill Gaps (need to check for sentences)
      // For now, just select available flashcards
      count = 0
      for (let i = 0; i < shuffled.length && count < config.fillGaps; i++) {
        if (!usedIndices.has(i)) {
          selections.fillGaps.push(shuffled[i])
          usedIndices.add(i)
          count++
        }
      }
      
      setSelectedFlashcards(selections)
    } catch (error) {
      console.error('Failed to fetch flashcards:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePhaseComplete = (phaseData) => {
    const { mode, results } = phaseData
    setPhaseResults(prev => ({
      ...prev,
      [mode]: results
    }))
    
    // Move to next phase
    if (currentPhase < phases.length - 1) {
      setCurrentPhase(currentPhase + 1)
    } else {
      // All phases complete, show summary
      setCurrentPhase(phases.length)
      saveTestResults()
    }
  }

  const saveTestResults = async () => {
    try {
      // Calculate scores
      const allResults = {
        multipleChoice: phaseResults.multipleChoice,
        matching: phaseResults.matching,
        writing: phaseResults.writing,
        fillGaps: phaseResults.fillGaps
      }
      
      const totalCorrect = Object.values(allResults).reduce((sum, results) => {
        return sum + results.filter(r => r.correct).length
      }, 0)
      
      const totalQuestions = Object.values(allResults).reduce((sum, results) => {
        return sum + results.length
      }, 0)
      
      const overallScore = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0
      
      // Build vocab details
      const vocabDetails = {}
      Object.values(allResults).forEach(results => {
        results.forEach(result => {
          if (!vocabDetails[result.flashcardId]) {
            vocabDetails[result.flashcardId] = {
              correct: 0,
              total: 0,
              mastery: 0
            }
          }
          vocabDetails[result.flashcardId].total++
          if (result.correct) {
            vocabDetails[result.flashcardId].correct++
          }
        })
      })
      
      // Calculate mastery per flashcard
      Object.keys(vocabDetails).forEach(flashcardId => {
        const detail = vocabDetails[flashcardId]
        detail.mastery = detail.total > 0 ? (detail.correct / detail.total) * 100 : 0
      })
      
      // Save test result
      const testResultData = {
        test_type: testType,
        score: overallScore,
        total_questions: totalQuestions,
        correct_answers: totalCorrect,
        answers: allResults,
        vocab_details: vocabDetails,
        time_spent: Math.floor(timeSpent / 60) // minutes
      }
      
      if (taskId) {
        // Complete the task
        await api.post(`/tasks/${taskId}/complete`, {
          results: testResultData,
          time_spent: testResultData.time_spent
        })
      } else {
        // Just save test result
        await api.post(`/test-results/study-plan/${planId}`, testResultData)
      }
    } catch (error) {
      console.error('Failed to save test results:', error)
    }
  }

  const handleExit = () => {
    if (window.confirm('Exit test? Your progress will not be saved.')) {
      navigate(`/plans/${planId}`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (flashcards.length < config.total) {
    return (
      <div className="p-4">
        <div className="card text-center py-12">
          <AlertCircle size={64} className="mx-auto mb-4 text-yellow-500" />
          <h2 className="text-2xl font-bold mb-2">Not Enough Flashcards</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            Need at least {config.total} flashcards for this test. You have {flashcards.length}.
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

  // Show summary screen
  if (currentPhase >= phases.length) {
    const allResults = {
      multipleChoice: phaseResults.multipleChoice,
      matching: phaseResults.matching,
      writing: phaseResults.writing,
      fillGaps: phaseResults.fillGaps
    }
    
    const modeScores = {}
    Object.keys(allResults).forEach(mode => {
      const results = allResults[mode]
      const correct = results.filter(r => r.correct).length
      const total = results.length
      modeScores[mode] = {
        correct,
        total,
        percentage: total > 0 ? (correct / total) * 100 : 0
      }
    })
    
    const totalCorrect = Object.values(modeScores).reduce((sum, s) => sum + s.correct, 0)
    const totalQuestions = Object.values(modeScores).reduce((sum, s) => sum + s.total, 0)
    const overallScore = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0
    
    const getGrade = (score) => {
      if (score >= 90) return { letter: 'A', color: 'green' }
      if (score >= 80) return { letter: 'B', color: 'blue' }
      if (score >= 70) return { letter: 'C', color: 'yellow' }
      if (score >= 60) return { letter: 'D', color: 'orange' }
      return { letter: 'F', color: 'red' }
    }
    
    const grade = getGrade(overallScore)
    const minutes = Math.floor(timeSpent / 60)
    const seconds = timeSpent % 60
    
    // Find strongest and weakest areas
    const sortedModes = Object.entries(modeScores).sort((a, b) => b[1].percentage - a[1].percentage)
    const strongest = sortedModes[0]?.[0] || 'N/A'
    const weakest = sortedModes[sortedModes.length - 1]?.[0] || 'N/A'
    
    return (
      <div className="min-h-screen p-4">
        <div className="max-w-2xl mx-auto">
          <div className="card text-center py-12">
            <Trophy size={64} className="mx-auto mb-4 text-yellow-500" />
            <h2 className="text-2xl font-bold mb-2">Test Complete!</h2>
            <div className={`text-4xl font-bold mb-4 text-${grade.color}-600`}>
              Score: {overallScore.toFixed(0)}%
            </div>
            <div className={`badge badge-${grade.color === 'green' ? 'success' : grade.color === 'blue' ? 'info' : grade.color === 'yellow' ? 'warning' : 'error'} text-lg px-4 py-2`}>
              Grade: {grade.letter}
            </div>
            
            {/* Mode-by-Mode Breakdown */}
            <div className="mt-8 space-y-4 text-left">
              <h3 className="font-semibold text-lg mb-4">Performance by Mode:</h3>
              
              {Object.entries(modeScores).map(([mode, score]) => (
                <div key={mode} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium capitalize">
                      {mode.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <span className="font-bold">
                      {score.correct} / {score.total} ({score.percentage.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        score.percentage >= 80 ? 'bg-green-500' :
                        score.percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${score.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            
            {/* Performance Insights */}
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-left">
              <div className="font-medium mb-2">Performance Insights:</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                <div>Strongest area: <span className="font-medium capitalize">{strongest.replace(/([A-Z])/g, ' $1').trim()}</span></div>
                <div>Needs practice: <span className="font-medium capitalize">{weakest.replace(/([A-Z])/g, ' $1').trim()}</span></div>
              </div>
            </div>
            
            {/* Time Tracking */}
            <div className="mt-4 text-sm text-slate-600 dark:text-slate-400">
              <Clock size={16} className="inline mr-1" />
              Time: {minutes}m {seconds}s
            </div>
            
            <div className="mt-8">
              <button
                onClick={() => navigate(`/plans/${planId}`)}
                className="btn-primary"
              >
                Back to Overview
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Render current phase component
  const PhaseComponent = phases[currentPhase].component
  const phaseName = phases[currentPhase].name
  const phaseId = phases[currentPhase].id
  
  // Filter flashcards for current phase
  const phaseFlashcards = selectedFlashcards[phaseId] || []
  
  // Create a wrapper that passes testMode and filtered flashcards
  const renderPhaseComponent = () => {
    // For now, components will fetch their own flashcards
    // But we can pass testMode via URL params or context
    // Using a simple approach: modify the component to accept testMode prop
    return <PhaseComponent />
  }
  
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header with progress */}
      <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={handleExit}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
          >
            <ArrowLeft size={24} />
          </button>
          
          <div className="text-sm font-medium">
            Phase {currentPhase + 1} of {phases.length}: {phaseName}
          </div>
          
          <div className="text-sm text-slate-500">
            <Clock size={16} className="inline mr-1" />
            {Math.floor(timeSpent / 60)}m {timeSpent % 60}s
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all"
            style={{ width: `${((currentPhase + 1) / phases.length) * 100}%` }}
          />
        </div>
      </div>
      
      {/* Phase Component - components will check window.testFlowCallback for test mode */}
      {renderPhaseComponent()}
    </div>
  )
}

export default TestFlow

