require("dotenv").config();
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const { submitImageToVideoTask, pollImageToVideoTask } = require("./kling");
const { generateAngleScript, generateVoiceover } = require("./openai");
const { downloadFile, mergeVideoWithAudio } = require("./media");

const app = express();
const PORT = process.env.PORT || 3000;

const UPLOAD_DIR = path.join(__dirname, "uploads");
const OUTPUT_DIR = path.join(__dirname, "output");
[UPLOAD_DIR, OUTPUT_DIR].forEach((d) => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

app.use(cors());
app.use(express.json());
app.use("/output", express.static(OUTPUT_DIR));
app.use(express.static(path.join(__dirname, "public")));

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed."));
    }
    cb(null, true);
  },
});

// The set of creative "angles" we generate for every product.
// Feel free to add/remove/edit these.
const ANGLES = [
  {
    label: "Cinematic Reveal",
    duration: "5",
  },
  {
    label: "Feature Close-Up",
    duration: "5",
  },
  {
    label: "Lifestyle Vibe",
    duration: "5",
  },
];

app.post("/api/generate", upload.single("photo"), async (req, res) => {
  const jobId = uuidv4();
  const uploadedPath = req.file?.path;

  if (!uploadedPath) {
    return res.status(400).json({ error: "No photo uploaded." });
  }

  const productName = req.body.productName || "";
  const productHint = req.body.productHint || "";

  try {
    const imageBase64 = fs.readFileSync(uploadedPath).toString("base64");

    const results = [];

    // Process angles one at a time to keep things simple and easy to debug.
    // (You can parallelize with Promise.all once you've confirmed it works.)
    for (const angle of ANGLES) {
      console.log(`[${jobId}] Generating angle: ${angle.label}`);

      // 1. Ask OpenAI to write the voiceover line + a matching motion prompt
      const { voiceover, motion_prompt } = await generateAngleScript({
        productName,
        productHint,
        angleLabel: angle.label,
      });

      // 2. Kick off the Kling video generation task
      const taskId = await submitImageToVideoTask({
        imageBase64,
        prompt: motion_prompt,
        duration: angle.duration,
      });

      // 3. Poll until the video is ready
      const videoUrl = await pollImageToVideoTask(taskId);

      // 4. Download the generated video locally
      const rawVideoPath = path.join(OUTPUT_DIR, `${jobId}-${angle.label}-raw.mp4`);
      await downloadFile(videoUrl, rawVideoPath);

      // 5. Generate the voiceover audio
      const audioPath = path.join(OUTPUT_DIR, `${jobId}-${angle.label}.mp3`);
      await generateVoiceover(voiceover, audioPath);

      // 6. Merge video + voiceover into the final file
      const finalFileName = `${jobId}-${angle.label.replace(/\s+/g, "-")}.mp4`;
      const finalPath = path.join(OUTPUT_DIR, finalFileName);
      await mergeVideoWithAudio(rawVideoPath, audioPath, finalPath);

      // Clean up intermediate files
      fs.unlinkSync(rawVideoPath);
      fs.unlinkSync(audioPath);

      results.push({
        angle: angle.label,
        voiceover,
        motion_prompt,
        videoUrl: `/output/${finalFileName}`,
      });
    }

    fs.unlinkSync(uploadedPath); // clean up the original upload

    res.json({ jobId, results });
  } catch (err) {
    console.error(`[${jobId}] Error:`, err.message);
    if (uploadedPath && fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    klingConfigured: Boolean(process.env.KLING_ACCESS_KEY && process.env.KLING_SECRET_KEY),
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
  });
});

app.listen(PORT, () => {
  console.log(`Product video app running at http://localhost:${PORT}`);
});
