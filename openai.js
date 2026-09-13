const axios = require("axios");
const fs = require("fs");

const OPENAI_BASE = "https://api.openai.com/v1";

function openaiHeaders() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("Missing OPENAI_API_KEY. Add it to your .env file.");
  }
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

/**
 * Ask OpenAI to write a short voiceover script + matching motion-prompt
 * for a given creative "angle" on the product.
 */
async function generateAngleScript({ productName, productHint, angleLabel }) {
  const chatModel = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

  const systemPrompt = `You write short, punchy voiceover scripts for product ads (10-15 seconds when read aloud, ~30-40 words max) and short camera-motion directions for AI video generation. Always respond with strict JSON: {"voiceover": "...", "motion_prompt": "..."}. No markdown, no extra text.`;

  const userPrompt = `Product: ${productName || "the uploaded product"}.
${productHint ? `Extra context: ${productHint}.` : ""}
Creative angle: "${angleLabel}".
Write:
1. "voiceover": a short, energetic ad voiceover line matching this angle.
2. "motion_prompt": a one-sentence camera/motion description (for an image-to-video AI model) that matches this angle — e.g. slow rotation, close-up pan, dramatic light sweep, etc. Keep it concrete and visual, no more than 25 words.`;

  const { data } = await axios.post(
    `${OPENAI_BASE}/chat/completions`,
    {
      model: chatModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
    },
    { headers: openaiHeaders() }
  );

  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) throw new Error("OpenAI chat completion returned no content.");

  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`Failed to parse OpenAI JSON response: ${raw}`);
  }
}

/**
 * Generate a voiceover mp3 file from text using OpenAI TTS.
 * @param {string} text
 * @param {string} outPath - where to save the mp3
 */
async function generateVoiceover(text, outPath) {
  const model = process.env.OPENAI_TTS_MODEL || "tts-1";
  const voice = process.env.OPENAI_TTS_VOICE || "alloy";

  const response = await axios.post(
    `${OPENAI_BASE}/audio/speech`,
    { model, voice, input: text },
    { headers: openaiHeaders(), responseType: "arraybuffer" }
  );

  fs.writeFileSync(outPath, response.data);
  return outPath;
}

module.exports = {
  generateAngleScript,
  generateVoiceover,
};
