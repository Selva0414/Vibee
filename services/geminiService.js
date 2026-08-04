// Cache to store results of recent queries to minimize API costs and latency
const queryCache = new Map();

/**
 * Service to interact with Render AI API for music recommendations
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

        OUTPUT FORMAT:
        Return ONLY a flat JSON Array of strings. Example:
        ["Song Name 1", "Song Name 2"]

        RULES:
        - Return ONLY the JSON Array.
        - Ensure strict JSON format.
        - Provide exactly 20 songs.
        - Do not include explanation text.
        `;

            // 2. Use the new AI endpoint
            let responseText = null;
            let lastError = null;

            try {
                const formData = new FormData();
                formData.append('message', promptText);

                const response = await fetch('https://ai-agent-v01.onrender.com/chat', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
                }

                const data = await response.json();
                // Extract response based on how the API usually returns it (from test-ai.js)
                responseText = data.message || data.reply || data.response || data.text || data.answer || data.result || JSON.stringify(data);

            } catch (e) {
                console.warn(`[Gemini] Failed to fetch from AI Agent:`, e.message);
                lastError = e;
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
