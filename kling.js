const axios = require("axios");

// Kling AI's newer accounts use a single API Key sent as a Bearer token
// (no JWT signing needed). This matches keys that look like:
//   api-key-kling-XXXXXXXXXXXXXXXX
const KLING_API_BASE = process.env.KLING_API_BASE || "https://api-singapore.klingai.com";

function klingHeaders() {
  const apiKey = process.env.KLING_API_KEY;
  if (!apiKey) {
    throw new Error("Missing KLING_API_KEY. Add it to your .env file / Render environment variables.");
  }
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

async function submitImageToVideoTask({
  imageBase64,
  prompt,
  negativePrompt = "blurry, low quality, distorted, watermark, text artifacts",
  duration = "5",
  mode = "std",
  modelName = "kling-v1-6",
}) {
  const url = `${KLING_API_BASE}/v1/videos/image2video`;
  const body = {
    model_name: modelName,
    image: imageBase64,
    prompt,
    negative_prompt: negativePrompt,
    duration,
    mode,
  };

  const { data } = await axios.post(url, body, { headers: klingHeaders() });

  const taskId = data?.data?.task_id;
  if (!taskId) {
    throw new Error(
      `Kling API did not return a task_id. Response: ${JSON.stringify(data)}`
    );
  }
  return taskId;
}

async function pollImageToVideoTask(
  taskId,
  { intervalMs = 5000, timeoutMs = 600000 } = {}
) {
  const url = `${KLING_API_BASE}/v1/videos/image2video/${taskId}`;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const { data } = await axios.get(url, { headers: klingHeaders() });
    const status = data?.data?.task_status;

    if (status === "succeed") {
      const videoUrl = data?.data?.task_result?.videos?.[0]?.url;
      if (!videoUrl) {
        throw new Error(
          `Task ${taskId} succeeded but no video URL was returned.`
        );
      }
      return videoUrl;
    }

    if (status === "failed") {
      throw new Error(
        `Kling task ${taskId} failed: ${
          data?.data?.task_status_msg || "unknown error"
        }`
      );
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(`Kling task ${taskId} timed out after ${timeoutMs}ms`);
}

module.exports = {
  submitImageToVideoTask,
  pollImageToVideoTask,
};
