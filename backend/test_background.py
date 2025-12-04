"""Test script to manually run background processing and see errors."""
import asyncio
import sys
sys.path.insert(0, '/Users/louiseschule/Documents/studyahead/backend')

from app.routers.materials import process_materials_background

async def main():
    # Test with plan 11 (Vocabulary Test)
    print("Starting manual test of background processing...")
    try:
        await process_materials_background(
            study_plan_id=11,
            user_id=1,
            text_content="Hello - Hola\nGoodbye - Adios\nThank you - Gracias\nPlease - Por favor\nYes - Si\nNo - No\nWater - Agua\nFood - Comida\nFriend - Amigo\nHouse - Casa",
            file_paths=None
        )
        print("Processing completed successfully!")
    except Exception as e:
        import traceback
        print(f"ERROR: {e}")
        print(traceback.format_exc())

if __name__ == "__main__":
    asyncio.run(main())
