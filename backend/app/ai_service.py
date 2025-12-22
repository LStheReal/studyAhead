from typing import List, Dict, Any, Optional
from openai import OpenAI
from app.config import settings
from app.mock_ai_service import mock_ai_service
import json

class AIService:
    """Abstraction layer for AI services. Can be swapped by changing API key."""
    
    def __init__(self):
        # Only initialize OpenAI if not using mock AI and key is present
        if not settings.USE_MOCK_AI and settings.OPENAI_API_KEY:
            self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
            self.model = "gpt-4o" # Default model
        else:
            self.client = None
            self.model = None
    
    def analyze_material(
        self, 
        content: str, 
        material_type: str = "text"
    ) -> Dict[str, Any]:
        """Analyze uploaded material and categorize it."""
        if settings.USE_MOCK_AI:
            return mock_ai_service.analyze_material(content)

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
    "difficulty_assessment": "easy" | "medium" | "hard",
    "detected_languages": ["Language1", "Language2"]
}}

IMPORTANT: If the material contains vocabulary pairs (word translations between two languages), set category to "vocabulary" and include "detected_languages" with both languages identified (e.g., ["English", "Spanish"]). For non-vocabulary content, detected_languages can be empty or contain the single language of the content.

Be thorough and accurate."""

        try:
            if not self.client:
                return mock_ai_service.analyze_material(content)

            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an expert educational content analyzer. Always respond with valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                response_format={"type": "json_object"},
                timeout=20.0
            )
            
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            print(f"AI analysis failed: {e}. Falling back to mock.")
            return mock_ai_service.analyze_material(content)
    
    def generate_flashcards(
        self, 
        material_summary: Dict[str, Any],
        count: int = 30
    ) -> List[Dict[str, Any]]:
        """Generate flashcards from material summary."""
        # Note: This method seems to be generic. For vocabulary, generate_vocabulary_flashcards is preferred.
        # If called for vocabulary, we redirect or handle appropriately.
        
        if settings.USE_MOCK_AI:
             # For generic flashcards, we can reuse the vocabulary mock for now or extend it
             return mock_ai_service.generate_vocabulary_flashcards("mock content", count)

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

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an expert at creating educational flashcards. Always respond with valid JSON objects containing a 'flashcards' array."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.5,
                response_format={"type": "json_object"},
                timeout=30.0
            )
            
            result = json.loads(response.choices[0].message.content)
            flashcards = result.get("flashcards", [])
            
            # Ensure we return a list
            if not isinstance(flashcards, list):
                print(f"Warning: Expected flashcards array, got {type(flashcards)}: {flashcards}. Falling back to mock data.")
                return mock_ai_service.generate_flashcards(material_summary.get('title', ''), category, count)
            
            if len(flashcards) == 0:
                print(f"Warning: Empty flashcards array in AI response. Falling back to mock data.")
                return mock_ai_service.generate_flashcards(material_summary.get('title', ''), category, count)
            
            print(f"Successfully generated {len(flashcards)} flashcards")
            return flashcards
        except Exception as e:
            print(f"AI flashcard generation failed: {e}. Falling back to mock data.")
            import traceback
            print(traceback.format_exc())
            return mock_ai_service.generate_flashcards(material_summary.get('title', ''), category, count)
    
    def generate_vocabulary_flashcards(
        self,
        material_summary: Dict[str, Any],
        text_content: str,
        question_language: str,
        answer_language: str
    ) -> List[Dict[str, Any]]:
        """Generate vocabulary flashcards with proper language mapping."""
        if settings.USE_MOCK_AI:
            return mock_ai_service.generate_vocabulary_flashcards(text_content)

        prompt = f"""Generate flashcards for ALL vocabulary pairs found in this material:

Title: {material_summary.get('title', '')}
Content:
{text_content[:8000]}

For each flashcard:
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

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an expert at creating vocabulary flashcards. Always respond with valid JSON objects containing a 'flashcards' array."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.5,
                response_format={"type": "json_object"},
                timeout=30.0
            )
            
            result = json.loads(response.choices[0].message.content)
            flashcards = result.get("flashcards", [])
            
            if not isinstance(flashcards, list):
                print(f"Warning: Expected flashcards array, got {type(flashcards)}. Falling back to mock.")
                return mock_ai_service.generate_vocabulary_flashcards(text_content)
            
            if len(flashcards) == 0:
                print(f"Warning: Empty flashcards array in AI response. Falling back to mock.")
                return mock_ai_service.generate_vocabulary_flashcards(text_content)
            
            print(f"Successfully generated {len(flashcards)} vocabulary flashcards")
            return flashcards
        except Exception as e:
            print(f"AI vocabulary flashcard generation failed: {e}. Falling back to mock.")
            return mock_ai_service.generate_vocabulary_flashcards(text_content)
    
    def generate_vocabulary_mcqs(
        self,
        front_text: str,
        back_text: str,
        question_language: str,
        answer_language: str
    ) -> List[Dict[str, Any]]:
        """Generate 3 MCQ questions for a vocabulary word."""
        # Note: This method seems redundant with generate_mcq_questions below, but keeping for compatibility
        if settings.USE_MOCK_AI:
            return mock_ai_service.generate_mcq_questions(
                {"front_text": front_text, "back_text": back_text}, 
                question_language, 
                answer_language
            )

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

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an expert at creating vocabulary multiple-choice questions. Always respond with valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                response_format={"type": "json_object"},
                timeout=15.0
            )
            
            result = json.loads(response.choices[0].message.content)
            questions = result.get("questions", [])
            
            if not isinstance(questions, list) or len(questions) != 3:
                print(f"Warning: Expected 3 questions, got {len(questions) if isinstance(questions, list) else 0}. Falling back.")
                return mock_ai_service.generate_mcq_questions({"front_text": front_text, "back_text": back_text}, question_language, answer_language)
            
            return questions
        except Exception as e:
            print(f"AI MCQ generation failed: {e}. Falling back to mock.")
            return mock_ai_service.generate_mcq_questions({"front_text": front_text, "back_text": back_text}, question_language, answer_language)
    
    def generate_vocabulary_sentences(
        self,
        front_text: str,
        back_text: str,
        target_language: str,
        count: int = 5
    ) -> List[Dict[str, Any]]:
        """Generate example sentences in target language containing the vocabulary word."""
        if settings.USE_MOCK_AI:
            return mock_ai_service.generate_vocabulary_sentences(front_text, back_text)

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

        try:
            if not self.client:
                return mock_ai_service.generate_vocabulary_sentences(front_text, back_text)

            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an expert at creating example sentences for language learning. Always respond with valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                response_format={"type": "json_object"},
                timeout=20.0
            )
            
            result = json.loads(response.choices[0].message.content)
            return result.get("sentences", [])
        except Exception as e:
            print(f"AI vocabulary sentence generation failed: {e}. Falling back to mock.")
            return mock_ai_service.generate_vocabulary_sentences(front_text, back_text)
    
    def generate_mcq_questions(
        self,
        flashcard: Dict[str, Any],
        question_language: str,
        answer_language: str
    ) -> List[Dict[str, Any]]:
        """Generate 3 MCQ questions per flashcard (standard, reverse, creative)."""
        if settings.USE_MOCK_AI:
            return mock_ai_service.generate_mcq_questions(flashcard, question_language, answer_language)

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

        try:
            if not self.client:
                return mock_ai_service.generate_mcq_questions(flashcard, question_language, answer_language)

            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an expert at creating educational multiple-choice questions. Always respond with valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.6,
                response_format={"type": "json_object"},
                timeout=15.0
            )
            
            result = json.loads(response.choices[0].message.content)
            return result.get("questions", [])
        except Exception as e:
            print(f"AI MCQ generation failed: {e}. Falling back to mock.")
            return mock_ai_service.generate_mcq_questions(flashcard, question_language, answer_language)
    
    def generate_study_schedule(
        self,
        study_plan: Dict[str, Any],
        flashcards: List[Dict[str, Any]],
        user_preferences: Dict[str, Any],
        test_results: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Generate adaptive study schedule using pre-assessment test results."""
        def get_fallback_schedule():
            # Return a comprehensive mock schedule including Pre-Assessment and all modes
            full_schedule = [
                {
                    "title": "Pre-Assessment Test",
                    "type": "comprehensive_test",
                    "mode": "pre_assessment",
                    "estimated_minutes": 15,
                    "day_number": 1,
                    "rationale": "Initial assessment to gauge your current knowledge level.",
                    "order": 1
                },
                {
                    "title": "Initial Vocabulary Review",
                    "type": "flashcard_review",
                    "mode": "learn",
                    "estimated_minutes": 20,
                    "day_number": 1,
                    "rationale": "Start by learning the new vocabulary.",
                    "order": 2
                },
                {
                    "title": "Vocabulary Quiz",
                    "type": "multiple_choice_quiz",
                    "mode": "quiz",
                    "estimated_minutes": 10,
                    "day_number": 2,
                    "rationale": "Test your retention of yesterday's words.",
                    "order": 1
                },
                {
                    "title": "Connect the Terms",
                    "type": "matching_game",
                    "mode": "match",
                    "estimated_minutes": 15,
                    "day_number": 2,
                    "rationale": "Visual association practice.",
                    "order": 2
                },
                {
                    "title": "Writing Practice",
                    "type": "writing_practice",
                    "mode": "write",
                    "estimated_minutes": 20,
                    "day_number": 3,
                    "rationale": "Practice spelling and recall.",
                    "order": 1
                },
                {
                    "title": "Fill the Gaps",
                    "type": "fill_the_gap",
                    "mode": "fill_gaps",
                    "estimated_minutes": 15,
                    "day_number": 3,
                    "rationale": "Contextual usage practice.",
                    "order": 2
                },
                {
                    "title": "Mid-Week Check",
                    "type": "short_test",
                    "mode": "short_test",
                    "estimated_minutes": 10,
                    "day_number": 4,
                    "rationale": "Quick check on progress.",
                    "order": 1
                },
                {
                    "title": "Final Review",
                    "type": "comprehensive_test",
                    "mode": "long_test",
                    "estimated_minutes": 30,
                    "day_number": 5,
                    "rationale": "Comprehensive evaluation of all material.",
                    "order": 1
                }
            ]
            
            # If we already have test results (pre-assessment done), omit the pre-assessment task
            if test_results:
                return [t for t in full_schedule if t["mode"] != "pre_assessment"]
            return full_schedule

        if settings.USE_MOCK_AI:
            return get_fallback_schedule()

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

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an expert at creating adaptive study schedules with spaced repetition. Always respond with valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.4,
                response_format={"type": "json_object"},
                timeout=45.0
            )
            
            result = json.loads(response.choices[0].message.content)
            return result.get("tasks", [])
        except Exception as e:
            print(f"AI schedule generation failed: {e}. Falling back to mock schedule.")
            return get_fallback_schedule()
    
    def extract_text_from_image(self, image_path: str) -> str:
        """Extract text from image using vision API."""
        if settings.USE_MOCK_AI:
            return mock_ai_service.extract_text_from_image(b"")

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
            
        
        try:
            if not self.client:
                return "Mock text extracted from image: [The provided image contained vocabulary and definitions for study.]"

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
                max_tokens=4000,
                timeout=45.0
            )
            
            return response.choices[0].message.content
        except Exception as e:
            print(f"AI image text extraction failed: {e}. Falling back to mock.")
            return "Mock text extracted from image: [The provided image contained vocabulary and definitions for study.]"
    
    def process_pdf_content(self, pdf_text: str) -> Dict[str, Any]:
        """Process PDF content and extract structured information."""
        if settings.USE_MOCK_AI:
            return mock_ai_service.analyze_material(pdf_text)

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

        try:
            if not self.client:
                return mock_ai_service.analyze_material(pdf_text)

            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an expert at processing educational content. Always respond with valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                response_format={"type": "json_object"},
                timeout=45.0
            )
            
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            print(f"AI PDF processing failed: {e}. Falling back to mock.")
            return mock_ai_service.analyze_material(pdf_text)

# Global instance
ai_service = AIService()

