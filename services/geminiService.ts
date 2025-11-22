import { GoogleGenAI } from "@google/genai";
import { WorkLog } from "../types";

const apiKey = process.env.API_KEY || '';

export const generateTimesheetAnalysis = async (logs: WorkLog[]): Promise<string> => {
  if (!apiKey) {
    return "API Key is missing. Please configure the environment.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    // Prepare the data for the prompt
    const recentLogs = logs.slice(-20); // Analyze last 20 entries to save context
    const logSummary = recentLogs.map(log => 
      `Date: ${log.date}, Duration: ${(log.durationSeconds / 3600).toFixed(2)} hours`
    ).join('\n');

    const prompt = `
      You are an HR efficiency expert analyzing an employee's overtime and work logs.
      Here is the recent work data:
      ${logSummary}

      Please provide a concise, friendly, and professional 3-sentence summary.
      1. Mention the trend (e.g., consistent, heavy overtime, irregular).
      2. Point out if there is a risk of burnout or if the schedule looks healthy.
      3. Give one brief productivity or health tip based on this data.
      
      Keep the tone supportive and modern.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Unable to generate analysis at this moment.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "An error occurred while analyzing the data. Please try again later.";
  }
};