"""
GeoBuild AI — Gemini Smoke Test
Run this to verify your Gemini API key works:
  python test_gemini.py
"""

import os
import sys
from dotenv import load_dotenv

# Load .env from project root
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

api_key = os.getenv("GEMINI_API_KEY")
if not api_key or api_key == "your_gemini_api_key_here":
    print("❌ GEMINI_API_KEY not set!")
    print("   1. Go to https://aistudio.google.com")
    print("   2. Click 'Get API key' and create one")
    print("   3. Add it to .env as GEMINI_API_KEY=your_key")
    sys.exit(1)

print(f"🔑 API key found: {api_key[:8]}...{api_key[-4:]}")
print("🧪 Testing Gemini connection...")

try:
    from google import genai

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents="Say 'GeoBuild AI is ready!' and nothing else.",
    )

    print(f"✅ Gemini response: {response.text}")
    print("🎉 Gemini is working! You're ready to build.")

except Exception as e:
    print(f"❌ Gemini test failed: {e}")
    print("")
    print("Troubleshooting:")
    print("  - Check your API key is valid at aistudio.google.com")
    print("  - If model not found, try 'gemini-2.0-flash' instead")
    print("  - Make sure google-genai is installed: pip install google-genai")
    sys.exit(1)
