import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { FaGraduationCap, FaClock, FaBookOpen, FaGlobe, FaBrain, FaCheck } from 'react-icons/fa';

const Onboarding = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        learning_speed: 'moderate',
        preferred_study_modes: [],
        favorite_subjects: [],
        school_language: 'English',
        study_hours_per_week: 10,
        study_time_preference: 'afternoon'
    });

    const [subjectInput, setSubjectInput] = useState('');

    const containerVariants = {
        hidden: { opacity: 0, x: 50 },
        visible: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -50 }
    };

    const handleModeToggle = (mode) => {
        setFormData(prev => {
            if (prev.preferred_study_modes.includes(mode)) {
                return { ...prev, preferred_study_modes: prev.preferred_study_modes.filter(m => m !== mode) };
            } else {
                return { ...prev, preferred_study_modes: [...prev.preferred_study_modes, mode] };
            }
        });
    };

    const handleSubjectAdd = (e) => {
        if (e.key === 'Enter' && subjectInput.trim()) {
            if (!formData.favorite_subjects.includes(subjectInput.trim())) {
                setFormData(prev => ({ ...prev, favorite_subjects: [...prev.favorite_subjects, subjectInput.trim()] }));
            }
            setSubjectInput('');
        }
    };

    const removeSubject = (sub) => {
        setFormData(prev => ({ ...prev, favorite_subjects: prev.favorite_subjects.filter(s => s !== sub) }));
    };

    const { fetchUser } = useAuth();

    const handleSubmit = async () => {
        setLoading(true);
        try {
            await api.post('/users/onboarding', formData);

            // Refresh user state to get updated onboarding_completed flag
            await fetchUser();

            // Navigate to dashboard
            navigate('/');
        } catch (error) {
            console.error('Error:', error);
            alert(`Onboarding failed: ${error.response?.data?.detail || error.message}. Please try again.`);
        } finally {
            setLoading(false);
        }
    };

    const nextStep = () => setStep(prev => prev + 1);
    const prevStep = () => setStep(prev => prev - 1);

    const questions = [
        // Step 0: Welcome
        {
            title: "Welcome to StudyAhead AI",
            subtitle: "Let's personalize your learning experience in 2 minutes.",
            icon: <FaBrain className="text-6xl text-purple-500 mb-4" />,
            content: (
                <div className="text-center">
                    <p className="text-gray-600 mb-8">
                        We'll adapt every study plan to your unique learning style, speed, and goals.
                    </p>
                    <button
                        onClick={nextStep}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transform transition hover:scale-105"
                    >
                        Get Started
                    </button>
                </div>
            )
        },
        // Step 1: Learning Speed
        {
            title: "How fast do you learn?",
            subtitle: "This helps us schedule the right amount of daily work.",
            icon: <FaClock className="text-4xl text-blue-500 mb-4" />,
            content: (
                <div className="space-y-4">
                    {['slow', 'moderate', 'fast'].map((speed) => (
                        <button
                            key={speed}
                            onClick={() => setFormData({ ...formData, learning_speed: speed })}
                            className={`w-full p-4 rounded-xl border-2 flex items-center justify-between transition-all ${formData.learning_speed === speed
                                ? 'border-purple-500 bg-purple-50 text-purple-700'
                                : 'border-gray-200 hover:border-purple-200'
                                }`}
                        >
                            <span className="capitalize font-medium text-lg">{speed}</span>
                            {formData.learning_speed === speed && <FaCheck className="text-purple-500" />}
                        </button>
                    ))}
                    <div className="mt-8 flex justify-end">
                        <button onClick={nextStep} className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700">Next</button>
                    </div>
                </div>
            )
        },
        // Step 2: Preferred Modes
        {
            title: "How do you like to study?",
            subtitle: "Select all that apply. We'll prioritize these.",
            icon: <FaGraduationCap className="text-4xl text-green-500 mb-4" />,
            content: (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        {[
                            { id: 'quiz', label: 'Quiz Mode', desc: 'Fast paced questions' },
                            { id: 'flashcards', label: 'Flashcards', desc: 'Typical flip cards' },
                            { id: 'match', label: 'Matching', desc: 'Connect terms' },
                            { id: 'write', label: 'Writing', desc: 'Type answers out' },
                            { id: 'game', label: 'Games', desc: 'Fun learning' }, // Assuming 'game' maps to something generic or specific later
                        ].map((mode) => (
                            <button
                                key={mode.id}
                                onClick={() => handleModeToggle(mode.id)}
                                className={`p-4 rounded-xl border-2 text-left transition-all ${formData.preferred_study_modes.includes(mode.id)
                                    ? 'border-purple-500 bg-purple-50'
                                    : 'border-gray-200 hover:border-purple-200'
                                    }`}
                            >
                                <div className="font-semibold">{mode.label}</div>
                                <div className="text-xs text-gray-500">{mode.desc}</div>
                            </button>
                        ))}
                    </div>
                    <div className="flex justify-between">
                        <button onClick={prevStep} className="text-gray-500 hover:text-gray-700">Back</button>
                        <button
                            onClick={nextStep}
                            disabled={formData.preferred_study_modes.length === 0}
                            className={`px-6 py-2 rounded-lg ${formData.preferred_study_modes.length === 0 ? 'bg-gray-300' : 'bg-purple-600 hover:bg-purple-700 text-white'}`}
                        >
                            Next
                        </button>
                    </div>
                </div>
            )
        },
        // Step 3: Favorite Subjects
        {
            title: "What are your strong subjects?",
            subtitle: "We'll challenge you more in these areas.",
            icon: <FaBookOpen className="text-4xl text-yellow-500 mb-4" />,
            content: (
                <div className="space-y-6">
                    <div>
                        <input
                            type="text"
                            value={subjectInput}
                            onChange={(e) => setSubjectInput(e.target.value)}
                            onKeyDown={handleSubjectAdd}
                            placeholder="Type subject and press Enter (e.g., Math, Spanish)"
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                        />
                    </div>
                    <div className="flex flex-wrap gap-2 min-h-[100px]">
                        {formData.favorite_subjects.map((sub, idx) => (
                            <span key={idx} className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full flex items-center gap-2">
                                {sub}
                                <button onClick={() => removeSubject(sub)} className="hover:text-purple-900">×</button>
                            </span>
                        ))}
                        {formData.favorite_subjects.length === 0 && (
                            <span className="text-gray-400 italic">No subjects added yet...</span>
                        )}
                    </div>
                    <div className="flex justify-between">
                        <button onClick={prevStep} className="text-gray-500 hover:text-gray-700">Back</button>
                        <button onClick={nextStep} className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700">Next</button>
                    </div>
                </div>
            )
        },
        // Step 4: Time & Logistics
        {
            title: "Study Habits",
            subtitle: "When and how much do you want to study?",
            icon: <FaGlobe className="text-4xl text-indigo-500 mb-4" />,
            content: (
                <div className="space-y-8">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Hours per week: <span className="text-purple-600 font-bold">{formData.study_hours_per_week}h</span>
                        </label>
                        <input
                            type="range"
                            min="1"
                            max="40"
                            value={formData.study_hours_per_week}
                            onChange={(e) => setFormData({ ...formData, study_hours_per_week: parseInt(e.target.value) })}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Time of Day</label>
                        <div className="grid grid-cols-4 gap-2">
                            {['morning', 'afternoon', 'evening', 'night'].map((time) => (
                                <button
                                    key={time}
                                    onClick={() => setFormData({ ...formData, study_time_preference: time })}
                                    className={`p-2 rounded-lg border text-sm capitalize ${formData.study_time_preference === time
                                        ? 'bg-purple-600 text-white border-purple-600'
                                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                                        }`}
                                >
                                    {time}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">School Language</label>
                        <select
                            value={formData.school_language}
                            onChange={(e) => setFormData({ ...formData, school_language: e.target.value })}
                            className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:border-purple-500"
                        >
                            <option value="English">English</option>
                            <option value="Spanish">Spanish</option>
                            <option value="German">German</option>
                            <option value="French">French</option>
                        </select>
                    </div>

                    <div className="flex justify-between pt-4">
                        <button onClick={prevStep} className="text-gray-500 hover:text-gray-700">Back</button>
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="bg-purple-600 text-white px-8 py-3 rounded-lg hover:bg-purple-700 font-semibold shadow-lg disabled:opacity-50"
                        >
                            {loading ? 'Creating Profile...' : 'Complete & Start'}
                        </button>
                    </div>
                </div>
            )
        }
    ];

    const currentQ = questions[step];

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
            <motion.div
                className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-lg min-h-[500px] flex flex-col relative overflow-hidden"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                {/* Progress Bar */}
                {step > 0 && (
                    <div className="absolute top-0 left-0 w-full h-2 bg-gray-100">
                        <motion.div
                            className="h-full bg-purple-600"
                            initial={{ width: 0 }}
                            animate={{ width: `${((step) / (questions.length - 1)) * 100}%` }}
                        />
                    </div>
                )}

                <div className="flex-1 flex flex-col items-center justify-center">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={step}
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className="w-full"
                        >
                            <div className="text-center mb-8">
                                <div className="flex justify-center">{currentQ.icon}</div>
                                <h1 className="text-2xl font-bold text-gray-800 mb-2">{currentQ.title}</h1>
                                <p className="text-gray-500">{currentQ.subtitle}</p>
                            </div>

                            {currentQ.content}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Step indicators */}
                <div className="flex justify-center gap-2 mt-8">
                    {questions.map((_, idx) => (
                        <div
                            key={idx}
                            className={`h-2 w-2 rounded-full transition-all ${idx === step ? 'bg-purple-600 w-6' : 'bg-gray-300'
                                }`}
                        />
                    ))}
                </div>
            </motion.div>
        </div>
    );
};

export default Onboarding;
