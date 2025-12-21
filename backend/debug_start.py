import sys
import os

# Add current directory to path explicitly
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

print(f"Current working directory: {os.getcwd()}")
print(f"Python path: {sys.path}")

try:
    from app import main
    print("Successfully imported app.main")
except Exception as e:
    print(f"Failed to import app.main: {e}")
    import traceback
    traceback.print_exc()
