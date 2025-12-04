import json
from typing import List, Dict, Any
import random

class MockAIService:
    def extract_text_from_image(self, image_bytes: bytes) -> str:
        """Mock text extraction."""
        return "This is mock extracted text from the image. It contains information about apples, books, and computers."

    def analyze_material(self, text: str) -> Dict[str, Any]:
        """Mock material analysis."""
        return {
            "summary": "This is a mock summary of the material. It covers basic vocabulary topics.",
            "topics": ["Fruit", "Education", "Technology"],
            "difficulty": "Beginner",
            "estimated_study_time_minutes": 15
        }

    def generate_vocabulary_flashcards(self, text: str, num_cards: int = 10) -> List[Dict[str, str]]:
        """Generate mock vocabulary flashcards."""
        mock_vocab = [
            {"front": "Apple", "back": "Manzana", "difficulty": "Easy"},
            {"front": "Book", "back": "Libro", "difficulty": "Easy"},
            {"front": "Computer", "back": "Computadora", "difficulty": "Medium"},
            {"front": "House", "back": "Casa", "difficulty": "Easy"},
            {"front": "Dog", "back": "Perro", "difficulty": "Easy"},
            {"front": "Cat", "back": "Gato", "difficulty": "Easy"},
            {"front": "Water", "back": "Agua", "difficulty": "Easy"},
            {"front": "Sun", "back": "Sol", "difficulty": "Easy"},
            {"front": "Moon", "back": "Luna", "difficulty": "Easy"},
            {"front": "Tree", "back": "Árbol", "difficulty": "Medium"},
            {"front": "Car", "back": "Coche", "difficulty": "Medium"},
            {"front": "Friend", "back": "Amigo", "difficulty": "Easy"},
            {"front": "School", "back": "Escuela", "difficulty": "Medium"},
            {"front": "Teacher", "back": "Maestro", "difficulty": "Medium"},
            {"front": "Student", "back": "Estudiante", "difficulty": "Medium"}
        ]
        # Return unique cards up to num_cards
        return mock_vocab[:num_cards]

    def generate_mcq_questions(self, context: Dict[str, str], question_lang: str, answer_lang: str) -> List[Dict[str, Any]]:
        """Generate mock MCQ questions - returns 3 questions."""
        front = context.get("front_text", "Term")
        back = context.get("back_text", "Definition")
        
        return [
            {
                "question_text": f"What is the translation of '{front}'?",
                "options": [back, "Wrong1", "Wrong2", "Wrong3"],
                "correct_answer_index": 0,
                "rationale": f"'{front}' translates to '{back}'.",
                "question_type": "translation"
            },
            {
                "question_text": f"Which word means '{back}'?",
                "options": ["Wrong1", front, "Wrong2", "Wrong3"],
                "correct_answer_index": 1,
                "rationale": f"'{back}' means '{front}'.",
                "question_type": "reverse_translation"
            },
            {
                "question_text": f"Complete: I need to say '{front}' in {answer_lang}.",
                "options": ["Wrong1", "Wrong2", back, "Wrong3"],
                "correct_answer_index": 2,
                "rationale": f"The correct answer is '{back}'.",
                "question_type": "context"
            }
        ]

    def generate_vocabulary_sentences(self, front: str, back: str) -> List[Dict[str, Any]]:
        """Generate mock vocabulary sentence with highlighting - returns 1 sentence."""
        # Generate one example sentence with the vocabulary word highlighted
        sent_text = f"I use {front} every day."
        start = sent_text.find(front)
        
        return [{
            "sentence_text": sent_text,
            "highlighted_words": [{"start_index": start, "end_index": start + len(front)}]
        }]

mock_ai_service = MockAIService()
