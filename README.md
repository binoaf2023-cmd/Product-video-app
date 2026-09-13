# Product Video Generator

Upload a product photo → get back **3 different creative angle videos**
(Cinematic Reveal, Feature Close-Up, Lifestyle Vibe), each with an
**AI-written voiceover script** turned into real audio, merged onto the video.

- **Video generation**: Kling AI (image-to-video)
- **Script writing + voiceover**: OpenAI (GPT for the script, TTS for the audio)
- **Backend**: Node.js / Express
- **Frontend**: Plain HTML/JS (no build step)

---

## Option A: Run it as a website (works on your Android phone)

This is the easiest way to actually use this from your phone — no coding, no terminal, no computer needed after setup. You'll host it for free on **Render**, then just open the URL in Chrome on your phone.

1. **Create a free GitHub account** at github.com (if you don't have one).
2. **Create a new repository** (click the "+" top right → "New repository"), name it anything (e.g. `product-video-app`), keep it Public, click Create.
3. **Upload your files**: on the new repo's page, click "uploading an existing file", then drag in every file/folder from this project (server.js, package.json, kling.js, media.js, openai.js, public/, render.yaml, .gitignore — skip .env and node_modules, you don't have those anyway). Commit the changes.
4. **Create a free Render account** at render.com, signing in with your GitHub account.
5. On Render, click **New → Web Service**, pick the repo you just created. Render will detect `render.yaml` automatically and pre-fill the settings.
6. Render will ask you to fill in the blank environment variables: paste in your `KLING_ACCESS_KEY`, `KLING_SECRET_KEY`, and `OPENAI_API_KEY`.
7. Click **Create Web Service**. Wait a few minutes for it to build and deploy.
8. Once it says "Live", Render gives you a URL like `https://product-video-app.onrender.com`. Open that on your phone — that's your app.

Notes:
- The free Render plan sleeps after inactivity, so the first request after a while can take ~30-60 seconds to wake up — that's normal, not broken.
- Every time you update the code, re-upload the changed files to GitHub and Render redeploys automatically.

---

## Option B: Run it on your own computer

## 1. Prerequisites

- [Node.js](https://nodejs.org/) v18 or newer
- A **Kling AI** account with API access → https://app.klingai.com/global/dev
  - You need an **Access Key** and **Secret Key** (Kling uses JWT auth, not a plain API key)
- An **OpenAI** account with billing enabled → https://platform.openai.com/api-keys
  - You need a standard API key (used for both GPT script-writing and TTS voice)

> ffmpeg is bundled automatically via the `ffmpeg-static` npm package — you don't need to install it separately.

---

## 2. Setup

```bash
npm install
cp .env.example .env
```

Now open `.env` and fill in your real keys:

```
KLING_ACCESS_KEY=your_real_key
KLING_SECRET_KEY=your_real_secret
OPENAI_API_KEY=sk-...
```

---

## 3. Run it

```bash
npm start
```

Then open **http://localhost:3000** in your browser.

Upload a product photo, optionally add a product name / extra context, and hit
**Generate Videos**. Generation takes a few minutes since it's producing
3 separate videos + 3 voiceovers + merging them.

---

## 4. How it works

For each of the 3 creative "angles":

1. **GPT writes** a short voiceover line + a matching camera-motion prompt
   (e.g. "slow 360° rotation with soft rim lighting").
2. **Kling AI** turns your photo + that motion prompt into a 5-second video.
3. **OpenAI TTS** turns the voiceover line into an mp3.
4. **ffmpeg** merges the video and voiceover into one final `.mp4`.

Finished videos are saved in `output/` and served at
`http://localhost:3000/output/...`.

---

## 5. Customizing

- **Change the angles**: edit the `ANGLES` array in `server.js`.
- **Change the voice**: edit `OPENAI_TTS_VOICE` in `.env` (options: alloy, echo, fable, onyx, nova, shimmer).
- **Change video length**: edit `duration` per angle in `server.js` (Kling supports `"5"` or `"10"` seconds depending on model/mode).
- **Change the Kling model/mode**: edit `modelName` / `mode` in `kling.js`'s `submitImageToVideoTask` defaults, or pass them through from `server.js`.

---

## 6. Notes & limitations

- **Costs**: Every generation run calls Kling AI (video, the most expensive part) 3 times, plus 3 GPT calls and 3 TTS calls. Check your Kling/OpenAI pricing before running this at scale.
- **Processing time**: Video generation is the slow part — expect 1–3 minutes per angle, so ~3–9 minutes total per product photo.
- **Audio/video length mismatch**: if the voiceover is longer than the generated video clip, the merge step trims to the shorter of the two (see `mergeVideoWithAudio` in `media.js`) — you may want to adjust video duration or shorten scripts if this happens often.
- **This app is not deployed anywhere** — it runs on your own machine/server so your API keys stay private. If you want to put this online for others to use, you'll need to deploy the backend (e.g. Render, Railway, a VPS) and add your own auth/rate-limiting so people can't rack up charges on your API keys.
- **Kling API details** (endpoints, JWT format, response shape) were current as of this build, but third-party APIs change — if you hit auth or schema errors, check Kling's latest docs at https://app.klingai.com/global/dev.
