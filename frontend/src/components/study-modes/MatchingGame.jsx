import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../services/api'
import { ArrowLeft, RotateCcw, Trophy, CheckCircle2 } from 'lucide-react'

const MatchingGame = () => {
  const { planId } = useParams()
  const [searchParams] = useSearchParams()
  const taskId = searchParams.get('taskId')
  const testMode = searchParams.get('testMode') === 'true'
  const navigate = useNavigate()
  
  const [flashcards, setFlashcards] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Round state
  const [currentRound, setCurrentRound] = useState(0)
  const [roundFlashcards, setRoundFlashcards] = useState([]) // Up to 5 flashcards per round
  const [matchItems, setMatchItems] = useState([]) // { id, text, type: 'left'|'right', flashcardId, isMatched, isSelected, showError, matchType: 'none'|'green'|'yellow' }
  
  // Progress tracking
  const [progressMap, setProgressMap] = useState({}) // flashcardId -> { correctOnFirstTry, hasBeenWrongInCurrentRound, needsRetry }
  const [selectedLeft, setSelectedLeft] = useState(null)
  const [selectedRight, setSelectedRight] = useState(null)
  const [matchedCount, setMatchedCount] = useState(0)
  const [completed, setCompleted] = useState(false)
  
  // Test results
  const [testResults, setTestResults] = useState([])

  useEffect(() => {
    fetchData()
  }, [planId])

  const fetchData = async () => {
    try {
      const response = await api.get(`/flashcards/study-plan/${planId}`)
      const cards = response.data
      
      if (cards.length < 2) {
        setLoading(false)
        return
      }
      
      // Shuffle flashcards
      const shuffled = [...cards].sort(() => Math.random() - 0.5)
      setFlashcards(shuffled)
      
      // Initialize progress map
      const progress = {}
      cards.forEach(card => {
        progress[card.id] = { 
          correctOnFirstTry: false, 
          hasBeenWrongInCurrentRound: false, 
          needsRetry: false 
        }
      })
      setProgressMap(progress)
      
      // Start first round
      startRound(shuffled, progress)
    } catch (error) {
      console.error('Failed to fetch flashcards:', error)
    } finally {
      setLoading(false)
    }
  }

  const startRound = (cards, progress) => {
    // Select up to 5 flashcards for this round
    let availableCards = cards
    
    if (!testMode && currentRound > 0) {
      // In training mode, filter for cards that need retry
      availableCards = cards.filter(card => {
        const prog = progress[card.id] || progressMap[card.id]
        return prog?.needsRetry || !prog?.correctOnFirstTry
      })
    }
    
    // Take up to 5 flashcards
    const selected = availableCards.slice(0, Math.min(5, availableCards.length))
    
    if (selected.length === 0) {
      // All flashcards mastered
      setCompleted(true)
      return
    }
    
    setRoundFlashcards(selected)
    
    // Create match items
    const items = []
    selected.forEach(card => {
      // Left item (front)
      items.push({
        id: `left-${card.id}`,
        text: card.front_text,
        type: 'left',
        flashcardId: card.id,
        isMatched: false,
        isSelected: false,
        showError: false,
        matchType: 'none'
      })
      
      // Right item (back)
      items.push({
        id: `right-${card.id}`,
        text: card.back_text,
        type: 'right',
        flashcardId: card.id,
        isMatched: false,
        isSelected: false,
        showError: false,
        matchType: 'none'
      })
    })
    
    // Shuffle left and right independently
    const leftItems = items.filter(i => i.type === 'left').sort(() => Math.random() - 0.5)
    const rightItems = items.filter(i => i.type === 'right').sort(() => Math.random() - 0.5)
    
    setMatchItems([...leftItems, ...rightItems])
    setMatchedCount(0)
    setSelectedLeft(null)
    setSelectedRight(null)
  }

  const handleItemClick = (item) => {
    if (item.isMatched) return // Can't select matched items
    
    if (item.type === 'left') {
      if (selectedLeft?.id === item.id) {
        // Deselect
        setSelectedLeft(null)
        updateItemState(item.id, { isSelected: false })
      } else {
        // Select new left item
        if (selectedLeft) {
          updateItemState(selectedLeft.id, { isSelected: false })
        }
        setSelectedLeft(item)
        updateItemState(item.id, { isSelected: true })
        
        // If right is already selected, check match
        if (selectedRight) {
          checkMatch(item, selectedRight)
        }
      }
    } else {
      // Right item
      if (selectedRight?.id === item.id) {
        setSelectedRight(null)
        updateItemState(item.id, { isSelected: false })
      } else {
        if (selectedRight) {
          updateItemState(selectedRight.id, { isSelected: false })
        }
        setSelectedRight(item)
        updateItemState(item.id, { isSelected: true })
        
        // If left is already selected, check match
        if (selectedLeft) {
          checkMatch(selectedLeft, item)
        }
      }
    }
  }

  const checkMatch = (leftItem, rightItem) => {
    const isCorrect = leftItem.flashcardId === rightItem.flashcardId
    
    if (isCorrect) {
      // Correct match!
      const flashcardId = leftItem.flashcardId
      const progress = progressMap[flashcardId] || { 
        correctOnFirstTry: false, 
        hasBeenWrongInCurrentRound: false, 
        needsRetry: false 
      }
      
      // Determine match type
      let matchType = 'green'
      if (progress.hasBeenWrongInCurrentRound) {
        matchType = 'yellow'
        progress.needsRetry = true
      } else {
        progress.correctOnFirstTry = true
        progress.needsRetry = false
      }
      
      // Update progress
      setProgressMap(prev => ({
        ...prev,
        [flashcardId]: progress
      }))
      
      // Mark items as matched
      updateItemState(leftItem.id, { 
        isMatched: true, 
        isSelected: false, 
        matchType 
      })
      updateItemState(rightItem.id, { 
        isMatched: true, 
        isSelected: false, 
        matchType 
      })
      
      setMatchedCount(prev => prev + 1)
      setSelectedLeft(null)
      setSelectedRight(null)
      
      // Track test results
      if (testMode) {
        setTestResults(prev => [...prev, { 
          flashcardId, 
          correct: !progress.hasBeenWrongInCurrentRound 
        }])
      }
      
      // Check if round is complete
      if (matchedCount + 1 >= roundFlashcards.length) {
        setTimeout(() => {
          handleRoundComplete()
        }, 500)
      }
    } else {
      // Wrong match
      const leftProg = progressMap[leftItem.flashcardId]
      const rightProg = progressMap[rightItem.flashcardId]
      
      if (leftProg) {
        leftProg.hasBeenWrongInCurrentRound = true
        leftProg.needsRetry = true
      }
      if (rightProg) {
        rightProg.hasBeenWrongInCurrentRound = true
        rightProg.needsRetry = true
      }
      
      setProgressMap(prev => ({
        ...prev,
        [leftItem.flashcardId]: leftProg || { correctOnFirstTry: false, hasBeenWrongInCurrentRound: true, needsRetry: true },
        [rightItem.flashcardId]: rightProg || { correctOnFirstTry: false, hasBeenWrongInCurrentRound: true, needsRetry: true }
      }))
      
      // Show error flash
      updateItemState(leftItem.id, { showError: true, isSelected: false })
      updateItemState(rightItem.id, { showError: true, isSelected: false })
      
      setTimeout(() => {
        updateItemState(leftItem.id, { showError: false })
        updateItemState(rightItem.id, { showError: false })
      }, 500)
      
      setSelectedLeft(null)
      setSelectedRight(null)
    }
  }

  const updateItemState = (itemId, updates) => {
    setMatchItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, ...updates } : item
    ))
  }

  const handleRoundComplete = () => {
    // Check overall completion
    const allMastered = Object.values(progressMap).every(p => p.correctOnFirstTry)
    
    if (allMastered || testMode) {
      setCompleted(true)
      return
    }
    
    // Start next round
    // Reset wrong flags for next round
    const resetProgress = { ...progressMap }
    Object.keys(resetProgress).forEach(id => {
      if (!resetProgress[id].correctOnFirstTry) {
        resetProgress[id].hasBeenWrongInCurrentRound = false
      }
    })
    setProgressMap(resetProgress)
    setCurrentRound(prev => prev + 1)
    startRound(flashcards, resetProgress)
  }

  const handleReset = () => {
    setSelectedLeft(null)
    setSelectedRight(null)
    // Reset selection state only, matched pairs stay matched
    setMatchItems(prev => prev.map(item => ({
      ...item,
      isSelected: false,
      showError: false
    })))
  }

  const handleRestart = () => {
    const progress = {}
    flashcards.forEach(card => {
      progress[card.id] = { 
        correctOnFirstTry: false, 
        hasBeenWrongInCurrentRound: false, 
        needsRetry: false 
      }
    })
    setProgressMap(progress)
    setCurrentRound(0)
    setMatchedCount(0)
    setCompleted(false)
    setTestResults([])
    startRound(flashcards, progress)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (flashcards.length < 2) {
    return (
      <div className="p-4">
        <div className="card text-center py-12">
          <p className="text-slate-600 dark:text-slate-400">Need at least 2 pairs to play</p>
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
    const totalPairs = flashcards.length
    const greenMatches = Object.values(progressMap).filter(p => p.correctOnFirstTry).length
    const yellowMatches = totalPairs - greenMatches
    const firstTrySuccess = (greenMatches / totalPairs) * 100
    
    if (testMode) {
      return (
        <div className="p-4">
          <div className="card text-center py-12">
            <Trophy size={64} className="mx-auto mb-4 text-yellow-500" />
            <h2 className="text-2xl font-bold mb-2">Matching Complete!</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Matched {greenMatches} / {totalPairs} pairs correctly
            </p>
            <button
              onClick={() => {
                if (window.testFlowCallback) {
                  window.testFlowCallback({ mode: 'match', results: testResults })
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
          <h2 className="text-2xl font-bold mb-2">All Pairs Matched!</h2>
          
          <div className="mt-6 space-y-2 text-left max-w-md mx-auto">
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Total pairs matched:</span>
              <span className="font-medium">{totalPairs}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">First-attempt success rate:</span>
              <span className="font-medium">{firstTrySuccess.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Perfect matches (green):</span>
              <span className="font-medium text-green-600">{greenMatches}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Matches needing retry (yellow):</span>
              <span className="font-medium text-yellow-600">{yellowMatches}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Total rounds needed:</span>
              <span className="font-medium">{currentRound + 1}</span>
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

  const leftItems = matchItems.filter(i => i.type === 'left')
  const rightItems = matchItems.filter(i => i.type === 'right')

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
            {!testMode && <span className="font-medium">Round {currentRound + 1}</span>}
            <span className="ml-2 text-slate-500">
              Matched {matchedCount} / {roundFlashcards.length} pairs
            </span>
          </div>
          
          <button
            onClick={handleReset}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-sm"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Matching Area */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Column */}
            <div className="space-y-3">
              <h3 className="font-medium text-sm text-slate-600 dark:text-slate-400 mb-2">
                Questions
              </h3>
              {leftItems.map((item) => {
                let itemClass = "card p-4 text-center cursor-pointer transition-all border-2"
                
                if (item.isMatched) {
                  if (item.matchType === 'green') {
                    itemClass += " bg-green-100 dark:bg-green-900 border-green-500"
                  } else {
                    itemClass += " bg-yellow-100 dark:bg-yellow-900 border-yellow-500"
                  }
                } else if (item.isSelected) {
                  itemClass += " bg-blue-100 dark:bg-blue-900 border-blue-500"
                } else if (item.showError) {
                  itemClass += " border-red-500 animate-pulse"
                } else {
                  itemClass += " border-gray-200 dark:border-slate-700 hover:border-blue-300"
                }
                
                return (
                  <div
                    key={item.id}
                    className={itemClass}
                    onClick={() => handleItemClick(item)}
                  >
                    <div className="font-medium">{item.text}</div>
                    {item.isMatched && (
                      <CheckCircle2 size={20} className="mx-auto mt-2 text-green-600" />
                    )}
                  </div>
                )
              })}
            </div>

            {/* Right Column */}
            <div className="space-y-3">
              <h3 className="font-medium text-sm text-slate-600 dark:text-slate-400 mb-2">
                Answers
              </h3>
              {rightItems.map((item) => {
                let itemClass = "card p-4 text-center cursor-pointer transition-all border-2"
                
                if (item.isMatched) {
                  if (item.matchType === 'green') {
                    itemClass += " bg-green-100 dark:bg-green-900 border-green-500"
                  } else {
                    itemClass += " bg-yellow-100 dark:bg-yellow-900 border-yellow-500"
                  }
                } else if (item.isSelected) {
                  itemClass += " bg-blue-100 dark:bg-blue-900 border-blue-500"
                } else if (item.showError) {
                  itemClass += " border-red-500 animate-pulse"
                } else {
                  itemClass += " border-gray-200 dark:border-slate-700 hover:border-blue-300"
                }
                
                return (
                  <div
                    key={item.id}
                    className={itemClass}
                    onClick={() => handleItemClick(item)}
                  >
                    <div className="font-medium">{item.text}</div>
                    {item.isMatched && (
                      <CheckCircle2 size={20} className="mx-auto mt-2 text-green-600" />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MatchingGame
