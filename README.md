# VOXA — AI Voice Studio

> **Give your words a voice.**  
> A minimalist, typography-led AI text-to-speech studio powered by the **ElevenLabs Text-to-Speech API**.

![VOXA Studio](https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1200&q=80)

---

## 1. Product Vision & Aesthetics

VOXA is designed as an editorial, high-fidelity AI audio workstation combining the aesthetic precision of Linear and Notion with professional sound studio tools:

* **Warm Editorial Palette:** Off-white background (`#F8F7F4`), near-black typography (`#171717`), muted secondary tones (`#6B6864`), and subtle electric violet accents (`#7867F0`).
* **Distraction-Free Script Editor:** Real-time character counter, reading duration estimation, and one-click script presets (Podcast, Story, Keynote, Mindfulness).
* **Neural Fine-Tuning:** Precise sliders for Stability, Timbre Clarity, Style Exaggeration, and Speaker Presence Boost.
* **Audio Studio Player:** Scrubbable HTML5 canvas waveform visualizer, variable playback rate (0.75x – 2.0x), volume control, and one-click `.mp3` export.
* **Local Offline Audio Library:** Persisted via browser `IndexedDB` with direct replay, download, and script restoration.
* **Security First:** Strict server-side proxy prevents API key leakage; supports both server-side `.env.local` configuration and in-browser session settings.

---

## 2. Quick Start

### Prerequisites
* **Node.js** (v18.0.0 or later, including Node 20 / 22 / 24).
* (Optional) An **ElevenLabs API Key** from [elevenlabs.io](https://elevenlabs.io/app/settings/api-keys).

### Installation & Running

1. **Clone or navigate to the directory:**
   ```bash
   cd Elevenlabs
   ```

2. **Configure your API Key:**
   Copy `.env.example` to `.env.local` and add your key:
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local`:
   ```env
   ELEVENLABS_API_KEY=your_actual_elevenlabs_api_key_here
   PORT=3000
   ```
   *(Note: If you run without setting a key in `.env.local`, VOXA runs in Demo / Client Key Mode and allows you to enter your key directly via the Studio Settings modal in the browser).*

3. **Start the Studio Server:**
   ```bash
   node server.js
   ```
   Or using npm:
   ```bash
   npm start
   ```

4. **Open in Browser:**
   Navigate to [http://localhost:3000](http://localhost:3000).

---

## 3. Running Automated Tests

VOXA includes an automated test suite verifying schema validation, boundary limits, and API route responses using the native Node.js test runner:

```bash
node --test tests/api.test.js
```

---

## 4. API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/status` | Returns server health and whether a server-side API key is loaded. |
| `GET` | `/api/voices` | Returns ElevenLabs voice library with accents, genders, and preview clips. |
| `GET` | `/api/models` | Lists supported ElevenLabs speech models (`eleven_multilingual_v2`, `eleven_turbo_v2_5`, etc.). |
| `POST` | `/api/tts` | Synthesizes text into high-fidelity MPEG audio stream using ElevenLabs TTS. |
| `POST` | `/api/validate-key` | Verifies an API key with ElevenLabs subscription endpoint and returns tier & quota. |

### Sample Speech Generation Request:
```bash
curl -X POST http://localhost:3000/api/tts \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_KEY_IF_NOT_IN_ENV" \
  -d '{
    "text": "The first move is what sets everything in motion.",
    "voiceId": "21m00Tcm4TlvDq8ikWAM",
    "modelId": "eleven_multilingual_v2",
    "voiceSettings": {
      "stability": 0.5,
      "similarity_boost": 0.75,
      "style": 0.0,
      "use_speaker_boost": true
    }
  }' \
  --output speech.mp3
```

---

## 5. Security & Privacy Guarantees

* **Zero Client-Side Secret Exposure:** The frontend never embeds or logs secrets.
* **Server-Side Validation:** All text payloads are strictly validated for length (up to 5,000 characters), character encoding, and sanitized IDs.
* **Rate Limiting:** Built-in sliding-window limiter prevents upstream quota drain or duplicate submissions.
* **Offline Storage:** Generated audio files are stored locally in the browser's `IndexedDB` sandbox, never uploaded to third-party tracking services.

---

## 6. License

MIT License. Designed with care for high-fidelity audio creators.
