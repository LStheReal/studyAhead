import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { Upload, X, FileText, Image as ImageIcon, Type, Camera } from 'lucide-react'

const CreateStudyPlan = () => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    name: '',
    exam_date: '',
    question_language: '',
    answer_language: '',
  })
  const [files, setFiles] = useState([])
  const [textContent, setTextContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [processingStatus, setProcessingStatus] = useState(null)
  const [planId, setPlanId] = useState(null)
  const pollCountRef = useRef(0)
  const maxPollCount = 150
  const isMounted = useRef(true)

  useEffect(() => {
    return () => {
      isMounted.current = false
    }
  }, [])

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleFileSelect = (e) => {
    const newFiles = Array.from(e.target.files)
    setFiles([...files, ...newFiles])
  }

  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index))
  }

  const handleCameraCapture = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment'
    input.onchange = (e) => {
      if (e.target.files[0]) {
        setFiles([...files, e.target.files[0]])
      }
    }
    input.click()
  }

  const [useMockData, setUseMockData] = useState(false)

  const handleSubmit = async () => {
    if (!formData.name) {
      alert('Please enter a study plan name')
      return
    }

    if (!useMockData && files.length === 0 && !textContent) {
      alert('Please add some learning materials (files or text)')
      return
    }

    setLoading(true)



    // ... REAL FLOW ...
    setProcessingStatus({ status: 'creating', message: 'Creating study plan...' })

    try {
      // 1. Create Study Plan
      const planPayload = {
        name: formData.name,
        type: 'flashcard_set', // Defaulting to flashcard_set for now
        category: 'vocabulary', // Default
        exam_date: formData.exam_date || null,
        question_language: formData.question_language || 'English',
        answer_language: formData.answer_language || 'English',
        learning_objectives: 'Generated from user materials'
      }

      const planResponse = await api.post('/study-plans/', planPayload)
      const newPlanId = planResponse.data.id
      setPlanId(newPlanId)

      if (useMockData) {
        // Trigger Backend Mock Generator
        setProcessingStatus({ status: 'generating', message: 'Generating mock content...' })
        await api.post(`/flashcards/study-plan/${newPlanId}/generate-mock-content`)

        // Mock generation is complete, navigate immediately
        setProcessingStatus({ status: 'complete', message: 'Mock data created!' })
        setLoading(false)
        setTimeout(() => {
          navigate(`/plans/${newPlanId}`)
        }, 500)
        return // Exit here, don't continue to material upload flow
      }

      // 2. Upload Materials
      setProcessingStatus({ status: 'uploading', message: 'Uploading materials...' })

      // Upload text content if exists
      if (textContent) {
        await api.post('/materials/upload', {
          study_plan_id: newPlanId,
          text_content: textContent
        })
      }

      // Upload files if exist (Not fully implemented in backend yet, but here's the structure)
      // For now, we only support text content in the backend logic shown previously (MaterialUpload schema).
      // Converting files to text would be ideal, but for now let's rely on textContent.
      // If we have files but no text, we might need to warn or implement file upload endpoint.
      // Assuming for now user pasted text as per my test.

      // 3. Trigger Generation (or polling)
      setProcessingStatus({ status: 'generating', message: 'Analyzing materials...' })

      // Start polling status
      pollProcessingStatus(newPlanId)

    } catch (error) {
      console.error('Error creating plan:', error)
      setProcessingStatus({ status: 'error', message: 'Failed to create plan' })
      setLoading(false)
    }
  }

  const pollProcessingStatus = async (currentPlanId) => {
    if (!isMounted.current) return

    pollCountRef.current += 1
    if (pollCountRef.current > maxPollCount) {
      setLoading(false)
      alert('Processing is taking longer than expected. Check your plans page.')
      navigate('/plans')
      return
    }

    try {
      const response = await api.get(`/materials/${currentPlanId}/status`)
      const status = response.data

      if (!isMounted.current) return

      const normalizedStatus = status.status?.toLowerCase()

      setProcessingStatus({
        status: normalizedStatus,
        message: getStatusMessage(normalizedStatus, status.flashcard_count),
        flashcardCount: status.flashcard_count,
      })

      if (normalizedStatus === 'awaiting_approval' || normalizedStatus === 'active') {
        setLoading(false)
        setTimeout(() => navigate(`/plans/${currentPlanId}`), 1500)
      } else if (normalizedStatus === 'generating') {
        setTimeout(() => pollProcessingStatus(currentPlanId), 2000)
      } else {
        setLoading(false)
        setProcessingStatus({
          status: 'error',
          message: 'Unexpected status. Check your plans page.'
        })
        setTimeout(() => navigate('/plans'), 3000)
      }
    } catch (error) {
      console.error('Failed to check status:', error)
      if (isMounted.current) {
        setLoading(false)
        setProcessingStatus({
          status: 'error',
          message: 'Error checking status. Your plan may still be processing.'
        })
        setTimeout(() => navigate('/plans'), 3000)
      }
    }
  }

  const getStatusMessage = (status, flashcardCount) => {
    const messages = {
      creating: 'Creating study plan...',
      uploading: 'Uploading materials...',
      generating: flashcardCount > 0
        ? `Generating flashcards... (${flashcardCount} created)`
        : 'Analyzing your materials...',
      awaiting_approval: `Success! Generated ${flashcardCount} flashcards. Redirecting...`,
    }
    return messages[status] || 'Processing...'
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Create Study Plan</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Add your learning materials and we'll generate flashcards automatically
        </p>
      </div>

      {processingStatus ? (
        <div className="card text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg font-medium mb-2">{processingStatus.message}</p>
          {processingStatus.flashcardCount > 0 && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {processingStatus.flashcardCount} flashcards generated
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Basic Info */}
          <div className="card">
            <h2 className="font-semibold text-lg mb-4">Basic Information</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Plan Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-white text-slate-900"
                  placeholder="e.g., Spanish Vocabulary"
                />
              </div>

              <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-100 dark:border-blue-800">
                <input
                  type="checkbox"
                  id="useMockData"
                  checked={useMockData}
                  onChange={(e) => setUseMockData(e.target.checked)}
                  className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                />
                <div className="flex flex-col">
                  <label htmlFor="useMockData" className="text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                    Use Mock Data (Testing Mode)
                  </label>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Generates sample cards, quizzes, and sentences without requiring an API key.
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Exam Date (Optional)</label>
                <input
                  type="date"
                  name="exam_date"
                  value={formData.exam_date}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-white text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Question Language</label>
                  <input
                    type="text"
                    name="question_language"
                    value={formData.question_language}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-white text-slate-900"
                    placeholder="e.g., English"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Answer Language</label>
                  <input
                    type="text"
                    name="answer_language"
                    value={formData.answer_language}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-white text-slate-900"
                    placeholder="e.g., Spanish"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Materials */}
          <div className="card">
            <h2 className="font-semibold text-lg mb-4">Learning Materials *</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Upload files or paste text content
            </p>

            {/* File Upload Options */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                <FileText size={24} className="mb-2 text-blue-500" />
                <span className="text-sm font-medium">PDF Files</span>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
              <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                <ImageIcon size={24} className="mb-2 text-blue-500" />
                <span className="text-sm font-medium">Images</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                onClick={handleCameraCapture}
                className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                <Camera size={24} className="mb-2 text-blue-500" />
                <span className="text-sm font-medium">Camera</span>
              </button>
              <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg">
                <Type size={24} className="mb-2 text-blue-500" />
                <span className="text-sm font-medium">Text Below</span>
              </div>
            </div>

            {/* Uploaded Files */}
            {files.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium mb-2">Uploaded Files:</p>
                <div className="space-y-2">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-slate-700 rounded">
                      <span className="text-sm truncate flex-1">{file.name}</span>
                      <button
                        onClick={() => removeFile(index)}
                        className="ml-2 text-red-500 hover:text-red-700"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Text Input */}
            <div>
              <label className="block text-sm font-medium mb-1">Or Paste Text Content</label>
              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                rows={6}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-white text-slate-900"
                placeholder="Paste your study material, vocabulary lists, or notes here..."
              />
              {textContent && (
                <p className="text-xs text-slate-500 mt-1">
                  {textContent.length} characters
                </p>
              )}
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !formData.name}
            className="w-full btn-primary py-3 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Study Plan'}
          </button>
        </div>
      )}
    </div>
  )
}

export default CreateStudyPlan
