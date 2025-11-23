import asyncio
from app.ai_service import ai_service

async def verify_dynamic_generation():
    # Simulate material with exactly 5 vocabulary pairs
    material_text = """
    1. Apple - Manzana
    2. Banana - Plátano
    3. Cat - Gato
    4. Dog - Perro
    5. House - Casa
    """
    
    summary = {
        "title": "Test Vocab",
        "main_topics": ["Basic Words"],
        "category": "vocabulary"
    }
    
    print("Testing generation with 5 vocabulary pairs...")
    flashcards = ai_service.generate_vocabulary_flashcards(
        summary,
        material_text,
        "English",
        "Spanish"
    )
    
    print(f"Generated {len(flashcards)} flashcards")
    for fc in flashcards:
        print(f"- {fc.get('front_text')} -> {fc.get('back_text')}")
        
    if len(flashcards) == 5:
        print("SUCCESS: Generated exactly 5 flashcards")
    else:
        print(f"FAILURE: Expected 5 flashcards, got {len(flashcards)}")

if __name__ == "__main__":
    asyncio.run(verify_dynamic_generation())
