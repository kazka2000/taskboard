const axios = require('axios');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function testGeminiAPI() {
    const apiKey = process.env.GEMINI_API_KEY;
    const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

    console.log(`Testing Gemini API Key: ${apiKey ? apiKey.substring(0, 10) + '...' : 'MISSING'}`);

    try {
        const response = await axios.post(
            `${apiUrl}?key=${apiKey}`,
            {
                contents: [{ parts: [{ text: "Hello, this is a test. Can you respond?" }] }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 100,
                }
            },
            { headers: { 'Content-Type': 'application/json' } }
        );
        console.log("SUCCESS! response payload:", response.data?.candidates?.[0]?.content?.parts?.[0]?.text);
    } catch (error) {
        console.error("API ERROR:", error.response?.status);
        console.error("ERROR DATA:", error.response?.data);
    }
}

testGeminiAPI();
