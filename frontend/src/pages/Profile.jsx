import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import api from '../services/api'
import { Moon, Sun, LogOut, Settings, TrendingUp, BookOpen, Target, Calendar } from 'lucide-react'

const Profile = () => {
  const { user, logout, fetchUser } = useAuth()
  const { darkMode, toggleTheme } = useTheme()
  const [stats, setStats] = useState(null)
  const [preferences, setPreferences] = useState({
    learning_speed: user?.learning_speed || 'moderate',
    study_hours_per_week: user?.study_hours_per_week || 10,
    preferred_study_modes: user?.preferred_study_modes || [],
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const response = await api.get('/analytics/dashboard')
      setStats(response.data)
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  const handleUpdatePreferences = async () => {
    setLoading(true)
    try {
      await api.put('/users/me', preferences)
      await fetchUser()
      alert('Preferences updated!')
    } catch (error) {
      alert('Failed to update preferences')
    } finally {
      setLoading(false)
    }
  }

  const studyModes = ['learn', 'quiz', 'match', 'write', 'fill_gaps', 'short_test', 'long_test']

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold">Profile</h1>

      {/* User Info */}
      <div className="card">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center text-white text-2xl font-bold">
            {user?.first_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-lg">
              {user?.first_name && user?.last_name
                ? `${user.first_name} ${user.last_name}`
                : user?.first_name || user?.email}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="card">
          <h2 className="font-semibold text-lg mb-4">Statistics</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <BookOpen size={20} className="text-blue-500" />
                <span className="text-sm text-slate-600 dark:text-slate-400">Study Plans</span>
              </div>
              <div className="text-2xl font-bold">{stats.total_study_plans}</div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Target size={20} className="text-green-500" />
                <span className="text-sm text-slate-600 dark:text-slate-400">Cards Mastered</span>
              </div>
              <div className="text-2xl font-bold">{stats.cards_mastered}</div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={20} className="text-purple-500" />
                <span className="text-sm text-slate-600 dark:text-slate-400">Avg Score</span>
              </div>
              <div className="text-2xl font-bold">{Math.round(stats.average_test_score)}%</div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Calendar size={20} className="text-orange-500" />
                <span className="text-sm text-slate-600 dark:text-slate-400">Streak</span>
              </div>
              <div className="text-2xl font-bold">{stats.study_streak} days</div>
            </div>
          </div>
        </div>
      )}

      {/* Study Preferences */}
      <div className="card">
        <h2 className="font-semibold text-lg mb-4">Study Preferences</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Learning Speed: {preferences.learning_speed}
            </label>
            <input
              type="range"
              min="0"
              max="2"
              value={['slow', 'moderate', 'fast'].indexOf(preferences.learning_speed)}
              onChange={(e) => {
                const speeds = ['slow', 'moderate', 'fast']
                setPreferences({
                  ...preferences,
                  learning_speed: speeds[parseInt(e.target.value)],
                })
              }}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mt-1">
              <span>Slow</span>
              <span>Moderate</span>
              <span>Fast</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Study Hours per Week: {preferences.study_hours_per_week}
            </label>
            <input
              type="number"
              min="1"
              max="40"
              value={preferences.study_hours_per_week}
              onChange={(e) =>
                setPreferences({
                  ...preferences,
                  study_hours_per_week: parseInt(e.target.value),
                })
              }
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Preferred Study Modes</label>
            <div className="space-y-2">
              {studyModes.map((mode) => (
                <label key={mode} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={preferences.preferred_study_modes.includes(mode)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setPreferences({
                          ...preferences,
                          preferred_study_modes: [...preferences.preferred_study_modes, mode],
                        })
                      } else {
                        setPreferences({
                          ...preferences,
                          preferred_study_modes: preferences.preferred_study_modes.filter(
                            (m) => m !== mode
                          ),
                        })
                      }
                    }}
                    className="rounded"
                  />
                  <span className="text-sm capitalize">{mode.replace('_', ' ')}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={handleUpdatePreferences}
            disabled={loading}
            className="w-full btn-primary disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </div>

      {/* Settings */}
      <div className="card">
        <h2 className="font-semibold text-lg mb-4">Settings</h2>
        <div className="space-y-3">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-between p-3 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              <span>Dark Mode</span>
            </div>
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {darkMode ? 'On' : 'Off'}
            </span>
          </button>
        </div>
      </div>

      {/* Sign Out */}
      <button
        onClick={logout}
        className="w-full btn-secondary text-red-600 dark:text-red-400 border-red-300 dark:border-red-700"
      >
        <LogOut size={16} className="inline mr-2" />
        Sign Out
      </button>
    </div>
  )
}

export default Profile

