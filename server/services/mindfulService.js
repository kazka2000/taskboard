const axios = require('axios');

// Mock weather data for now (since no API key provided)
// In production, this would fetch from OpenWeatherMap
const MOCK_WEATHER_TYPES = ['Clear', 'Rain', 'Clouds', 'Snow'];

class MindfulService {
    constructor() {
        this.cache = {
            weather: null,
            lastFetch: 0
        };
        this.CACHE_DURATION = 60 * 60 * 1000; // 1 hour
    }

    // Get current time mode based on KST (UTC+9)
    getTimeMode() {
        // Get current time in KST
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const kstOffset = 9 * 60 * 60 * 1000;
        const kstDate = new Date(utc + kstOffset);
        const hour = kstDate.getHours();

        if (hour >= 5 && hour < 9) {
            return 'dawn'; // 05:00 - 08:59 (Early Morning)
        } else if (hour >= 9 && hour < 18) {
            return 'focus'; // 09:00 - 17:59
        } else if (hour >= 18 && hour < 22) {
            return 'family'; // 18:00 - 21:59
        } else {
            return 'night'; // 22:00 - 04:59
        }
    }

    async getWeather(refresh = false) {
        // Return cached if valid and not refreshing
        if (!refresh && this.cache.weather && (Date.now() - this.cache.lastFetch < this.CACHE_DURATION)) {
            return this.cache.weather;
        }

        try {
            const apiKey = 'YOUR_OPENWEATHER_API_KEY'; // User should replace this or use env
            // const apiKey = process.env.OPENWEATHER_API_KEY; 

            // Try fetching from API if key looks valid (not placeholder)
            if (apiKey && apiKey !== 'YOUR_OPENWEATHER_API_KEY') {
                const url = `https://api.openweathermap.org/data/2.5/weather?q=Seoul&appid=${apiKey}&units=metric`;
                const response = await axios.get(url);
                const main = response.data.weather[0].main; // 'Clear', 'Rain', etc.

                this.cache.weather = main;
                this.cache.lastFetch = Date.now();
                console.log(`Weather fetched from API: ${main}`);
                return main;
            }

            throw new Error('No API Key');
        } catch (error) {
            console.log('Weather API skipped/failed (using mock):', error.message);

            // Fixed Mock Data as requested (Removing Randomness)
            // Default to 'Clouds' or 'Clear' to avoid confusion.
            // User reported Seoul is Clouds, so let's mock 'Clouds' for now.
            const weather = 'Clouds';

            this.cache.weather = weather;
            this.cache.lastFetch = Date.now();
            return weather;
        }
    }

    async getContext(refresh = false) {
        const mode = this.getTimeMode();
        const weather = await this.getWeather(refresh);

        return {
            mode,
            weather,
            timestamp: new Date().toISOString()
        };
    }

    // Helper to allow overriding mock for testing
    async getContextWeather() {
        return this.getWeather();
    }
}

module.exports = new MindfulService();
