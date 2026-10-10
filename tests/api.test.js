// Unit & API Integration Tests for VOXA Studio
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { server, validateTtsRequest, SUPPORTED_MODELS, CURATED_DEFAULT_VOICES } = require('../server.js');

const TEST_PORT = 3199;

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          json: () => {
            try {
              return JSON.parse(data);
            } catch (_) {
              return null;
            }
          }
        });
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

test('VOXA Validation & API Suite', async (t) => {
  // Start server on test port
  await new Promise(resolve => server.listen(TEST_PORT, resolve));

  t.after(() => {
    server.close();
  });

  await t.test('validateTtsRequest rejects missing body or non-object', () => {
    assert.equal(validateTtsRequest(null).valid, false);
    assert.equal(validateTtsRequest('text').valid, false);
  });

  await t.test('validateTtsRequest rejects empty or whitespace-only text', () => {
    const res1 = validateTtsRequest({ text: '', voiceId: '21m00Tcm4TlvDq8ikWAM' });
    assert.equal(res1.valid, false);
    assert.match(res1.error, /cannot be empty/i);

    const res2 = validateTtsRequest({ text: '    \n  ', voiceId: '21m00Tcm4TlvDq8ikWAM' });
    assert.equal(res2.valid, false);
  });

  await t.test('validateTtsRequest rejects text exceeding 5,000 characters', () => {
    const hugeText = 'a'.repeat(5001);
    const res = validateTtsRequest({ text: hugeText, voiceId: '21m00Tcm4TlvDq8ikWAM' });
    assert.equal(res.valid, false);
    assert.match(res.error, /exceeds maximum limit/i);
  });

  await t.test('validateTtsRequest rejects invalid voiceId', () => {
    const res = validateTtsRequest({ text: 'Hello world', voiceId: 'invalid voice id with spaces!' });
    assert.equal(res.valid, false);
    assert.match(res.error, /Invalid or missing "voiceId"/i);
  });

  await t.test('validateTtsRequest validates voice settings boundaries', () => {
    const res1 = validateTtsRequest({
      text: 'Hello world',
      voiceId: '21m00Tcm4TlvDq8ikWAM',
      voiceSettings: { stability: 1.5 }
    });
    assert.equal(res1.valid, false);
    assert.match(res1.error, /stability/i);

    const res2 = validateTtsRequest({
      text: 'Hello world',
      voiceId: '21m00Tcm4TlvDq8ikWAM',
      voiceSettings: { similarity_boost: -0.2 }
    });
    assert.equal(res2.valid, false);
    assert.match(res2.error, /similarity_boost/i);
  });

  await t.test('validateTtsRequest succeeds with valid parameters', () => {
    const res = validateTtsRequest({
      text: 'This is a natural test script for speech synthesis.',
      voiceId: '21m00Tcm4TlvDq8ikWAM',
      modelId: 'eleven_multilingual_v2',
      voiceSettings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.1,
        use_speaker_boost: true
      }
    });
    assert.equal(res.valid, true);
  });

  await t.test('GET /api/status returns service info', async () => {
    const res = await request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/status',
      method: 'GET'
    });
    assert.equal(res.statusCode, 200);
    const json = res.json();
    assert.equal(json.ok, true);
    assert.equal(json.service, 'VOXA TTS API');
  });

  await t.test('GET /api/models returns supported models list', async () => {
    const res = await request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/models',
      method: 'GET'
    });
    assert.equal(res.statusCode, 200);
    const json = res.json();
    assert.ok(Array.isArray(json.models));
    assert.ok(json.models.length >= 4);
    assert.ok(json.models.some(m => m.id === 'eleven_multilingual_v2'));
  });

  await t.test('GET /api/voices returns voices array with valid metadata', async () => {
    const res = await request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/voices',
      method: 'GET'
    });
    assert.equal(res.statusCode, 200);
    const json = res.json();
    assert.ok(Array.isArray(json.voices));
    assert.ok(json.voices.length > 0);
    const firstVoice = json.voices[0];
    assert.ok(firstVoice.voice_id);
    assert.ok(firstVoice.name);
  });

  await t.test('POST /api/tts returns 400 when text is empty', async () => {
    const res = await request(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: '/api/tts',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      { text: '', voiceId: '21m00Tcm4TlvDq8ikWAM' }
    );
    assert.equal(res.statusCode, 400);
    const json = res.json();
    assert.equal(json.error, 'VALIDATION_ERROR');
  });

  await t.test('POST /api/tts returns 401 when no API key is set', async () => {
    // Ensure no env key in current test context
    const origKey = process.env.ELEVENLABS_API_KEY;
    delete process.env.ELEVENLABS_API_KEY;

    const res = await request(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: '/api/tts',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      { text: 'Sample text to generate', voiceId: '21m00Tcm4TlvDq8ikWAM' }
    );

    if (origKey) process.env.ELEVENLABS_API_KEY = origKey;

    assert.equal(res.statusCode, 401);
    const json = res.json();
    assert.equal(json.error, 'MISSING_API_KEY');
    assert.match(json.message, /ElevenLabs API key is not configured/i);
  });
});
