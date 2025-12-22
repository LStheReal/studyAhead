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
            "category": "vocabulary",
            "summary": "This is a mock summary of the material. It covers basic vocabulary topics.",
            "topics": ["Fruit", "Education", "Technology"],
            "difficulty": "Beginner",
            "estimated_study_time_minutes": 15,
            "detected_languages": ["English", "German"],
            "flashcards": [
                {"front": "Apple", "back": "Apfel", "difficulty": "easy"},
                {"front": "Book", "back": "Buch", "difficulty": "easy"}
            ]
        }

    def generate_vocabulary_flashcards(self, text: str, num_cards: int = 20) -> List[Dict[str, str]]:
        """Generate mock vocabulary flashcards."""
        mock_vocab = [
            {"front_text": "Apple", "back_text": "Apfel", "difficulty": "Easy"},
            {"front_text": "Book", "back_text": "Buch", "difficulty": "Easy"},
            {"front_text": "Computer", "back_text": "Computer", "difficulty": "Medium"},
            {"front_text": "House", "back_text": "Haus", "difficulty": "Easy"},
            {"front_text": "Dog", "back_text": "Hund", "difficulty": "Easy"},
            {"front_text": "Cat", "back_text": "Katze", "difficulty": "Easy"},
            {"front_text": "Water", "back_text": "Wasser", "difficulty": "Easy"},
            {"front_text": "Sun", "back_text": "Sonne", "difficulty": "Easy"},
            {"front_text": "Moon", "back_text": "Mond", "difficulty": "Easy"},
            {"front_text": "Tree", "back_text": "Baum", "difficulty": "Medium"},
            {"front_text": "Car", "back_text": "Auto", "difficulty": "Medium"},
            {"front_text": "Friend", "back_text": "Freund", "difficulty": "Easy"},
            {"front_text": "School", "back_text": "Schule", "difficulty": "Medium"},
            {"front_text": "Teacher", "back_text": "Lehrer", "difficulty": "Medium"},
            {"front_text": "Student", "back_text": "Schüler", "difficulty": "Medium"},
            {"front_text": "Coffee", "back_text": "Kaffee", "difficulty": "Easy"},
            {"front_text": "Bread", "back_text": "Brot", "difficulty": "Easy"},
            {"front_text": "Milk", "back_text": "Milch", "difficulty": "Easy"},
            {"front_text": "Cheese", "back_text": "Käse", "difficulty": "Medium"},
            {"front_text": "Time", "back_text": "Zeit", "difficulty": "Abstract"}
        ]
        # Return at least num_cards if possible, or all available
        return mock_vocab[:max(num_cards, 15)]

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
                "question_type": "standard"
            },
            {
                "question_text": f"Which word means '{back}'?",
                "options": ["Wrong1", front, "Wrong2", "Wrong3"],
                "correct_answer_index": 1,
                "rationale": f"'{back}' means '{front}'.",
                "question_type": "reverse"
            },
            {
                "question_text": f"Complete: I need to say '{front}' in {answer_lang}.",
                "options": ["Wrong1", "Wrong2", back, "Wrong3"],
                "correct_answer_index": 2,
                "rationale": f"The correct answer is '{back}'.",
                "question_type": "creative"
            }
        ]

    def generate_vocabulary_sentences(self, front: str, back: str) -> List[Dict[str, Any]]:
        """Generate mock vocabulary sentence with highlighting - returns 1 sentence."""
        templates = [
            "I see a {word}.",
            "The {word} is very interesting.",
            "Do you like the {word}?",
            "I do not have a {word}.",
            "Where is the {word}?"
        ]
        
        # Simple German-ish mock sentences if back_text looks German (optional, but good for context)
        # But we generate sentences in TARGET language usually?
        # ai_service.py line 301 says: "Generate example sentences in target language"
        # Since we changed mock to English->German (Apple->Apfel), 
        # front_text is English, back_text is German.
        # If the target language is German, we should use back_text.
        # Let's check how it's called.
        # In `ai_service.generate_vocabulary_sentences`, we pass `front_text`, `back_text`, `target_language`.
        # Usually target language is the one we are learning (back_text).
        
        # Let's assume we want sentences in the foreign language (back_text).
        target_word = back
        
        # Pick a random template and replace {word} with target_word
        import random
        template = random.choice(templates)
        
        # VERY BASIC "German" templates (Mock only)
        german_templates = [
            "Das ist ein {word}.",
            "Ich habe kein {word}.",
            "Wo ist das {word}?",
            "Ich mag das {word}.",
            "Hier ist ein {word}."
        ]
        
        # Use German templates if it looks like we switched to German (from previous step)
        # Or just mix them.
        template = random.choice(german_templates)
        
        sent_text = template.replace("{word}", target_word)
        start = sent_text.find(target_word)
        
        return [{
            "sentence_text": sent_text,
            "highlighted_words": [{"start_index": start, "end_index": start + len(target_word)}]
        }]

mock_ai_service = MockAIService()
