import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { format, differenceInDays } from 'date-fns'
import {
  ArrowLeft,
  BookOpen,
  HelpCircle,
  Shuffle,
  FileText,
  Edit3,
  Trash2,
  Play,
  CheckCircle2,
  Clock,
  Lock
} from 'lucide-react'

const StudyPlanDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [plan, setPlan] = useState(null)
  const [tasks, setTasks] = useState([])
  const [flashcards, setFlashcards] = useState([])
  const [loading, setLoading] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [isPolling, setIsPolling] = useState(false)

  useEffect(() => {
    fetchPlanDetails()
  }, [id])

  useEffect(() => {
    let interval
    if (plan?.status === 'generating') {
      setIsPolling(true)
      interval = setInterval(async () => {
        try {
          const statusRes = await api.get(`/study-plans/${id}/status`)
          if (statusRes.data.status !== 'generating') {
            await fetchPlanDetails()
            setIsPolling(false)
          }
        } catch (err) {
          console.error('Polling error:', err)
          // On 404 or other errors, stop polling to avoid infinite loops
          setIsPolling(false)
        }
      }, 3000)
    } else {
      setIsPolling(false)
    }
    return () => clearInterval(interval)
  }, [plan?.status, id])

  const [preAssessment, setPreAssessment] = useState(null)

  const fetchPlanDetails = async () => {
    try {
      const [planRes, tasksRes, flashcardsRes] = await Promise.all([
        api.get(`/study-plans/${id}`),
        api.get(`/tasks/study-plan/${id}`),
        api.get(`/flashcards/study-plan/${id}`)
      ])

      setPlan(planRes.data)
      setTasks(tasksRes.data)
      setFlashcards(flashcardsRes.data)

      // Fetch Pre-Assessment Status
      try {
        const paRes = await api.get(`/pre-assessment/${id}`)
        setPreAssessment(paRes.data)
      } catch (err) {
        // Not found is fine, means we need to generate it
        setPreAssessment(null)
      }

    } catch (error) {
      console.error('Failed to fetch plan details:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStartMode = (mode, taskId = null) => {
    if (taskId) {
      navigate(`/study/${id}/${mode}?taskId=${taskId}`)
    } else {
      navigate(`/study/${id}/${mode}`)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.delete(`/study-plans/${id}`)
      navigate('/plans')
    } catch (error) {
      console.error('Failed to delete plan:', error)
      alert('Failed to delete plan. Please try again.')
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const studyModes = [
    { id: 'learn', name: 'Learn', icon: BookOpen, description: 'Flashcard review with swipe gestures' },
    { id: 'quiz', name: 'Quiz', icon: HelpCircle, description: 'Multiple choice questions' },
    { id: 'match', name: 'Match', icon: Shuffle, description: 'Matching game' },
    { id: 'write', name: 'Write', icon: FileText, description: 'Typing practice' },
    { id: 'fill_gaps', name: 'Fill Gaps', icon: Edit3, description: 'Fill in the blanks' },
    { id: 'short_test', name: 'Short Test', icon: Clock, description: 'Quick assessment' },
    { id: 'long_test', name: 'Long Test', icon: CheckCircle2, description: 'Comprehensive test' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!plan) {
    return <div className="p-4">Plan not found</div>
  }

  const daysRemaining = plan.exam_date
    ? differenceInDays(new Date(plan.exam_date), new Date())
    : null

  // Check if this is a simple plan (no exam date, no schedule)
  const isSimplePlan = plan.plan_mode === 'simple'

  // Group tasks by day
  const tasksByDay = tasks.reduce((acc, task) => {
    const day = task.day_number || 0
    if (!acc[day]) acc[day] = []
    acc[day].push(task)
    return acc
  }, {})

  return (
    <div className="p-4 space-y-6">
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-2">Delete Study Plan?</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Are you sure you want to delete "{plan.name}"? This will permanently delete all flashcards, tasks, and progress. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={() => navigate('/plans')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
        >
          <ArrowLeft size={24} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{plan.name}</h1>
          {plan.exam_date && (
            <p className="text-slate-600 dark:text-slate-400">
              {format(new Date(plan.exam_date), 'MMM d, yyyy')}
              {daysRemaining !== null && ` • ${daysRemaining} days remaining`}
            </p>
          )}
        </div>
      </div>

      {/* Tab Header - Only show for full plans */}
      {!isSimplePlan ? (
        <div className="flex p-1 bg-gray-100 dark:bg-slate-800 rounded-xl max-w-sm mb-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all ${activeTab === 'overview'
              ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all ${activeTab === 'schedule'
              ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
          >
            Schedule
          </button>
        </div>
      ) : (
        /* Simple Plan Banner */
        <div className="mb-6 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-3">
          <div className="text-amber-600 dark:text-amber-400">
            <Clock size={20} />
          </div>
          <p className="text-sm text-amber-800 dark:text-amber-300">
            This is a simple plan without scheduling. Add an exam date to unlock smart study features.
          </p>
        </div>
      )}

      {activeTab === 'overview' ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Dynamic Action Card */}
          {(() => {
            // Find the pre-assessment task
            const preAssessmentTask = tasks.find(t => t.title === 'Pre-Assessment Test')
            const isPreAssessmentDone = preAssessmentTask?.completion_status

            // Get incomplete tasks sorted by order
            const incompleteTasks = tasks
              .filter(t => !t.completion_status)
              .sort((a, b) => (a.day_number - b.day_number) || (a.order - b.order))

            const nextTask = incompleteTasks[0]

            if (plan.status === 'generating') {
              return (
                <div className="card bg-blue-50 dark:bg-blue-900/20 border-2 border-dashed border-blue-200 dark:border-blue-800 p-8 text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <h3 className="text-xl font-bold text-blue-900 dark:text-blue-300 mb-1">
                    {(!tasks || tasks.length === 0) ? "Processing your materials..." : "Inventing your schedule..."}
                  </h3>
                  <p className="text-blue-600 dark:text-blue-400">
                    {(!tasks || tasks.length === 0)
                      ? "Our AI is analyzing your content to create the best study experience."
                      : "Our AI is crunching the data to build the perfect path for you."}
                  </p>
                </div>
              )
            } else if (isSimplePlan) {
              // Simple plan - show ready to study card without pre-assessment
              return (
                <div className="card bg-gradient-to-r from-green-500 to-emerald-600 text-white p-6">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                      <BookOpen size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold mb-1">Ready to Study!</h2>
                      <p className="text-green-100 opacity-90">
                        {flashcards.length} flashcards ready. Pick a study mode below to start learning.
                      </p>
                    </div>
                  </div>
                </div>
              )
            } else if (preAssessmentTask && !isPreAssessmentDone) {
              // Pre-assessment exists and is not done - show pre-assessment prompt
              return (
                <div className="card bg-gradient-to-r from-purple-500 to-indigo-600 text-white transform hover:scale-[1.01] transition-all cursor-pointer"
                  onClick={() => navigate(`/plans/${id}/pre-assessment`)}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
                        <div className="bg-white/20 p-2 rounded-lg"><HelpCircle size={20} /></div>
                        Take Pre-Assessment
                      </h2>
                      <p className="text-indigo-100 opacity-90">
                        Skip what you already know! Save time by verifying your knowledge.
                      </p>
                    </div>
                    <div className="h-10 w-10 bg-white text-indigo-600 rounded-full flex items-center justify-center font-bold">
                      <ArrowLeft className="rotate-180" size={20} />
                    </div>
                  </div>
                </div>
              )
            } else if (nextTask) {
              // Show the next task
              return (
                <div className="card bg-gradient-to-r from-blue-600 to-indigo-700 text-white transform hover:scale-[1.01] transition-all cursor-pointer"
                  onClick={() => handleStartMode(nextTask.mode, nextTask.id)}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-blue-200 text-xs font-bold uppercase tracking-wider">Up Next</span>
                      <h2 className="text-2xl font-bold mb-1 flex items-center gap-2">
                        {nextTask.title}
                      </h2>
                      <p className="text-blue-100 opacity-90 text-sm">
                        {nextTask.estimated_minutes} min • Day {nextTask.day_number}
                      </p>
                    </div>
                    <div className="h-12 w-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                      <Play size={24} fill="white" />
                    </div>
                  </div>
                </div>
              )
            } else {
              // All done
              return (
                <div className="card bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 p-6 text-center">
                  <CheckCircle2 size={48} className="text-green-500 mx-auto mb-3" />
                  <h3 className="text-xl font-bold text-green-900 dark:text-green-300 mb-1">All caught up!</h3>
                  <p className="text-green-600 dark:text-green-400">You've completed all scheduled tasks for this plan. Great work!</p>
                </div>
              )
            }
          })()}

          {/* Progress Overview - Only for full plans */}
          {!isSimplePlan && (
            <div className="card">
              <h2 className="font-semibold text-lg mb-4">Progress Overview</h2>
              {(() => {
                const completedTasks = tasks.filter(t => t.completion_status).length
                const totalTasks = tasks.length
                const progressPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

                return (
                  <>
                    <div className="flex items-center justify-center mb-4">
                      <div className="relative w-32 h-32">
                        <svg className="progress-ring w-32 h-32">
                          <circle
                            cx="64"
                            cy="64"
                            r="56"
                            stroke="currentColor"
                            strokeWidth="8"
                            fill="none"
                            className="text-gray-200 dark:text-slate-700"
                          />
                          <circle
                            cx="64"
                            cy="64"
                            r="56"
                            stroke="currentColor"
                            strokeWidth="8"
                            fill="none"
                            strokeDasharray={`${2 * Math.PI * 56}`}
                            strokeDashoffset={`${2 * Math.PI * 56 * (1 - progressPercent / 100)}`}
                            className="text-blue-500"
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-center">
                            <div className="text-2xl font-bold">{Math.round(progressPercent)}%</div>
                            <div className="text-xs text-slate-600 dark:text-slate-400">Complete</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-center text-sm text-slate-600 dark:text-slate-400">
                      {completedTasks} / {totalTasks} tasks completed
                    </div>
                  </>
                )
              })()}
            </div>
          )}

          {/* Study Modes */}
          <div className="card">
            <h2 className="font-semibold text-lg mb-4">Study Modes</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {studyModes.map((mode) => {
                const Icon = mode.icon
                const isAvailable = flashcards.length > 0
                return (
                  <button
                    key={mode.id}
                    onClick={() => isAvailable && handleStartMode(mode.id)}
                    disabled={!isAvailable}
                    className={`p-4 border rounded-lg text-left transition-colors ${isAvailable
                      ? 'border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer'
                      : 'border-gray-100 dark:border-slate-800 opacity-50 cursor-not-allowed'
                      }`}
                  >
                    <Icon size={24} className="mb-2 text-blue-500" />
                    <div className="font-medium text-sm">{mode.name}</div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      {mode.description}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Flashcards Preview */}
          <div className="card">
            <h2 className="font-semibold text-lg mb-4">Flashcards Preview ({flashcards.length})</h2>
            {flashcards.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                {flashcards.map((card, index) => (
                  <div
                    key={card.id}
                    className="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-800 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-xs font-medium">
                        {index + 1}
                      </div>
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-200">
                          {card.front_text}
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400 border-t md:border-t-0 md:border-l border-gray-200 dark:border-slate-700 pt-2 md:pt-0 md:pl-3">
                          {card.back_text}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <p>No flashcards generated yet.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Study Schedule */}
          {Object.keys(tasksByDay).length > 0 ? (
            <div className="card">
              <h2 className="font-semibold text-lg mb-4">Study Schedule</h2>
              {(() => {
                // Sort all tasks by day and order to determine unlock sequence
                const sortedTasks = [...tasks].sort((a, b) =>
                  (a.day_number - b.day_number) || (a.order - b.order)
                )

                // Create a map of task ids to their unlock status
                const taskUnlockStatus = {}
                let previousTaskDone = true

                for (const task of sortedTasks) {
                  if (task.completion_status) {
                    taskUnlockStatus[task.id] = true // Completed tasks are "unlocked"
                    previousTaskDone = true
                  } else {
                    taskUnlockStatus[task.id] = previousTaskDone // Only unlocked if previous was done
                    previousTaskDone = false // Next task will be locked
                  }
                }

                return (
                  <div className="space-y-4">
                    {Object.entries(tasksByDay)
                      .sort(([a], [b]) => parseInt(a) - parseInt(b))
                      .map(([day, dayTasks]) => (
                        <div key={day} className="border-l-2 border-blue-500 pl-4">
                          <h3 className="font-medium mb-2">Day {day}</h3>
                          <div className="space-y-2">
                            {dayTasks.map((task) => {
                              const isUnlocked = taskUnlockStatus[task.id]
                              const isCompleted = task.completion_status

                              return (
                                <div
                                  key={task.id}
                                  className={`p-3 rounded-lg border transition-all ${isCompleted
                                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                                    : isUnlocked
                                      ? 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700'
                                      : 'bg-gray-100 dark:bg-slate-900 border-gray-200 dark:border-slate-800 opacity-60'
                                    }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className={`font-medium text-sm ${!isUnlocked && !isCompleted ? 'text-slate-400' : ''}`}>
                                        {task.title}
                                      </div>
                                      {task.rationale && (
                                        <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                                          {task.rationale}
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <div className="text-xs text-slate-600 dark:text-slate-400">
                                        {task.estimated_minutes} min
                                      </div>
                                      {isCompleted ? (
                                        <CheckCircle2 size={16} className="text-green-500 mt-1" />
                                      ) : isUnlocked ? (
                                        <button
                                          onClick={() => handleStartMode(task.mode, task.id)}
                                          className="mt-1 text-blue-500 hover:text-blue-600"
                                        >
                                          <Play size={16} />
                                        </button>
                                      ) : (
                                        <Lock size={16} className="text-slate-400 mt-1" />
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                  </div>
                )
              })()}
            </div>
          ) : (
            <div className="card text-center py-12">
              <Clock size={48} className="mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-bold mb-2">No Schedule Yet</h3>
              <p className="text-slate-600 dark:text-slate-400">
                Complete the pre-assessment to generate your full study schedule!
              </p>
            </div>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => navigate(`/plans/${id}/edit`)}
          className="flex-1 btn-secondary"
        >
          <Edit3 size={16} className="inline mr-2" />
          Edit Plan
        </button>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="flex-1 btn-secondary text-red-600 dark:text-red-400"
        >
          <Trash2 size={16} className="inline mr-2" />
          Delete
        </button>
      </div>
    </div>
  )
}

export default StudyPlanDetail

