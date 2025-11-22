from typing import List, Dict, Any, Optional
from openai import OpenAI
from app.config import settings
import json

class AIService:
    """Abstraction layer for AI services. Can be swapped by changing API key."""
    
    def __init__(self):
        self.client = OpenAI(api_key=settings.openai_api_key)
        self.model = settings.openai_model
    
    def analyze_material(
        self, 
        content: str, 
        material_type: str = "text"
    ) -> Dict[str, Any]:
        """Analyze uploaded material and categorize it."""
        prompt = f"""Analyze the following study material and provide a structured analysis.

Material:
{content[:8000]}  # Limit content size

Provide a JSON response with the following structure:
{{
    "category": "vocabulary" | "grammar_math_logic" | "facts" | "other",
    "title": "Brief descriptive title",
    "main_topics": ["topic1", "topic2", ...],
    "learning_goals": ["goal1", "goal2", ...],
    "recommended_study_approach": "Detailed approach description",
    "checklist_items": ["item1", "item2", ...],
    "content_structure": {{"hierarchical": "structure"}},
    "difficulty_assessment": "easy" | "medium" | "hard"
}}

Be thorough and accurate. For vocabulary materials, identify language pairs if present."""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are an expert educational content analyzer. Always respond with valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        
        return json.loads(response.choices[0].message.content)
    
    def generate_flashcards(
        self, 
        material_summary: Dict[str, Any],
        count: int = 30
    ) -> List[Dict[str, Any]]:
        """Generate flashcards from material summary."""
        category = material_summary.get("category", "other")
        
        if category == "vocabulary":
            prompt = f"""Generate {count} vocabulary flashcards from this material:

Title: {material_summary.get('title', '')}
Topics: {', '.join(material_summary.get('main_topics', []))}

For each flashcard, provide:
- front_text: Word/phrase in question language
- back_text: Translation/definition in answer language
- difficulty: easy, medium, or hard

Return JSON array:
[
    {{
        "front_text": "...",
        "back_text": "...",
        "difficulty": "medium"
    }},
    ...
]"""
        else:
            prompt = f"""Generate {count} flashcards from this material:

Title: {material_summary.get('title', '')}
Topics: {', '.join(material_summary.get('main_topics', []))}
Category: {category}

For each flashcard, create question-answer pairs:
- front_text: Question or concept
- back_text: Answer or explanation
- difficulty: easy, medium, or hard

Return JSON array:
[
    {{
        "front_text": "...",
        "back_text": "...",
        "difficulty": "medium"
    }},
    ...
]"""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are an expert at creating educational flashcards. Always respond with valid JSON arrays."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.5,
            response_format={"type": "json_object"}
        )
        
        result = json.loads(response.choices[0].message.content)
        return result.get("flashcards", []) if isinstance(result, dict) else result
    
    def generate_vocabulary_sentences(
        self,
        flashcard_front: str,
        flashcard_back: str,
        target_language: str = "question"
    ) -> List[Dict[str, Any]]:
        """Generate 3 example sentences for vocabulary flashcards."""
        prompt = f"""Generate 3 example sentences using this vocabulary word:

Word: {flashcard_front}
Translation: {flashcard_back}
Target Language: {target_language}

For each sentence:
- sentence_text: The complete sentence
- highlighted_words: Array of {{"word": "...", "start_index": 0, "end_index": 5}}

Return JSON:
{{
    "sentences": [
        {{
            "sentence_text": "...",
            "highlighted_words": [{{"word": "...", "start_index": 0, "end_index": 5}}]
        }},
        ...
    ]
}}"""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are an expert at creating example sentences for language learning. Always respond with valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            response_format={"type": "json_object"}
        )
        
        result = json.loads(response.choices[0].message.content)
        return result.get("sentences", [])
    
    def generate_mcq_questions(
        self,
        flashcard: Dict[str, Any],
        question_language: str,
        answer_language: str
    ) -> List[Dict[str, Any]]:
        """Generate 3 MCQ questions per flashcard (standard, reverse, creative)."""
        front = flashcard.get("front_text", "")
        back = flashcard.get("back_text", "")
        
        prompt = f"""Generate 3 multiple-choice questions for this vocabulary:

Front: {front} ({question_language})
Back: {back} ({answer_language})

Create 3 question types:
1. Standard: Translate from {question_language} to {answer_language}
2. Reverse: Translate from {answer_language} to {question_language}
3. Creative: Contextual usage or synonym question

For each question:
- question_text: The question
- options: Array of 4 answer choices [A, B, C, D]
- correct_answer_index: 0-3 (index of correct answer)
- rationale: Brief explanation
- question_type: "standard", "reverse", or "creative"

Return JSON:
{{
    "questions": [
        {{
            "question_text": "...",
            "options": ["A", "B", "C", "D"],
            "correct_answer_index": 0,
            "rationale": "...",
            "question_type": "standard"
        }},
        ...
    ]
}}"""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are an expert at creating educational multiple-choice questions. Always respond with valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.6,
            response_format={"type": "json_object"}
        )
        
        result = json.loads(response.choices[0].message.content)
        return result.get("questions", [])
    
    def generate_study_schedule(
        self,
        study_plan: Dict[str, Any],
        flashcards: List[Dict[str, Any]],
        user_preferences: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Generate adaptive study schedule."""
        exam_date = study_plan.get("exam_date")
        learning_speed = user_preferences.get("learning_speed", "moderate")
        study_hours = user_preferences.get("study_hours_per_week", 10)
        flashcard_count = len(flashcards)
        
        prompt = f"""Create a daily study schedule for exam preparation:

Study Plan: {study_plan.get('name', '')}
Exam Date: {exam_date}
Flashcards: {flashcard_count} cards
Learning Speed: {learning_speed}
Study Hours/Week: {study_hours}

Generate tasks distributed from today until exam date. Include:
- flashcard_review sessions
- multiple_choice_quiz
- matching_game
- writing_practice
- fill_the_gap (for vocabulary)
- short_test
- comprehensive_test

For each task:
- title: Descriptive title
- type: Task type
- mode: Study mode
- estimated_minutes: Time estimate
- day_number: Day in schedule (1, 2, 3...)
- rationale: Why this task now
- order: Order within the day

Use spaced repetition principles. Balance different modes.

Return JSON:
{{
    "tasks": [
        {{
            "title": "...",
            "type": "flashcard_review",
            "mode": "learn",
            "estimated_minutes": 20,
            "day_number": 1,
            "rationale": "...",
            "order": 0
        }},
        ...
    ]
}}"""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are an expert at creating adaptive study schedules with spaced repetition. Always respond with valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.4,
            response_format={"type": "json_object"}
        )
        
        result = json.loads(response.choices[0].message.content)
        return result.get("tasks", [])
    
    def extract_text_from_image(self, image_path: str) -> str:
        """Extract text from image using vision API."""
        import base64
        
        with open(image_path, "rb") as image_file:
            image_data = base64.b64encode(image_file.read()).decode('utf-8')
            
            # Determine image format
            image_ext = image_path.lower().split('.')[-1]
            mime_type = f"image/{image_ext}" if image_ext in ['jpg', 'jpeg', 'png'] else "image/jpeg"
            
            response = self.client.chat.completions.create(
                model="gpt-4-vision-preview",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": "Extract all text from this image. Preserve structure and formatting. If there are handwritten notes, transcribe them accurately."
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{mime_type};base64,{image_data}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=4000
            )
        
        return response.choices[0].message.content
    
    def process_pdf_content(self, pdf_text: str) -> Dict[str, Any]:
        """Process PDF content and extract structured information."""
        prompt = f"""Process this PDF content and extract:

{pdf_text[:12000]}

Provide:
- Executive summary (100-150 words)
- Key takeaways (5-8 bullet points)
- Glossary (8-12 important terms with definitions)
- Suggested flashcards (8-12 Q&A pairs)
- Multiple-choice questions (4-6 with rationales)

Return JSON:
{{
    "summary": "...",
    "key_takeaways": ["...", ...],
    "glossary": [{{"term": "...", "definition": "..."}}, ...],
    "flashcards": [{{"front_text": "...", "back_text": "..."}}, ...],
    "mcq_questions": [{{"question": "...", "options": [...], "correct": 0, "rationale": "..."}}, ...]
}}"""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are an expert at processing educational content. Always respond with valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        
        return json.loads(response.choices[0].message.content)

# Global instance
ai_service = AIService()

