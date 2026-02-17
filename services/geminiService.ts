import { GoogleGenAI, Type } from "@google/genai";

// Initialize the GoogleGenAI client using the process.env.API_KEY directly as required.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeMedicalRecords = async (parts: any[]) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { text: "You are an expert medical diagnostic assistant. Perform a deep synthesis of the patient's medical history using provided titles, descriptions, and document OCR data. THE RESPONSE MUST BE UNDER 100 WORDS. USE PLAIN TEXT ONLY. DO NOT USE ANY SPECIAL SYMBOLS, MARKDOWN FORMATTING (like ** or #), OR EXTRA PUNCTUATION. PROVIDE A CLEAR AND CONCISE SUMMARY WITHOUT SYMBOLS." },
          ...parts
        ]
      },
    });
    return response.text;
  } catch (error) {
    console.error("AI Analysis error:", error);
    return "Unable to perform AI analysis at this time.";
  }
};

export const insuranceInterpreter = async (documentContent: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { text: "USE PLAIN TEXT ONLY. DO NOT USE ANY SPECIAL SYMBOLS, MARKDOWN FORMATTING (like ** or #), OR EXTRA PUNCTUATION. Provide formatted analysis with appropriate spaces and line breaks. Extract and interpret the following insurance document details. Format with clear sections separated by line breaks." },
          { text: documentContent }
        ]
      },
    });
    return response.text || "Unable to generate insurance analysis at this time.";
  } catch (error) {
    console.error("Insurance AI error:", error);
    throw new Error(`Failed to analyze insurance: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const therapistChat = async (message: string, context: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: message,
      config: {
        systemInstruction: `You are an AI therapist named Medibot-Sensei. You specialize in ${context}. Be empathetic, encouraging, and provide simple coping mechanisms.`,
      }
    });
    return response.text;
  } catch (error) {
    console.error("Therapist AI error:", error);
    return "I'm here for you, but I'm having trouble connecting right now. Take a deep breath.";
  }
};

export const medicalConsultant = async (prompt: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are a professional medical assistant. Provide helpful, accurate, but cautious medical advice. Always recommend seeing a doctor for serious concerns.",
      }
    });
    return response.text;
  } catch (error) {
    return "Consultation unavailable.";
  }
};