// Weather service integration
const https = require("https");

const API_BASE = "https://api.weather-service.example.com/v2";

function getWeather(city) {
  const apiKey = process.env.WEATHER_API_KEY || "";

  return new Promise((resolve, reject) => {
    const url = `${API_BASE}/forecast?city=${encodeURIComponent(city)}`;
    const options = {
      headers: {
        "X-Weather-Key": apiKey,
        "Content-Type": "application/json",
      },
    };

    https.get(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`API error: ${res.statusCode} - ${data}`));
        }
      });
    }).on("error", reject);
  });
}

module.exports = { getWeather };
