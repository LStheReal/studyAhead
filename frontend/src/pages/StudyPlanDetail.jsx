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
  Clock
} from 'lucide-react'

const StudyPlanDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [plan, setPlan] = useState(null)
  const [tasks, setTasks] = useState([])
  const [flashcards, setFlashcards] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPlanDetails()
  }, [id])

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

  // Group tasks by day
  const tasksByDay = tasks.reduce((acc, task) => {
    const day = task.day_number || 0
    if (!acc[day]) acc[day] = []
    acc[day].push(task)
    return acc
  }, {})

  return (
    <div className="p-4 space-y-6">
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

      {/* Progress Overview */}
      <div className="card">
        <h2 className="font-semibold text-lg mb-4">Progress Overview</h2>
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
                strokeDashoffset={`${2 * Math.PI * 56 * (1 - plan.progress_percentage / 100)}`}
                className="text-blue-500"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-2xl font-bold">{Math.round(plan.progress_percentage)}%</div>
                <div className="text-xs text-slate-600 dark:text-slate-400">Complete</div>
              </div>
            </div>
          </div>
        </div>
        <div className="text-center text-sm text-slate-600 dark:text-slate-400">
          {plan.tasks_completed} / {plan.tasks_total} tasks completed
        </div>
      </div>

      {/* Study Modes */}
      <div className="card">
        <h2 className="font-semibold text-lg mb-4">Study Modes</h2>
        <div className="grid grid-cols-2 gap-3">
          {studyModes.map((mode) => {
            const Icon = mode.icon
            const isAvailable = plan.category === 'vocabulary' || !['fill_gaps'].includes(mode.id)
            return (
              <button
                key={mode.id}
                onClick={() => isAvailable && handleStartMode(mode.id)}
                disabled={!isAvailable}
                className={`p-4 border rounded-lg text-left transition-colors ${
                  isAvailable
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

      {/* Study Schedule */}
      {Object.keys(tasksByDay).length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-lg mb-4">Study Schedule</h2>
          <div className="space-y-4">
            {Object.entries(tasksByDay)
              .sort(([a], [b]) => parseInt(a) - parseInt(b))
              .map(([day, dayTasks]) => (
                <div key={day} className="border-l-2 border-blue-500 pl-4">
                  <h3 className="font-medium mb-2">Day {day}</h3>
                  <div className="space-y-2">
                    {dayTasks.map((task) => (
                      <div
                        key={task.id}
                        className={`p-3 rounded-lg border ${
                          task.completion_status
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                            : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-sm">{task.title}</div>
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
                            {task.completion_status ? (
                              <CheckCircle2 size={16} className="text-green-500 mt-1" />
                            ) : (
                              <button
                                onClick={() => handleStartMode(task.mode, task.id)}
                                className="mt-1 text-blue-500 hover:text-blue-600"
                              >
                                <Play size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => navigate(`/create?edit=${id}`)}
          className="flex-1 btn-secondary"
        >
          <Edit3 size={16} className="inline mr-2" />
          Edit Plan
        </button>
        <button
          onClick={async () => {
            if (confirm('Are you sure you want to delete this study plan?')) {
              try {
                await api.delete(`/study-plans/${id}`)
                navigate('/plans')
              } catch (error) {
                alert('Failed to delete plan')
              }
            }
          }}
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

