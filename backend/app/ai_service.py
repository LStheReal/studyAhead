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

Return a JSON object with a "flashcards" array:
{{
    "flashcards": [
        {{
            "front_text": "...",
            "back_text": "...",
            "difficulty": "medium"
        }},
        ...
    ]
}}"""
        else:
            prompt = f"""Generate {count} flashcards from this material:

Title: {material_summary.get('title', '')}
Topics: {', '.join(material_summary.get('main_topics', []))}
Category: {category}

For each flashcard, create question-answer pairs:
- front_text: Question or concept
- back_text: Answer or explanation
- difficulty: easy, medium, or hard

Return a JSON object with a "flashcards" array:
{{
    "flashcards": [
        {{
            "front_text": "...",
            "back_text": "...",
            "difficulty": "medium"
        }},
        ...
    ]
}}"""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are an expert at creating educational flashcards. Always respond with valid JSON objects containing a 'flashcards' array."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.5,
            response_format={"type": "json_object"}
        )
        
        try:
            result = json.loads(response.choices[0].message.content)
            flashcards = result.get("flashcards", [])
            
            # Ensure we return a list
            if not isinstance(flashcards, list):
                print(f"Warning: Expected flashcards array, got {type(flashcards)}: {flashcards}")
                return []
            
            if len(flashcards) == 0:
                print(f"Warning: Empty flashcards array in AI response")
                return []
            
            print(f"Successfully generated {len(flashcards)} flashcards")
            return flashcards
        except json.JSONDecodeError as e:
            print(f"Error parsing AI response as JSON: {e}")
            print(f"Response content: {response.choices[0].message.content[:500]}")
            return []
        except Exception as e:
            print(f"Error processing flashcard generation response: {e}")
            import traceback
            print(traceback.format_exc())
            return []
    
    def generate_vocabulary_flashcards(
        self,
        material_summary: Dict[str, Any],
        question_language: str,
        answer_language: str,
        count: int = 30
    ) -> List[Dict[str, Any]]:
        """Generate vocabulary flashcards with proper language mapping."""
        prompt = f"""Generate {count} vocabulary flashcards from this material:

Title: {material_summary.get('title', '')}
Topics: {', '.join(material_summary.get('main_topics', []))}

For each flashcard:
- front_text: Word/phrase in {question_language}
- back_text: Translation/definition in {answer_language}
- difficulty: easy, medium, or hard

Return a JSON object with a "flashcards" array:
{{
    "flashcards": [
        {{
            "front_text": "...",
            "back_text": "...",
            "difficulty": "medium"
        }},
        ...
    ]
}}"""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are an expert at creating vocabulary flashcards. Always respond with valid JSON objects containing a 'flashcards' array."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.5,
            response_format={"type": "json_object"}
        )
        
        try:
            result = json.loads(response.choices[0].message.content)
            flashcards = result.get("flashcards", [])
            
            if not isinstance(flashcards, list):
                print(f"Warning: Expected flashcards array, got {type(flashcards)}")
                return []
            
            if len(flashcards) == 0:
                print(f"Warning: Empty flashcards array in AI response")
                return []
            
            print(f"Successfully generated {len(flashcards)} vocabulary flashcards")
            return flashcards
        except json.JSONDecodeError as e:
            print(f"Error parsing AI response as JSON: {e}")
            return []
        except Exception as e:
            print(f"Error processing flashcard generation response: {e}")
            import traceback
            print(traceback.format_exc())
            return []
    
    def generate_vocabulary_mcqs(
        self,
        front_text: str,
        back_text: str,
        question_language: str,
        answer_language: str
    ) -> List[Dict[str, Any]]:
        """Generate 3 MCQ questions for a vocabulary word:
        1. Standard: What does 'front_text' mean in answer_language?
        2. Reverse: What does 'back_text' mean in question_language?
        3. Creative: Contextual usage question
        """
        prompt = f"""Generate exactly 3 multiple-choice questions for this vocabulary pair:

Word in {question_language}: {front_text}
Translation in {answer_language}: {back_text}

Generate 3 questions:
1. Standard: "What does '{front_text}' mean in {answer_language}?" (4 options, correct answer is '{back_text}')
2. Reverse: "What does '{back_text}' mean in {question_language}?" (4 options, correct answer is '{front_text}')
3. Creative: A contextual question using the word '{front_text}' in a sentence (4 options, correct answer should be related to the meaning)

For each question, provide:
- question_text: The question
- options: Array of exactly 4 answer options
- correct_answer_index: Index (0-3) of the correct answer
- rationale: Brief explanation
- question_type: "standard", "reverse", or "creative"

Return JSON object:
{{
    "questions": [
        {{
            "question_text": "...",
            "options": ["option1", "option2", "option3", "option4"],
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
                {"role": "system", "content": "You are an expert at creating vocabulary multiple-choice questions. Always respond with valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            response_format={"type": "json_object"}
        )
        
        try:
            result = json.loads(response.choices[0].message.content)
            questions = result.get("questions", [])
            
            if not isinstance(questions, list) or len(questions) != 3:
                print(f"Warning: Expected 3 questions, got {len(questions) if isinstance(questions, list) else 0}")
                return []
            
            return questions
        except Exception as e:
            print(f"Error generating MCQs: {e}")
            return []
    
    def generate_vocabulary_sentences(
        self,
        front_text: str,
        back_text: str,
        target_language: str,
        count: int = 5
    ) -> List[Dict[str, Any]]:
        """Generate example sentences in target language containing the vocabulary word."""
        prompt = f"""Generate {count} example sentences in {target_language} using this vocabulary word:

Word: {front_text}
Translation: {back_text}
Target Language: {target_language}

The sentences should be in {target_language} and contain the vocabulary word.

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
        user_preferences: Dict[str, Any],
        test_results: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Generate adaptive study schedule using pre-assessment test results."""
        exam_date = study_plan.get("exam_date")
        learning_speed = user_preferences.get("learning_speed", "moderate")
        study_hours = user_preferences.get("study_hours_per_week", 10)
        flashcard_count = len(flashcards)
        
        # Identify poorly known words from test results
        weak_words_info = ""
        if test_results:
            weak_words = []
            for fc in flashcards:
                fc_id = str(fc.get("id", ""))
                if fc_id in test_results:
                    mastery = test_results[fc_id].get("mastery", 100.0)
                    if mastery < 70.0:  # Words with less than 70% mastery
                        weak_words.append(f"{fc.get('front_text')} (mastery: {mastery:.0f}%)")
            
            if weak_words:
                weak_words_info = f"\n\nWords needing more practice (from pre-assessment):\n" + "\n".join(weak_words[:20])  # Limit to 20 for prompt size
        
        prompt = f"""Create a daily study schedule for vocabulary exam preparation:

Study Plan: {study_plan.get('name', '')}
Exam Date: {exam_date}
Flashcards: {flashcard_count} vocabulary words
Learning Speed: {learning_speed}
Study Hours/Week: {study_hours}{weak_words_info}

Generate tasks distributed from today until exam date. Include:
- flashcard_review sessions (learn mode)
- multiple_choice_quiz (quiz mode)
- matching_game (match mode)
- writing_practice (write mode)
- fill_the_gap (fill_gaps mode)
- short_test (quiz mode)
- comprehensive_test (quiz mode)

IMPORTANT: If there are words needing more practice, schedule additional review sessions for those words later in the schedule. Use spaced repetition principles.

For each task:
- title: Descriptive title
- type: Task type (flashcard_review, multiple_choice_quiz, matching_game, writing_practice, fill_the_gap, short_test, comprehensive_test)
- mode: Study mode (learn, quiz, match, write, fill_gaps)
- estimated_minutes: Time estimate
- day_number: Day in schedule (1, 2, 3...)
- rationale: Why this task now
- order: Order within the day

Use spaced repetition principles. Balance different modes. Target weak words with extra practice sessions.

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
        from PIL import Image
        import pillow_heif
        from io import BytesIO
        
        # Register HEIF opener if not already registered
        try:
            pillow_heif.register_heif_opener()
        except:
            pass
        
        # Open and convert image to JPEG if needed
        image_ext = image_path.lower().split('.')[-1]
        
        if image_ext == 'heic':
            # Convert HEIC to JPEG in memory
            heif_file = pillow_heif.open_heif(image_path)
            image = Image.frombytes(
                heif_file.mode,
                heif_file.size,
                heif_file.data,
                "raw"
            )
            # Convert to RGB if needed (HEIC might be in different color space)
            if image.mode != 'RGB':
                image = image.convert('RGB')
            # Save to bytes buffer as JPEG
            buffer = BytesIO()
            image.save(buffer, format='JPEG')
            image_data = base64.b64encode(buffer.getvalue()).decode('utf-8')
            mime_type = "image/jpeg"
        else:
            # For other formats, read directly
            with open(image_path, "rb") as image_file:
                image_data = base64.b64encode(image_file.read()).decode('utf-8')
            
            if image_ext in ['jpg', 'jpeg']:
                mime_type = "image/jpeg"
            elif image_ext == 'png':
                mime_type = "image/png"
            else:
                mime_type = "image/jpeg"
            
        
        response = self.client.chat.completions.create(
            model="gpt-4o",
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

