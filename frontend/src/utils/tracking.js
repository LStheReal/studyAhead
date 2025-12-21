import api from '../services/api';

export const logStudyActivity = async (planId, mode, flashcardId, isCorrect, responseTimeMs, attempts = 1) => {
    try {
        await api.post('/tracking/log', {
            study_plan_id: parseInt(planId),
            mode: mode,
            flashcard_id: flashcardId,
            is_correct: isCorrect,
            response_time_ms: responseTimeMs,
            attempts_needed: attempts
        });
    } catch (error) {
        console.error("Failed to log study activity:", error);
        // Fail silently so we don't disrupt user experience
    }
};
