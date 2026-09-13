const jwt = require("jsonwebtoken");
const axios = require("axios");

const KLING_API_BASE = process.env.KLING_API_BASE || "https://api.klingai.com";

/**
 * Kling AI uses short-lived JWTs (HS256) signed with your Access Key / Secret Key
 * instead of a static API key. We mint a fresh token for every request.
 */
function generateKlingToken() {
  const accessKey = process.env.KLING_ACCESS_KEY;
  const secretKey = process.env.KLING_SECRET_KEY;

  if (!accessKey || !secretKey) {
    throw new Error(
      "Missing KLING_ACCESS_KEY / KLING_SECRET_KEY. Add them to your .env file."
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: accessKey,
    exp: now + 1800, // 30 minutes
    nbf: now - 5,
  };

  return jwt.sign(payload, secretKey, { algorithm: "HS256" });
}

function klingHeaders() {
  return {
    Authorization: `Bearer ${generateKlingToken()}`,
    "Content-Type": "application/json",
  };
}

/**
 * Submit an image-to-video generation task.
 * @param {Object} opts
 * @param {string} opts.imageBase64 - base64-encoded image (no data: prefix)
 * @param {string} opts.prompt - motion / creative direction prompt
 * @param {string} [opts.negativePrompt]
 * @param {string} [opts.duration] - "5" or "10"
 * @param {string} [opts.mode] - "std" or "pro"
 * @param {string} [opts.modelName] - e.g. "kling-v1-6"
 * @returns {Promise<string>} task_id
 */
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

/**
 * Poll a task until it completes, fails, or times out.
 * @param {string} taskId
 * @param {Object} [opts]
 * @param {number} [opts.intervalMs=5000]
 * @param {number} [opts.timeoutMs=600000] - 10 minutes
 * @returns {Promise<string>} the final video URL
 */
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

    // status is likely "submitted" or "processing" — keep waiting
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(`Kling task ${taskId} timed out after ${timeoutMs}ms`);
}

module.exports = {
  submitImageToVideoTask,
  pollImageToVideoTask,
};
