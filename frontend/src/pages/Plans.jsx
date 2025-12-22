import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { format, differenceInDays } from 'date-fns'
import { FileText, Calendar, BookOpen, ArrowRight } from 'lucide-react'

const Plans = () => {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetchPlans()
  }, [])

  const fetchPlans = async () => {
    try {
      const response = await api.get('/study-plans/')
      setPlans(response.data)
    } catch (error) {
      console.error('Failed to fetch plans:', error)
    } finally {
      setLoading(false)
    }
  }

  const getCategoryBadge = (category) => {
    const colors = {
      vocabulary: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      grammar_math_logic: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      facts: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      other: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    }
    return colors[category] || colors.other
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Study Plans</h1>
        <button
          onClick={() => navigate('/create')}
          className="btn-primary"
        >
          New Plan
        </button>
      </div>

      {plans.length === 0 ? (
        <div className="card text-center py-12">
          <FileText size={64} className="mx-auto mb-4 text-slate-400" />
          <h3 className="text-lg font-semibold mb-2">No study plans yet</h3>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            Create your first study plan to get started
          </p>
          <button
            onClick={() => navigate('/create')}
            className="btn-primary"
          >
            Create Study Plan
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {plans.map((plan) => {
            const daysRemaining = plan.exam_date
              ? differenceInDays(new Date(plan.exam_date), new Date())
              : null
            const isSimplePlan = plan.plan_mode === 'simple'

            return (
              <div
                key={plan.id}
                onClick={() => navigate(`/plans/${plan.id}`)}
                className="card cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1">{plan.name}</h3>
                    <div className="flex gap-2 flex-wrap">
                      {plan.category && (
                        <span className={`badge ${getCategoryBadge(plan.category)}`}>
                          {plan.category.replace('_', ' ')}
                        </span>
                      )}
                      {isSimplePlan && (
                        <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                          Simple
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight size={20} className="text-slate-400" />
                </div>

                <div className="space-y-2 mb-3">
                  {plan.exam_date && (
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <Calendar size={16} />
                      <span>
                        {format(new Date(plan.exam_date), 'MMM d, yyyy')}
                        {daysRemaining !== null && ` (${daysRemaining} days)`}
                      </span>
                    </div>
                  )}
                  {!isSimplePlan && (
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <BookOpen size={16} />
                      <span>Next task available</span>
                    </div>
                  )}
                </div>

                {/* Progress bar - only for full plans */}
                {!isSimplePlan ? (
                  <>
                    <div className="mb-2">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-slate-600 dark:text-slate-400">Progress</span>
                        <span className="font-medium">{Math.round(plan.progress_percentage)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all"
                          style={{ width: `${plan.progress_percentage}%` }}
                        />
                      </div>
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-500 mt-2">
                      {plan.tasks_completed} / {plan.tasks_total} tasks completed
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-slate-500 dark:text-slate-500 mt-2">
                    Simple flashcard set - no schedule
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default Plans

