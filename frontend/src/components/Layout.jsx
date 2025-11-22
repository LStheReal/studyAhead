import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Home, FileText, Plus, User } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const Layout = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()

  const navItems = [
    { icon: Home, path: '/', label: 'Dashboard' },
    { icon: FileText, path: '/plans', label: 'Plans' },
    { icon: Plus, path: '/create', label: 'Add' },
    { icon: User, path: '/profile', label: 'Profile' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-20">
      <main className="container-mobile">
        <Outlet />
      </main>
      
      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 z-50">
        <div className="container-mobile">
          <div className="flex justify-around items-center h-16">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex flex-col items-center justify-center flex-1 h-full ${
                    isActive
                      ? 'text-blue-500 dark:text-blue-400'
                      : 'text-gray-500 dark:text-slate-400'
                  }`}
                >
                  <Icon size={24} />
                  <span className="text-xs mt-1">{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </nav>
    </div>
  )
}

export default Layout

