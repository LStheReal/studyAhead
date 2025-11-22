import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { Upload, X, FileText, Image as ImageIcon, Type, Camera } from 'lucide-react'

const CreateStudyPlan = () => {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    name: '',
    type: 'complete_test',
    exam_date: '',
    learning_objectives: '',
    question_language: '',
    answer_language: '',
  })
  const [files, setFiles] = useState([])
  const [textContent, setTextContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [planId, setPlanId] = useState(null)
  const [processingStatus, setProcessingStatus] = useState(null)

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
    // Create file input with camera capture
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

  const handleCreatePlan = async () => {
    if (!formData.name) {
      alert('Please enter a study plan name')
      return
    }

    setLoading(true)
    try {
      const planData = {
        ...formData,
        exam_date: formData.exam_date || null,
      }
      const response = await api.post('/study-plans/', planData)
      setPlanId(response.data.id)
      setStep(2)
    } catch (error) {
      alert('Failed to create study plan: ' + (error.response?.data?.detail || error.message))
    } finally {
      setLoading(false)
    }
  }

  const handleUploadMaterials = async () => {
    if (files.length === 0 && !textContent.trim()) {
      alert('Please upload files or paste text content')
      return
    }

    setLoading(true)
    setProcessingStatus({ status: 'uploading', message: 'Uploading materials...' })

    try {
      const formData = new FormData()
      files.forEach((file) => {
        formData.append('files', file)
      })
      if (textContent.trim()) {
        formData.append('text_content', textContent)
      }

      const formDataToSend = new FormData()
      files.forEach((file) => {
        formDataToSend.append('files', file)
      })
      if (textContent.trim()) {
        formDataToSend.append('text_content', textContent)
      }

      await api.post(`/materials/upload?study_plan_id=${planId}`, formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      // Start polling for status
      pollProcessingStatus()
    } catch (error) {
      alert('Failed to upload materials: ' + (error.response?.data?.detail || error.message))
      setLoading(false)
      setProcessingStatus(null)
    }
  }

  const pollProcessingStatus = async () => {
    const interval = setInterval(async () => {
      try {
        const response = await api.get(`/materials/${planId}/status`)
        const status = response.data

        setProcessingStatus({
          status: status.status,
          message: getStatusMessage(status.status),
          hasSummary: status.has_summary,
          flashcardCount: status.flashcard_count,
        })

        if (status.status === 'awaiting_approval') {
          clearInterval(interval)
          setLoading(false)
          setStep(3)
        }
      } catch (error) {
        console.error('Failed to check status:', error)
        clearInterval(interval)
        setLoading(false)
      }
    }, 2000)
  }

  const getStatusMessage = (status) => {
    const messages = {
      generating: 'Analyzing your materials...',
      awaiting_approval: 'Materials processed! Review and approve to continue.',
    }
    return messages[status] || 'Processing...'
  }

  const handleApprove = async () => {
    setLoading(true)
    try {
      await api.post(`/study-plans/${planId}/approve`)
      setProcessingStatus({ status: 'generating', message: 'Generating study schedule...' })
      // Poll for schedule completion
      const interval = setInterval(async () => {
        try {
          const response = await api.get(`/study-plans/${planId}`)
          if (response.data.status === 'active') {
            clearInterval(interval)
            navigate(`/plans/${planId}`)
          }
        } catch (error) {
          clearInterval(interval)
          setLoading(false)
        }
      }, 2000)
    } catch (error) {
      alert('Failed to approve plan: ' + (error.response?.data?.detail || error.message))
      setLoading(false)
    }
  }

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold">Create Study Plan</h1>

      {/* Step 1: Plan Details */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="font-semibold text-lg mb-4">Plan Details</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Study Plan Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                  placeholder="e.g., Spanish Vocabulary Test"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Plan Type *</label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                >
                  <option value="complete_test">Complete Test Study Plan</option>
                  <option value="flashcard_set">Simple Flashcard Set</option>
                </select>
              </div>

              {formData.type === 'complete_test' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Exam Date</label>
                    <input
                      type="date"
                      name="exam_date"
                      value={formData.exam_date}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Learning Objectives (Optional)</label>
                    <textarea
                      name="learning_objectives"
                      value={formData.learning_objectives}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                      placeholder="What do you want to achieve?"
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Question Language</label>
                  <input
                    type="text"
                    name="question_language"
                    value={formData.question_language}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
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
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                    placeholder="e.g., Spanish"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleCreatePlan}
            disabled={loading || !formData.name}
            className="w-full btn-primary py-3 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Continue'}
          </button>
        </div>
      )}

      {/* Step 2: Upload Materials */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="font-semibold text-lg mb-4">Upload Materials</h2>

            {/* File Upload Options */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700">
                <FileText size={24} className="mb-2 text-blue-500" />
                <span className="text-sm">PDF</span>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
              <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700">
                <ImageIcon size={24} className="mb-2 text-blue-500" />
                <span className="text-sm">Images</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
              <button
                onClick={handleCameraCapture}
                className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                <Camera size={24} className="mb-2 text-blue-500" />
                <span className="text-sm">Camera</span>
              </button>
              <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700">
                <Type size={24} className="mb-2 text-blue-500" />
                <span className="text-sm">Text</span>
              </label>
            </div>

            {/* Selected Files */}
            {files.length > 0 && (
              <div className="space-y-2 mb-4">
                <h3 className="text-sm font-medium">Selected Files:</h3>
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-gray-50 dark:bg-slate-700 rounded"
                  >
                    <span className="text-sm truncate flex-1">{file.name}</span>
                    <button
                      onClick={() => removeFile(index)}
                      className="ml-2 text-red-500"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Text Input */}
            <div>
              <label className="block text-sm font-medium mb-1">Or Paste Text Content</label>
              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                rows={6}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                placeholder="Paste your study material here..."
              />
            </div>
          </div>

          {/* Processing Status */}
          {processingStatus && (
            <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                <div className="flex-1">
                  <div className="font-medium">{processingStatus.message}</div>
                  {processingStatus.flashcardCount > 0 && (
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      {processingStatus.flashcardCount} flashcards generated
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => setStep(1)}
              className="flex-1 btn-secondary"
            >
              Back
            </button>
            <button
              onClick={handleUploadMaterials}
              disabled={loading || (files.length === 0 && !textContent.trim())}
              className="flex-1 btn-primary disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Upload & Process'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review & Approve */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="font-semibold text-lg mb-4">Review Materials</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Your materials have been processed. Review the summary and flashcards, then approve to generate your study schedule.
            </p>
            <button
              onClick={() => navigate(`/plans/${planId}`)}
              className="btn-secondary mb-4"
            >
              Review Flashcards
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setStep(2)}
              className="flex-1 btn-secondary"
            >
              Back
            </button>
            <button
              onClick={handleApprove}
              disabled={loading}
              className="flex-1 btn-primary disabled:opacity-50"
            >
              {loading ? 'Generating Schedule...' : 'Approve & Generate Schedule'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default CreateStudyPlan

