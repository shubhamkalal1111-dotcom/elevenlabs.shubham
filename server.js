// VOXA - ElevenLabs AI Voice Studio Server
// High-performance Node.js server with ElevenLabs API integration

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');

// Simple .env parser to avoid external dependencies
function loadEnv() {
  const envFiles = ['.env.local', '.env'];
  for (const envFile of envFiles) {
    const fullPath = path.join(__dirname, envFile);
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        content.split('\n').forEach(line => {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const eqIndex = trimmed.indexOf('=');
            if (eqIndex > 0) {
              const key = trimmed.slice(0, eqIndex).trim();
              const val = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, '');
              if (!process.env[key]) {
                process.env[key] = val;
              }
            }
          }
        });
      } catch (err) {
        console.warn(`[ENV] Failed to load ${envFile}:`, err.message);
      }
    }
  }
}

loadEnv();

const PORT = parseInt(process.env.PORT || '3000', 10);
const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';

// Supported Models
const SUPPORTED_MODELS = [
  {
    id: 'eleven_multilingual_v2',
    name: 'Eleven Multilingual v2',
    badge: 'Recommended',
    description: 'Most emotionally rich and expressive model. Supports 29 languages with authentic accents.',
    languages: '29 Languages',
    latency: 'Normal'
  },
  {
    id: 'eleven_turbo_v2_5',
    name: 'Eleven Turbo v2.5',
    badge: 'Low Latency',
    description: 'Optimized for high-speed generation with minimal latency while retaining expressive natural tone.',
    languages: 'Multilingual',
    latency: 'Fast (~250ms)'
  },
  {
    id: 'eleven_flash_v2_5',
    name: 'Eleven Flash v2.5',
    badge: 'Ultra Fast',
    description: 'Ultra-lightweight, blazing-fast inference for real-time interactions and low-latency workflows.',
    languages: 'Multilingual',
    latency: 'Ultra Fast (~75ms)'
  },
  {
    id: 'eleven_monolingual_v1',
    name: 'Eleven English v1',
    badge: 'Legacy',
    description: 'Original English-focused speech synthesis model with stable pacing.',
    languages: 'English only',
    latency: 'Standard'
  }
];

// Set of verified stock premade voices that are 100% compatible with Free Tier API accounts
const FREE_TIER_VOICE_IDS = new Set([
  '21m00Tcm4TlvDq8ikWAM', // Rachel
  'pNInz6obpgDQGcFmaJgB', // Adam
  'ErXwobaYiN019PkySvjV', // Antoni
  'EXAVITQu4vr4xnSDxMaL', // Bella
  'TxGEqnHWrfWFTfGW9XjX', // Josh
  'VR6AewLTigWG4xSOukaG', // Arnold
  'AZnzlk1XvdvUeBnXmlld', // Domi
  'MF3mGyEYCl7XYWbV9V6O', // Elli
  'yoZ06a0KnDZ61xBiGnL3', // Sam
  'IKne3meq5aSn9XLyUdCD', // Charlie
  'JBFqnCBsd6RMkjVDRZzb', // George
  'Xb7hH8MSUJpSbSDYk0k2', // Alice
  'TX3LPaxmHKxFdv7VOQHJ', // Liam
  'cgSgspJ2msm6clMCkdW9', // Jessica
  'onwK4e9ZLuTAKqWW03F9', // Daniel
  'pFZP5JQG7iQjIQuC4Bku', // Lily
  'pqHfZKP75CvOlQylNhV4', // Bill
  'bIHbv24MWmeRgasZH58o', // Will
  'XrExE9yKIg1WjnnlVkGX', // Matilda
  'cjVigY5qzO86Huf0OWal', // Eric
  'iP95p4xoKVk53GoZ742B', // Chris
  'nPczCjzI2devNBz1zQrb'  // Brian
]);

// Curated premier ElevenLabs voices with verified preview audio
const CURATED_DEFAULT_VOICES = [
  {
    voice_id: '21m00Tcm4TlvDq8ikWAM',
    name: 'Rachel',
    description: 'Calm, soothing, and clear voice. Great for narrations, audiobooks, and meditations.',
    category: 'premade',
    isFreeTier: true,
    labels: { gender: 'female', accent: 'american', age: 'young', use_case: 'narration', descriptive: 'calm' },
    preview_url: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/21m00Tcm4TlvDq8ikWAM/df728876-0563-4428-a573-04ff46b7ff06.mp3'
  },
  {
    voice_id: 'pNInz6obpgDQGcFmaJgB',
    name: 'Adam',
    description: 'Deep, resonant, authoritative male voice with warm narration tones.',
    category: 'premade',
    isFreeTier: true,
    labels: { gender: 'male', accent: 'american', age: 'middle_aged', use_case: 'narration', descriptive: 'deep' },
    preview_url: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/pNInz6obpgDQGcFmaJgB/66760b86-6207-44ae-b514-411a0b388275.mp3'
  },
  {
    voice_id: 'ErXwobaYiN019PkySvjV',
    name: 'Antoni',
    description: 'Well-rounded, engaging, and versatile young male voice suited for storytelling.',
    category: 'premade',
    isFreeTier: true,
    labels: { gender: 'male', accent: 'american', age: 'young', use_case: 'storytelling', descriptive: 'clear' },
    preview_url: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/ErXwobaYiN019PkySvjV/38d8f8f0-0412-4217-8e6d-2d4e8c1ea98f.mp3'
  },
  {
    voice_id: 'EXAVITQu4vr4xnSDxMaL',
    name: 'Bella',
    description: 'Soft, delicate, and articulate female voice with natural emotional cadence.',
    category: 'premade',
    isFreeTier: true,
    labels: { gender: 'female', accent: 'american', age: 'young', use_case: 'conversational', descriptive: 'soft' },
    preview_url: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/EXAVITQu4vr4xnSDxMaL/09d73357-1944-4f0e-9fa2-f478a6669528.mp3'
  },
  {
    voice_id: 'TxGEqnHWrfWFTfGW9XjX',
    name: 'Josh',
    description: 'Deep, warm, and natural young male voice for expressive narrative reads.',
    category: 'premade',
    isFreeTier: true,
    labels: { gender: 'male', accent: 'american', age: 'young', use_case: 'narration', descriptive: 'deep' },
    preview_url: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/TxGEqnHWrfWFTfGW9XjX/ee414c55-f716-43fa-a67b-466d0b985473.mp3'
  },
  {
    voice_id: 'JBFqnCBsd6RMkjVDRZzb',
    name: 'George',
    description: 'Warm, refined British gentleman voice. Elegant cadence for documentaries.',
    category: 'premade',
    isFreeTier: true,
    labels: { gender: 'male', accent: 'british', age: 'middle_aged', use_case: 'narration', descriptive: 'warm' },
    preview_url: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/JBFqnCBsd6RMkjVDRZzb/e6206d1a-0721-47bc-8025-631762893301.mp3'
  },
  {
    voice_id: 'Xb7hH8MSUJpSbSDYk0k2',
    name: 'Alice',
    description: 'Confident, articulate, and poised British female voice. Ideal for news and education.',
    category: 'premade',
    isFreeTier: true,
    labels: { gender: 'female', accent: 'british', age: 'middle_aged', use_case: 'news', descriptive: 'confident' },
    preview_url: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/Xb7hH8MSUJpSbSDYk0k2/d1079831-4876-42c2-8411-fa0ab6f76c59.mp3'
  },
  {
    voice_id: 'TX3LPaxmHKxFdv7VOQHJ',
    name: 'Liam',
    description: 'Energetic, modern, young American male voice. Perfect for social media and commercials.',
    category: 'premade',
    isFreeTier: true,
    labels: { gender: 'male', accent: 'american', age: 'young', use_case: 'conversational', descriptive: 'energetic' },
    preview_url: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/TX3LPaxmHKxFdv7VOQHJ/63148076-6363-42db-aea8-31424308b92c.mp3'
  },
  {
    voice_id: 'cgSgspJ2msm6clMCkdW9',
    name: 'Jessica',
    description: 'Playful, bright, and conversational young female voice for podcasts and lifestyle.',
    category: 'premade',
    isFreeTier: true,
    labels: { gender: 'female', accent: 'american', age: 'young', use_case: 'conversational', descriptive: 'expressive' },
    preview_url: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/cgSgspJ2msm6clMCkdW9/56a97bf8-b69b-448f-846c-c3a11683d45a.mp3'
  },
  {
    voice_id: 'onwK4e9ZLuTAKqWW03F9',
    name: 'Daniel',
    description: 'Authoritative, distinguished British presenter voice. Resonant and composed.',
    category: 'premade',
    isFreeTier: true,
    labels: { gender: 'male', accent: 'british', age: 'middle_aged', use_case: 'news', descriptive: 'authoritative' },
    preview_url: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/onwK4e9ZLuTAKqWW03F9/7ee02048-844c-4d10-9545-023e8081692e.mp3'
  },
  {
    voice_id: 'pFZP5JQG7iQjIQuC4Bku',
    name: 'Lily',
    description: 'Warm, melodious British female voice with gentle pacing.',
    category: 'premade',
    isFreeTier: true,
    labels: { gender: 'female', accent: 'british', age: 'middle_aged', use_case: 'narration', descriptive: 'warm' },
    preview_url: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/pFZP5JQG7iQjIQuC4Bku/895f708d-88d4-42b4-845a-c9dfad95e7c0.mp3'
  }
];

// Simple in-memory rate limiting map: ip -> timestamps[]
const rateLimits = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 30; // 30 requests / min
  const records = rateLimits.get(ip) || [];
  const validRecords = records.filter(ts => now - ts < windowMs);
  if (validRecords.length >= maxRequests) {
    return true;
  }
  validRecords.push(now);
  rateLimits.set(ip, validRecords);
  return false;
}

// Request validation schema helper
function validateTtsRequest(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a valid JSON object.' };
  }

  const { text, voiceId, modelId, voiceSettings } = body;

  if (typeof text !== 'string') {
    return { valid: false, error: 'The "text" field is required and must be a string.' };
  }

  const trimmedText = text.trim();
  if (trimmedText.length === 0) {
    return { valid: false, error: 'The "text" field cannot be empty. Please enter your script.' };
  }

  if (trimmedText.length > 5000) {
    return { valid: false, error: `Script exceeds maximum limit of 5,000 characters (current: ${trimmedText.length}).` };
  }

  if (!voiceId || typeof voiceId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(voiceId)) {
    return { valid: false, error: 'Invalid or missing "voiceId".' };
  }

  if (modelId && typeof modelId === 'string') {
    const validModel = SUPPORTED_MODELS.some(m => m.id === modelId);
    if (!validModel) {
      return { valid: false, error: `Unsupported "modelId". Must be one of: ${SUPPORTED_MODELS.map(m => m.id).join(', ')}` };
    }
  }

  if (voiceSettings && typeof voiceSettings === 'object') {
    const { stability, similarity_boost, style, use_speaker_boost } = voiceSettings;
    if (stability !== undefined && (typeof stability !== 'number' || stability < 0 || stability > 1)) {
      return { valid: false, error: '"stability" must be a number between 0.0 and 1.0.' };
    }
    if (similarity_boost !== undefined && (typeof similarity_boost !== 'number' || similarity_boost < 0 || similarity_boost > 1)) {
      return { valid: false, error: '"similarity_boost" must be a number between 0.0 and 1.0.' };
    }
    if (style !== undefined && (typeof style !== 'number' || style < 0 || style > 1)) {
      return { valid: false, error: '"style" must be a number between 0.0 and 1.0.' };
    }
    if (use_speaker_boost !== undefined && typeof use_speaker_boost !== 'boolean') {
      return { valid: false, error: '"use_speaker_boost" must be a boolean.' };
    }
  }

  return { valid: true };
}

// Read body helper
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 10 * 1024 * 1024) { // 10MB safety limit
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        const parsed = data ? JSON.parse(data) : {};
        resolve(parsed);
      } catch (err) {
        reject(new Error('Malformed JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

// MIME types map
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2'
};

// Main HTTP request handler
async function handleRequest(req, res) {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;
  const method = req.method.toUpperCase();
  const clientIp = req.socket.remoteAddress || '127.0.0.1';

  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // CORS headers for local development if needed
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // --- API ROUTE: /api/status ---
  if (pathname === '/api/status' && method === 'GET') {
    const hasEnvKey = Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_API_KEY.trim().length > 0);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      service: 'VOXA TTS API',
      hasServerApiKey: hasEnvKey,
      defaultModel: 'eleven_multilingual_v2',
      port: PORT
    }));
    return;
  }

  // --- API ROUTE: /api/models ---
  if (pathname === '/api/models' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      models: SUPPORTED_MODELS
    }));
    return;
  }

  // --- API ROUTE: /api/voices ---
  if (pathname === '/api/voices' && method === 'GET') {
    const customKey = req.headers['x-api-key'];
    const activeKey = customKey || process.env.ELEVENLABS_API_KEY;

    try {
      const headers = {};
      if (activeKey) {
        headers['xi-api-key'] = activeKey;
      }

      // Fetch from ElevenLabs
      const upstreamRes = await fetch(`${ELEVENLABS_BASE_URL}/voices`, { headers });
      let upstreamVoices = [];

      if (upstreamRes.ok) {
        const data = await upstreamRes.json();
        upstreamVoices = (data.voices || []).map(v => {
          const isStockPremade = FREE_TIER_VOICE_IDS.has(v.voice_id);
          const isUserOwned = v.category === 'cloned' || v.category === 'generated';
          const isFree = isStockPremade || isUserOwned;
          return {
            voice_id: v.voice_id,
            name: v.name,
            description: v.description || (v.labels ? Object.values(v.labels).join(', ') : 'Natural voice'),
            category: v.category || (isFree ? 'premade' : 'library'),
            isFreeTier: isFree,
            requiresPaid: !isFree,
            labels: v.labels || {},
            preview_url: v.preview_url || null,
            high_quality_base_model_ids: v.high_quality_base_model_ids || []
          };
        });
      }

      // Merge with curated default voices to guarantee that Rachel, Adam, Antoni, Bella, Josh, etc. are ALWAYS present
      const voiceMap = new Map();
      CURATED_DEFAULT_VOICES.forEach(cv => {
        voiceMap.set(cv.voice_id, { ...cv, isFreeTier: true, requiresPaid: false });
      });

      upstreamVoices.forEach(uv => {
        if (voiceMap.has(uv.voice_id)) {
          const existing = voiceMap.get(uv.voice_id);
          voiceMap.set(uv.voice_id, { ...existing, ...uv, isFreeTier: true, requiresPaid: false });
        } else {
          voiceMap.set(uv.voice_id, uv);
        }
      });

      // Sort: Free Tier voices first (Rachel as #1), then remaining voices
      const allVoices = Array.from(voiceMap.values()).sort((a, b) => {
        if (a.voice_id === '21m00Tcm4TlvDq8ikWAM') return -1;
        if (b.voice_id === '21m00Tcm4TlvDq8ikWAM') return 1;
        if (a.isFreeTier && !b.isFreeTier) return -1;
        if (!a.isFreeTier && b.isFreeTier) return 1;
        return a.name.localeCompare(b.name);
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ voices: allVoices, source: upstreamRes.ok ? 'live_merged' : 'curated_defaults' }));
      return;
    } catch (err) {
      console.warn('[VOICES] Upstream fetch failed, using curated voices:', err.message);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ voices: CURATED_DEFAULT_VOICES, source: 'curated_cache' }));
      return;
    }
  }

  // --- API ROUTE: /api/validate-key ---
  if (pathname === '/api/validate-key' && method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const testKey = (body.apiKey || '').trim() || req.headers['x-api-key'] || process.env.ELEVENLABS_API_KEY;

      if (!testKey) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ valid: false, error: 'No API key provided.' }));
        return;
      }

      const upstream = await fetch(`${ELEVENLABS_BASE_URL}/user/subscription`, {
        headers: { 'xi-api-key': testKey }
      });

      if (upstream.ok) {
        const sub = await upstream.json();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          valid: true,
          tier: sub.tier,
          characterCount: sub.character_count,
          characterLimit: sub.character_limit,
          remainingCharacters: Math.max(0, (sub.character_limit || 0) - (sub.character_count || 0))
        }));
      } else {
        const errData = await upstream.json().catch(() => ({}));
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          valid: false,
          error: errData.detail?.message || 'Invalid ElevenLabs API key.'
        }));
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ valid: false, error: err.message }));
    }
    return;
  }

  // --- API ROUTE: /api/tts ---
  if (pathname === '/api/tts' && method === 'POST') {
    // 1. Rate limiting check
    if (isRateLimited(clientIp)) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many generation requests. Please wait a few moments before trying again.'
      }));
      return;
    }

    // 2. Parse & Validate body
    let body;
    try {
      body = await parseJsonBody(req);
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'INVALID_BODY', message: err.message }));
      return;
    }

    const validation = validateTtsRequest(body);
    if (!validation.valid) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'VALIDATION_ERROR', message: validation.error }));
      return;
    }

    // 3. Resolve API Key
    const apiKey = (req.headers['x-api-key'] || body.customApiKey || process.env.ELEVENLABS_API_KEY || '').trim();
    if (!apiKey) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'MISSING_API_KEY',
        message: 'ElevenLabs API key is not configured. Please add ELEVENLABS_API_KEY to your .env.local file or enter it in Studio Settings to generate speech.'
      }));
      return;
    }

    const { text, voiceId, modelId = 'eleven_multilingual_v2', voiceSettings } = body;

    // Default voice settings according to ElevenLabs recommendations
    const payload = {
      text: text.trim(),
      model_id: modelId,
      voice_settings: {
        stability: typeof voiceSettings?.stability === 'number' ? voiceSettings.stability : 0.5,
        similarity_boost: typeof voiceSettings?.similarity_boost === 'number' ? voiceSettings.similarity_boost : 0.75,
        style: typeof voiceSettings?.style === 'number' ? voiceSettings.style : 0.0,
        use_speaker_boost: typeof voiceSettings?.use_speaker_boost === 'boolean' ? voiceSettings.use_speaker_boost : true
      }
    };

    try {
      const upstreamUrl = `${ELEVENLABS_BASE_URL}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`;
      const upstreamRes = await fetch(upstreamUrl, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        body: JSON.stringify(payload)
      });

      if (!upstreamRes.ok) {
        let errMessage = 'ElevenLabs generation failed.';
        let errCode = 'ELEVENLABS_ERROR';
        try {
          const errData = await upstreamRes.json();
          if (errData && errData.detail) {
            errMessage = typeof errData.detail === 'string' ? errData.detail : (errData.detail.message || JSON.stringify(errData.detail));
            errCode = errData.detail.status || errCode;
          }
        } catch (_) {
          errMessage = `ElevenLabs API returned status HTTP ${upstreamRes.status} (${upstreamRes.statusText})`;
        }

        const lowerMsg = (errMessage || '').toLowerCase();
        let statusCode = upstreamRes.status;

        // Check specifically for Free Tier vs Library voice restriction
        if (lowerMsg.includes('library voice') || lowerMsg.includes('library_voice') || lowerMsg.includes('free users cannot use')) {
          errCode = 'LIBRARY_VOICE_NOT_ALLOWED';
          errMessage = 'Free ElevenLabs accounts cannot use Community Library voices via the API. Please switch to a Free Tier Default voice (such as Rachel, Adam, Antoni, or Josh) to synthesize speech.';
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: errCode,
            message: errMessage,
            isLibraryVoiceError: true,
            suggestedVoiceId: '21m00Tcm4TlvDq8ikWAM',
            suggestedVoiceName: 'Rachel'
          }));
          return;
        }

        // Map other status codes cleanly
        if (upstreamRes.status === 401) {
          errCode = 'INVALID_API_KEY';
          errMessage = 'Your ElevenLabs API key is invalid or unauthorized. Please verify your credentials.';
        } else if (upstreamRes.status === 429) {
          errCode = 'ELEVENLABS_RATE_LIMIT';
          errMessage = 'ElevenLabs rate limit or quota exceeded. Please check your account usage.';
        }

        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: errCode, message: errMessage }));
        return;
      }

      // Convert response stream to buffer & stream back
      const audioBuffer = await upstreamRes.arrayBuffer();
      const nodeBuffer = Buffer.from(audioBuffer);

      res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Content-Length': nodeBuffer.length,
        'Content-Disposition': `inline; filename="voxa-${voiceId}-${Date.now()}.mp3"`,
        'Cache-Control': 'no-cache'
      });
      res.end(nodeBuffer);
      return;

    } catch (err) {
      console.error('[TTS_ERROR]', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'SERVER_ERROR',
        message: `An unexpected server error occurred while connecting to ElevenLabs: ${err.message}`
      }));
      return;
    }
  }

  // --- STATIC FILE SERVING ---
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);

  // Security check to avoid path traversal
  const normalized = path.normalize(filePath);
  if (!normalized.startsWith(path.normalize(__dirname))) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(normalized, (err, stats) => {
    if (err || !stats.isFile()) {
      // Default fallback to index.html for SPA routing if requested HTML
      if (req.headers.accept && req.headers.accept.includes('text/html')) {
        const fallbackPath = path.join(__dirname, 'index.html');
        return fs.readFile(fallbackPath, (readErr, data) => {
          if (readErr) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(data);
        });
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File Not Found');
      return;
    }

    const ext = path.extname(normalized).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Support HTTP Range requests for seeking audio
    const range = req.headers.range;
    if (range && stats.size > 0) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;

      if (start >= stats.size || end >= stats.size) {
        res.writeHead(416, { 'Content-Range': `bytes */${stats.size}` });
        res.end();
        return;
      }

      const chunksize = end - start + 1;
      const fileStream = fs.createReadStream(normalized, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stats.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType
      });
      fileStream.pipe(res);
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Accept-Ranges': 'bytes',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
    });
    fs.createReadStream(normalized).pipe(res);
  });
}

const server = http.createServer(handleRequest);

// Export for tests or run directly
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`  VOXA Studio is running at: http://localhost:${PORT}`);
    console.log(`  ElevenLabs API Key: ${process.env.ELEVENLABS_API_KEY ? 'CONFIGURED (Active)' : 'NOT SET (Demo / Client Key Mode)'}`);
    console.log(`==================================================\n`);
  });
}

module.exports = {
  server,
  validateTtsRequest,
  SUPPORTED_MODELS,
  CURATED_DEFAULT_VOICES
};
