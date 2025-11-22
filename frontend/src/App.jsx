import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import PrivateRoute from './components/PrivateRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Plans from './pages/Plans'
import StudyPlanDetail from './pages/StudyPlanDetail'
import CreateStudyPlan from './pages/CreateStudyPlan'
import Profile from './pages/Profile'
import StudyMode from './pages/StudyMode'
import Layout from './components/Layout'

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Layout />
                </PrivateRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="plans" element={<Plans />} />
              <Route path="plans/:id" element={<StudyPlanDetail />} />
              <Route path="create" element={<CreateStudyPlan />} />
              <Route path="profile" element={<Profile />} />
              <Route path="study/:planId/:mode" element={<StudyMode />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App

