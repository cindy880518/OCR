
import { GoogleGenAI } from "@google/genai";

export const performOCR = async (base64Image: string, mimeType: string): Promise<string> => {
  // Initialize inside function to ensure we catch any runtime env issues
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please check your environment settings.");
  }
  
  // Create a new GoogleGenAI instance right before making an API call to ensure up-to-date config
  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      // Always use the recommended structure for contents with parts as an object
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image,
            },
          },
          {
            text: "Extract all text from this image precisely. Keep the original structure. No conversational text.",
          },
        ],
      },
      config: {
        temperature: 0.1,
      }
    });

    // response.text is a property (getter), not a method. Access it directly.
    const text = response.text;
    if (!text) {
      throw new Error("Model returned an empty response.");
    }

    return text;
  } catch (error: any) {
    console.error("OCR API Detail Error:", error);
    // Extract more meaningful error messages if available
    const errorMsg = error?.message || "Internal API Error";
    throw new Error(errorMsg);
  }
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      if (result.includes(',')) {
        resolve(result.split(',')[1]);
      } else {
        reject(new Error("Failed to parse file to Base64"));
      }
    };
    reader.onerror = (error) => reject(error);
  });
};
