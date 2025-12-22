import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import { format, differenceInDays } from 'date-fns'
import {
  BookOpen,
  TrendingUp,
  Target,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  ClipboardCheck
} from 'lucide-react'

const Dashboard = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for falsy onboarding_completed, but ensure user is loaded
    if (user && !user.onboarding_completed) {
      navigate('/onboarding')
    }
    fetchDashboard()
  }, [user, navigate])

  const fetchDashboard = async () => {
    try {
      const response = await api.get('/analytics/dashboard')
      setStats(response.data)
    } catch (error) {
      console.error('Failed to fetch dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  const getStatusBadge = (plan) => {
    const daysRemaining = plan.exam_date
      ? differenceInDays(new Date(plan.exam_date), new Date())
      : null

    if (!daysRemaining) return null

    const progressRatio = plan.progress_percentage / 100
    const expectedProgress = 1 - (daysRemaining / (daysRemaining + (plan.tasks_completed || 1)))

    if (progressRatio >= expectedProgress * 0.9) {
      return <span className="badge badge-success">On Track</span>
    } else if (progressRatio >= expectedProgress * 0.7) {
      return <span className="badge badge-warning">Caution</span>
    } else {
      return <span className="badge badge-error">Behind</span>
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!stats) {
    return <div className="p-4">Failed to load dashboard</div>
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header Card */}
      <div className="card bg-gradient-primary text-white">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm p-1.5">
            <img src="/logo.png" alt="StudyAhead" className="w-full h-full object-contain" />
          </div>
          <h2 className="text-xl font-semibold">
            {getGreeting()}, {user?.first_name || 'there'}!
          </h2>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div>
            <div className="text-2xl font-bold">{stats.total_study_plans}</div>
            <div className="text-sm opacity-90">Active Plans</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{Math.round(stats.average_test_score)}%</div>
            <div className="text-sm opacity-90">Avg Score</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{Math.round(stats.overall_progress)}%</div>
            <div className="text-sm opacity-90">Progress</div>
          </div>
        </div>
      </div>

      {/* Today's Schedule */}
      <div className="card">
        <h3 className="font-semibold text-lg mb-4">Today's Schedule</h3>
        {stats.today_tasks.length > 0 ? (
          <div className="space-y-3">
            {stats.today_tasks.map((task) => {
              const isPreAssessment = task.mode === 'pre_assessment' || task.title === 'Pre-Assessment Test'

              return (
                <button
                  key={task.id}
                  onClick={() => {
                    if (isPreAssessment) {
                      navigate(`/plans/${task.study_plan_id}/pre-assessment`)
                    } else {
                      navigate(`/study/${task.study_plan_id}/${task.mode}?taskId=${task.id}`)
                    }
                  }}
                  className="w-full text-left p-3 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                        {isPreAssessment ? (
                          <ClipboardCheck size={20} className="text-blue-600 dark:text-blue-400" />
                        ) : (
                          <Clock size={20} className="text-blue-600 dark:text-blue-400" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium">{task.title}</div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          {isPreAssessment ? 'Pre-Assessment' : task.mode.replace('_', ' ')} • {task.estimated_minutes} min
                        </div>
                      </div>
                    </div>
                    {!task.completion_status && (
                      <AlertCircle size={20} className="text-yellow-500" />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-600 dark:text-slate-400">
            <Calendar size={48} className="mx-auto mb-2 opacity-50" />
            <p>No tasks scheduled for today</p>
            <button
              onClick={() => navigate('/create')}
              className="mt-4 btn-primary"
            >
              Create Study Plan
            </button>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
              <Target size={20} className="text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.study_streak}</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Day Streak</div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
              <TrendingUp size={20} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.tests_rocked}</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Tests Rocked</div>
            </div>
          </div>
        </div>
      </div>

      {/* Learning Insights */}
      {stats.learning_efficiency !== 1.0 && (
        <div className="card bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-slate-800 dark:to-slate-800 border-indigo-100 dark:border-slate-700">
          <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
            <Target className="text-indigo-600" size={20} />
            Learning Insights
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600 dark:text-slate-400">Learning Speed Efficiency</span>
              <span className="font-bold text-indigo-600">
                {Math.round(stats.learning_efficiency * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
              <div
                className="bg-indigo-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(100, stats.learning_efficiency * 50)}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {stats.learning_efficiency > 1.0
                ? "You're learning faster than average! We've accelerated your schedule."
                : "We've adjusted your schedule to ensure you master every topic."}
            </p>
          </div>
        </div>
      )}

      {/* Upcoming Exams */}
      {stats.upcoming_exams.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-lg mb-4">Upcoming Exams</h3>
          <div className="space-y-3">
            {stats.upcoming_exams.map((plan) => {
              const daysRemaining = differenceInDays(new Date(plan.exam_date), new Date())
              return (
                <div
                  key={plan.id}
                  onClick={() => navigate(`/plans/${plan.id}`)}
                  className="p-3 border border-gray-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">{plan.name}</div>
                    {getStatusBadge(plan)}
                  </div>
                  <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
                    <span>{daysRemaining} days remaining</span>
                    <span>{Math.round(plan.progress_percentage)}% complete</span>
                  </div>
                  <div className="mt-2 w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${plan.progress_percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      <button
        onClick={() => navigate('/create')}
        className="fixed bottom-24 right-4 w-14 h-14 bg-gradient-primary text-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform z-40"
      >
        <span className="text-2xl">+</span>
      </button>
    </div>
  )
}

export default Dashboard

