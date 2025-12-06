import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { ArrowLeft, Plus, Trash2, Save, AlertCircle } from 'lucide-react'

const EditPlan = () => {
    const { id } = useParams()
    const navigate = useNavigate()
    const [plan, setPlan] = useState(null)
    const [flashcards, setFlashcards] = useState([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
    const [showUnsavedWarning, setShowUnsavedWarning] = useState(false)
    const [showSuccessPopup, setShowSuccessPopup] = useState(false)
    const [pendingNavigation, setPendingNavigation] = useState(null)

    useEffect(() => {
        fetchPlanData()
    }, [id])

    // Handle browser back button and navigation
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (hasUnsavedChanges) {
                e.preventDefault()
                e.returnValue = ''
            }
        }

        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }, [hasUnsavedChanges])

    const fetchPlanData = async () => {
        try {
            const [planRes, flashcardsRes] = await Promise.all([
                api.get(`/study-plans/${id}`),
                api.get(`/flashcards/study-plan/${id}`)
            ])
            setPlan(planRes.data)
            setFlashcards(flashcardsRes.data.map(card => ({
                ...card,
                isNew: false,
                isDeleted: false
            })))
        } catch (error) {
            console.error('Failed to fetch plan data:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleCardChange = (index, field, value) => {
        const updatedCards = [...flashcards]
        updatedCards[index] = {
            ...updatedCards[index],
            [field]: value,
            isModified: !updatedCards[index].isNew
        }
        setFlashcards(updatedCards)
        setHasUnsavedChanges(true)
    }

    const handleAddCard = () => {
        const newCard = {
            id: `temp-${Date.now()}`,
            front_text: '',
            back_text: '',
            isNew: true,
            isDeleted: false
        }
        setFlashcards([...flashcards, newCard])
        setHasUnsavedChanges(true)
    }

    const handleDeleteCard = (index) => {
        const updatedCards = [...flashcards]
        if (updatedCards[index].isNew) {
            // Remove new cards immediately
            updatedCards.splice(index, 1)
        } else {
            // Mark existing cards for deletion
            updatedCards[index].isDeleted = true
        }
        setFlashcards(updatedCards)
        setHasUnsavedChanges(true)
    }

    const handleSaveAll = async () => {
        setSaving(true)
        try {
            const operations = []

            // Update existing cards
            flashcards.forEach(card => {
                if (card.isModified && !card.isNew && !card.isDeleted) {
                    operations.push(
                        api.put(`/flashcards/${card.id}`, {
                            front_text: card.front_text,
                            back_text: card.back_text
                        })
                    )
                }
            })

            // Create new cards
            flashcards.forEach(card => {
                if (card.isNew && !card.isDeleted && card.front_text && card.back_text) {
                    operations.push(
                        api.post(`/flashcards/study-plan/${id}`, {
                            front_text: card.front_text,
                            back_text: card.back_text,
                            difficulty: 'medium'
                        })
                    )
                }
            })

            // Delete cards
            flashcards.forEach(card => {
                if (card.isDeleted && !card.isNew) {
                    operations.push(api.delete(`/flashcards/${card.id}`))
                }
            })

            await Promise.all(operations)

            setHasUnsavedChanges(false)
            setShowSuccessPopup(true)

            // Navigate back after showing success message
            setTimeout(() => {
                navigate(`/plans/${id}`)
            }, 1500)
        } catch (error) {
            console.error('Failed to save changes:', error)
            alert('Failed to save changes. Please try again.')
        } finally {
            setSaving(false)
        }
    }

    const handleBack = () => {
        if (hasUnsavedChanges) {
            setPendingNavigation(`/plans/${id}`)
            setShowUnsavedWarning(true)
        } else {
            navigate(`/plans/${id}`)
        }
    }

    const confirmLeave = () => {
        setShowUnsavedWarning(false)
        if (pendingNavigation) {
            navigate(pendingNavigation)
        }
    }

    const cancelLeave = () => {
        setShowUnsavedWarning(false)
        setPendingNavigation(null)
    }

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

    const visibleCards = flashcards.filter(card => !card.isDeleted)

    return (
        <div className="p-4 space-y-6 max-w-5xl mx-auto">
            {/* Unsaved Changes Warning Modal */}
            {showUnsavedWarning && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="card max-w-md w-full p-6">
                        <div className="flex items-start gap-3 mb-4">
                            <AlertCircle className="text-yellow-500 flex-shrink-0" size={24} />
                            <div>
                                <h3 className="text-xl font-bold mb-2">Unsaved Changes</h3>
                                <p className="text-slate-600 dark:text-slate-400">
                                    Are you sure you want to leave without saving? All your changes will be lost.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={cancelLeave}
                                className="flex-1 btn-secondary"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmLeave}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                            >
                                Leave Without Saving
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Success Popup */}
            {showSuccessPopup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="card max-w-md w-full p-6 text-center">
                        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Save className="text-green-600 dark:text-green-400" size={32} />
                        </div>
                        <h3 className="text-xl font-bold mb-2">Changes Saved!</h3>
                        <p className="text-slate-600 dark:text-slate-400">
                            Your flashcards have been updated successfully.
                        </p>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={handleBack}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
                >
                    <ArrowLeft size={24} />
                </button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold">Edit Flashcards</h1>
                    <p className="text-slate-600 dark:text-slate-400">{plan.name}</p>
                </div>
            </div>

            {/* Flashcards List */}
            <div className="card">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-lg">
                        Flashcards ({visibleCards.length})
                    </h2>
                    <button
                        onClick={handleAddCard}
                        className="btn-secondary flex items-center gap-2"
                    >
                        <Plus size={16} />
                        Add New Card
                    </button>
                </div>

                {visibleCards.length > 0 ? (
                    <div className="space-y-4">
                        {visibleCards.map((card, index) => {
                            const actualIndex = flashcards.indexOf(card)
                            return (
                                <div
                                    key={card.id}
                                    className="p-4 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700"
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-sm font-medium">
                                            {index + 1}
                                        </div>
                                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
                                                    Front (Term)
                                                </label>
                                                <textarea
                                                    value={card.front_text}
                                                    onChange={(e) => handleCardChange(actualIndex, 'front_text', e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                                    rows="3"
                                                    placeholder="Enter term or question..."
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
                                                    Back (Definition)
                                                </label>
                                                <textarea
                                                    value={card.back_text}
                                                    onChange={(e) => handleCardChange(actualIndex, 'back_text', e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                                    rows="3"
                                                    placeholder="Enter definition or answer..."
                                                />
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteCard(actualIndex)}
                                            className="flex-shrink-0 p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                            title="Delete card"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                        <p>No flashcards yet. Click "Add New Card" to get started.</p>
                    </div>
                )}
            </div>

            {/* Save Button */}
            <div className="sticky bottom-4 flex justify-end">
                <button
                    onClick={handleSaveAll}
                    disabled={!hasUnsavedChanges || saving}
                    className="btn-primary flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Save size={20} />
                    {saving ? 'Saving...' : 'Save All Changes'}
                </button>
            </div>
        </div>
    )
}

export default EditPlan
