import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import api from '../services/api'
import TestFlow from '../components/study-modes/TestFlow'

const PreAssessment = () => {
    const { id } = useParams() // Match App.jsx route /plans/:id/pre-assessment
    const navigate = useNavigate()
    const location = useLocation()
    const [loading, setLoading] = useState(true)
    const [taskId, setTaskId] = useState(null)

    useEffect(() => {
        fetchPreAssessmentTask()
    }, [id])

    const fetchPreAssessmentTask = async () => {
        try {
            // Fetch tasks for this study plan to find the pre-assessment task
            const tasksRes = await api.get(`/tasks/study-plan/${id}`)
            const preAssessmentTask = tasksRes.data.find(t =>
                t.title === 'Pre-Assessment Test' && t.day_number === 1
            )

            if (preAssessmentTask) {
                setTaskId(preAssessmentTask.id)
            }
        } catch (error) {
            console.error('Failed to fetch tasks for pre-assessment:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (taskId && !location.search.includes('taskId')) {
            navigate(`?taskId=${taskId}`, { replace: true })
        }
    }, [taskId])

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        )
    }

    // Pass taskId in the state or append to search params if needed
    // TestFlow expects taskId from searchParams
    return (
        <div className="w-full h-full">
            <TestFlow isPreAssessment={true} />
        </div>
    )
}

export default PreAssessment

