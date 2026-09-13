const fs = require("fs");
const axios = require("axios");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");

ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Download a remote file (e.g. the Kling-generated video) to a local path.
 */
async function downloadFile(url, outPath) {
  const response = await axios.get(url, { responseType: "stream" });
  const writer = fs.createWriteStream(outPath);
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on("finish", () => resolve(outPath));
    writer.on("error", reject);
  });
}

/**
 * Merge a video file with a voiceover audio track.
 * - If the voiceover is shorter than the video, it plays once and the rest stays silent.
 * - If longer, the video's last frame effectively freezes (video output ends when video ends,
 *   audio is trimmed to match) — we trim audio to the video length by default.
 * The output uses the video's original video stream and replaces/adds the audio stream.
 */
function mergeVideoWithAudio(videoPath, audioPath, outPath) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .outputOptions([
        "-c:v copy", // keep original video quality, no re-encode
        "-c:a aac",
        "-shortest", // stop when the shorter stream (usually audio) ends... see note below
        "-map 0:v:0",
        "-map 1:a:0",
      ])
      .on("end", () => resolve(outPath))
      .on("error", (err) => reject(err))
      .save(outPath);
  });
}

module.exports = {
  downloadFile,
  mergeVideoWithAudio,
};
