import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the API with the provided key
// In a production environment, this should be in an environment variable
const API_KEY = "AIzaSyDL_AcPvG0gYgQIbFbuQRWDx3s5VlpbiMI";
const genAI = new GoogleGenerativeAI(API_KEY);

// Cache to store results of recent queries to minimize API costs and latency
const queryCache = new Map();

/**
 * Service to interact with Google Gemini API for music recommendations
 */
export const GeminiService = {
    /**
     * Generates a list of song names based on a natural language query
     * @param {string} userQuery - The user's description of what they want to listen to
     * @param {string} language - Preferred language for songs (e.g., 'tamil', 'hindi')
     * @returns {Promise<Array<string>>} - Array of song names to search for
     */
    getSongRecommendations: async (userQuery, language = null) => {
        // 1. Check cache first
        const cacheKey = `${language || 'any'}:${userQuery.toLowerCase().trim()}`;
        if (queryCache.has(cacheKey)) {
            console.log(`[Gemini] Serving result from cache for: "${userQuery}"`);
            return queryCache.get(cacheKey);
        }

        try {
            console.log(`[Gemini] Requesting recommendations for: "${userQuery}" in ${language}`);

            // Construct Prompt
            const promptText = `
        You are an intelligent music assistant.
        User Query: "${userQuery}"
        ${language ? `Context: Language ${language}` : ''}

        Return a list of 20 distinct song names that match this vibe, mood, or request.

        OUTPUT JSON FORMAT:
        [
          {"track": "Song Name", "artist": "Artist"},
          {"track": "Song Name", "artist": "Artist"},
          ...
        ]

        RULES:
        - Return ONLY a JSON Array.
        - Ensure strict JSON format.
        - Provide exactly 20 songs.
        - Do not include explanation text.
        `;

            // 2. Use gemini-flash-latest (Stable 1.5 Flash alias)
            const modelsToTry = ["gemini-flash-latest"];

            let responseText = null;
            let lastError = null;

            // Helper for delay
            const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

            for (const modelName of modelsToTry) {
                try {
                    console.log(`[Gemini] Attempting with model: ${modelName}`);
                    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`;

                    // Retry loop for 429 errors specifically
                    let retries = 3;
                    while (retries > 0) {
                        try {
                            const response = await fetch(url, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    contents: [{ parts: [{ text: promptText }] }]
                                })
                            });

                            if (!response.ok) {
                                if (response.status === 429) {
                                    console.warn(`[Gemini] Rate limited on ${modelName}. Retrying in 3s... (Attempts left: ${retries})`);
                                    await wait(3000 + (Math.random() * 1000)); // Jittered wait
                                    retries--;
                                    continue;
                                }
                                const errText = await response.text();
                                throw new Error(`HTTP ${response.status}: ${errText}`);
                            }

                            const data = await response.json();
                            if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                                responseText = data.candidates[0].content.parts[0].text;
                                break; // Success!
                            } else {
                                throw new Error("Empty response from Gemini API");
                            }
                        } catch (e) {
                            if (e.message.includes("Rate Limit") || e.message.includes("429")) {
                                if (retries <= 0) throw e;
                                await wait(3000);
                                retries--;
                                continue;
                            }
                            throw e; // Non-retryable error
                        }
                    }
                    if (responseText) break; // Break outer loop if success

                } catch (e) {
                    console.warn(`[Gemini] Failed with ${modelName}:`, e.message);
                    lastError = e;
                    // Continue to next model
                }
            }

            if (!responseText) {
                const finalError = lastError?.message || "All Gemini models failed";
                if (finalError.includes("429")) {
                    throw new Error("Gemini API Rate Limit Exceeded. Please wait a minute and try again.");
                }
                throw lastError || new Error("All Gemini models failed to respond.");
            }

            // 5. Parse and Clean Response
            let text = responseText;
            text = text.replace(/```json/g, '').replace(/```/g, '').trim();

            let songNames;
            try {
                songNames = JSON.parse(text);
            } catch (e) {
                console.warn("[Gemini] JSON Parse Error:", e);
                throw new Error("Invalid JSON from Gemini");
            }

            if (!songNames || (typeof songNames !== 'object')) {
                throw new Error("Invalid response format from Gemini");
            }

            console.log(`[Gemini] Received recommendations`);

            // 6. Cache the result
            queryCache.set(cacheKey, songNames);

            // Limit cache size
            if (queryCache.size > 50) {
                const firstKey = queryCache.keys().next().value;
                queryCache.delete(firstKey);
            }

            return songNames;

        } catch (error) {
            console.error("[Gemini] API Error:", error);
            throw error;
        }
    },

    /**
     * Clear the internal cache
     */
    clearCache: () => {
        queryCache.clear();
    }
};
