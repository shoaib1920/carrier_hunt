import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config({ path: '.env.local' });

const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
console.log('Using API key:', apiKey);

const ai = new GoogleGenAI({ apiKey });

try {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    contents: 'Hello, are you there?',
  });
  console.log('Response text:', response.text);
} catch (error) {
  console.error('Gemini API call failed:', error);
}
