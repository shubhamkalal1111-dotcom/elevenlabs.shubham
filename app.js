/**
 * VOXA — AI Voice Studio Frontend Engine
 * Complete, production-grade text-to-speech studio controller.
 */

// --- UTILITY: Toast Notifications ---
const Toast = {
  container: null,
  init() {
    this.container = document.getElementById('toast-container');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  },
  show(message, type = 'info', duration = 3500) {
    this.init();
    const el = document.createElement('div');
    el.className = `toast ${type === 'error' ? 'toast-error' : type === 'success' ? 'toast-success' : ''}`;
    
    let iconSvg = '';
    if (type === 'error') {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    } else if (type === 'success') {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
    } else {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    }

    el.innerHTML = `${iconSvg}<span>${message}</span>`;
    this.container.appendChild(el);

    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      el.style.transition = 'all 0.2s ease';
      setTimeout(() => el.remove(), 250);
    }, duration);
  }
};

// --- STORAGE: IndexedDB for Local History ---
const Storage = {
  dbName: 'voxa_studio_db',
  dbVersion: 1,
  db: null,

  async init() {
    if (!window.indexedDB) {
      console.warn('[STORAGE] IndexedDB not supported; fallback to memory/localStorage.');
      return;
    }
    return new Promise((resolve) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      request.onerror = () => {
        console.error('[STORAGE] Error opening IndexedDB:', request.error);
        resolve(null);
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('generations')) {
          const store = db.createObjectStore('generations', { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
    });
  },

  async saveGeneration(item) {
    if (!this.db) await this.init();
    if (!this.db) {
      // LocalStorage fallback
      try {
        const items = JSON.parse(localStorage.getItem('voxa_generations') || '[]');
        // Don't store large blob in localStorage
        const safeItem = { ...item, audioBlob: null };
        items.unshift(safeItem);
        localStorage.setItem('voxa_generations', JSON.stringify(items.slice(0, 20)));
      } catch (_) {}
      return;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('generations', 'readwrite');
      const store = tx.objectStore('generations');
      const req = store.put(item);
      req.onsuccess = () => resolve(item);
      req.onerror = () => reject(req.error);
    });
  },

  async getGenerations() {
    if (!this.db) await this.init();
    if (!this.db) {
      try {
        return JSON.parse(localStorage.getItem('voxa_generations') || '[]');
      } catch (_) {
        return [];
      }
    }

    return new Promise((resolve) => {
      const tx = this.db.transaction('generations', 'readonly');
      const store = tx.objectStore('generations');
      const req = store.getAll();
      req.onsuccess = () => {
        const items = req.result || [];
        items.sort((a, b) => b.createdAt - a.createdAt);
        resolve(items);
      };
      req.onerror = () => resolve([]);
    });
  },

  async deleteGeneration(id) {
    if (!this.db) await this.init();
    if (!this.db) {
      try {
        let items = JSON.parse(localStorage.getItem('voxa_generations') || '[]');
        items = items.filter(x => x.id !== id);
        localStorage.setItem('voxa_generations', JSON.stringify(items));
      } catch (_) {}
      return;
    }

    return new Promise((resolve) => {
      const tx = this.db.transaction('generations', 'readwrite');
      const store = tx.objectStore('generations');
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  },

  async clearAll() {
    if (!this.db) await this.init();
    if (!this.db) {
      localStorage.removeItem('voxa_generations');
      return;
    }
    return new Promise((resolve) => {
      const tx = this.db.transaction('generations', 'readwrite');
      const store = tx.objectStore('generations');
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  }
};

// --- STATE MANAGEMENT ---
const AppState = {
  voices: [],
  selectedVoice: null,
  selectedModel: 'eleven_multilingual_v2',
  stability: 0.50,
  similarity: 0.75,
  style: 0.0,
  speakerBoost: true,
  serverStatus: { ok: false, hasServerApiKey: false },
  clientApiKey: localStorage.getItem('voxa_client_api_key') || '',
  activeAuditionAudio: null,
  activeAuditionButton: null,
  isGenerating: false,
  currentAudioBlob: null,
  currentAudioUrl: null
};

// --- SCRIPT PRESETS ---
const PRESETS = {
  podcast: "Welcome to The Daily Spark. Today, we delve into how generative audio models and synthetic speech are reshaping our creative boundaries, enabling ideas to breathe and stories to find their voice with uncanny realism.",
  narration: "The valley lay bathed in the amber glow of the fading sun. Far in the distance, ancient pine trees stood like silent sentinels, guarding secrets whispered by winds that had traveled across forgotten millennia.",
  keynote: "Good morning. We are thrilled to introduce VOXA Studio today. Designed for creators who refuse to compromise on vocal fidelity, emotional range, or production velocity. This is speech synthesis, elevated.",
  meditation: "Take a deep, slow breath in through your nose... and gently let it go. Allow your shoulders to drop, releasing the weight of the day, and let yourself settle completely into the stillness of this moment."
};

// --- WAVEFORM VISUALIZER COMPONENT ---
class WaveformVisualizer {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.barCount = options.barCount || 48;
    this.barWidth = options.barWidth || 3;
    this.barGap = options.barGap || 3;
    this.colorIdle = options.colorIdle || '#aec7ca';
    this.colorActive = options.colorActive || '#31493c';
    this.heights = [];
    this.progress = 0;
    this.isPlaying = false;
    this.animId = null;

    this.initHeights();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  initHeights() {
    // Generate organic undulating waveform pattern
    this.heights = [];
    for (let i = 0; i < this.barCount; i++) {
      const sinVal = Math.sin((i / this.barCount) * Math.PI);
      const noise = 0.35 + Math.random() * 0.65;
      const h = Math.max(0.15, sinVal * noise);
      this.heights.push(h);
    }
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * (window.devicePixelRatio || 1);
    this.canvas.height = rect.height * (window.devicePixelRatio || 1);
    this.ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    this.draw();
  }

  setProgress(progress) {
    this.progress = Math.max(0, Math.min(1, progress));
    this.draw();
  }

  setPlaying(playing) {
    this.isPlaying = playing;
    if (playing) {
      this.animate();
    } else {
      if (this.animId) cancelAnimationFrame(this.animId);
      this.draw();
    }
  }

  animate() {
    if (!this.isPlaying) return;
    this.draw(true);
    this.animId = requestAnimationFrame(() => this.animate());
  }

  draw(isLive = false) {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    this.ctx.clearRect(0, 0, w, h);

    const totalBarWidth = (w - (this.barCount - 1) * this.barGap) / this.barCount;
    const activeIndex = Math.floor(this.progress * this.barCount);
    const now = Date.now() * 0.005;

    for (let i = 0; i < this.barCount; i++) {
      let barH = this.heights[i] * (h * 0.75);
      if (isLive && i <= activeIndex) {
        // Micro animation wave during live playback
        const wave = Math.sin(now + i * 0.35) * 4;
        barH = Math.max(4, barH + wave);
      }

      const x = i * (totalBarWidth + this.barGap);
      const y = (h - barH) / 2;

      this.ctx.fillStyle = i <= activeIndex ? this.colorActive : this.colorIdle;
      this.ctx.beginPath();
      this.ctx.roundRect(x, y, Math.max(2, totalBarWidth), barH, [2]);
      this.ctx.fill();
    }
  }
}

// --- STUDIO AUDIO PLAYER ---
const StudioPlayer = {
  audio: new Audio(),
  visualizer: null,
  currentBlob: null,
  currentFilename: 'voxa-speech.mp3',
  cardEl: null,

  init() {
    this.cardEl = document.getElementById('studio-audio-player-card');
    const canvas = document.getElementById('studio-waveform-canvas');
    if (canvas) {
      this.visualizer = new WaveformVisualizer(canvas);
      
      // Click canvas to seek
      canvas.parentElement.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const pct = clickX / rect.width;
        if (this.audio.duration) {
          this.audio.currentTime = pct * this.audio.duration;
        }
      });
    }

    // Audio element listeners
    this.audio.addEventListener('timeupdate', () => this.onTimeUpdate());
    this.audio.addEventListener('ended', () => this.onEnded());
    this.audio.addEventListener('pause', () => this.onPause());
    this.audio.addEventListener('play', () => this.onPlay());

    // Play/Pause button
    const btnPlay = document.getElementById('player-btn-play');
    if (btnPlay) {
      btnPlay.addEventListener('click', () => this.togglePlay());
    }

    // Volume slider
    const volSlider = document.getElementById('player-volume-slider');
    if (volSlider) {
      volSlider.addEventListener('input', (e) => {
        this.audio.volume = parseFloat(e.target.value);
      });
    }

    // Speed select
    const speedSelect = document.getElementById('player-speed-select');
    if (speedSelect) {
      speedSelect.addEventListener('change', (e) => {
        this.audio.playbackRate = parseFloat(e.target.value);
      });
    }

    // Download button
    const btnDownload = document.getElementById('player-btn-download');
    if (btnDownload) {
      btnDownload.addEventListener('click', () => this.download());
    }

    // Regenerate button
    const btnRegen = document.getElementById('player-btn-regenerate');
    if (btnRegen) {
      btnRegen.addEventListener('click', () => {
        document.getElementById('btn-generate-speech').click();
      });
    }
  },

  loadAudio(blob, metadata = {}) {
    this.currentBlob = blob;
    const url = URL.createObjectURL(blob);
    this.audio.src = url;
    this.audio.playbackRate = parseFloat(document.getElementById('player-speed-select')?.value || 1);
    this.currentFilename = `voxa-${(metadata.voiceName || 'voice').toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.mp3`;

    // Update metadata tags in player
    const titleEl = document.getElementById('player-voice-title');
    const descEl = document.getElementById('player-voice-desc');
    const avatarEl = document.getElementById('player-voice-avatar');
    if (titleEl) titleEl.textContent = metadata.voiceName || 'ElevenLabs Voice';
    if (descEl) descEl.textContent = `${metadata.modelName || 'Multilingual v2'} • ${metadata.charCount || 0} characters`;
    if (avatarEl) avatarEl.textContent = (metadata.voiceName || 'V').charAt(0).toUpperCase();

    // Show card smoothly
    if (this.cardEl) {
      this.cardEl.style.display = 'flex';
      this.cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    if (this.visualizer) {
      this.visualizer.initHeights();
      this.visualizer.setProgress(0);
      this.visualizer.resize();
    }

    // Auto play on new generation
    this.audio.play().catch(e => console.log('Autoplay prevented:', e.message));
  },

  togglePlay() {
    if (!this.audio.src) return;
    if (this.audio.paused) {
      this.audio.play();
    } else {
      this.audio.pause();
    }
  },

  onPlay() {
    const playIcon = document.getElementById('player-icon-play');
    const pauseIcon = document.getElementById('player-icon-pause');
    if (playIcon) playIcon.style.display = 'none';
    if (pauseIcon) pauseIcon.style.display = 'block';
    if (this.visualizer) this.visualizer.setPlaying(true);
  },

  onPause() {
    const playIcon = document.getElementById('player-icon-play');
    const pauseIcon = document.getElementById('player-icon-pause');
    if (playIcon) playIcon.style.display = 'block';
    if (pauseIcon) pauseIcon.style.display = 'none';
    if (this.visualizer) this.visualizer.setPlaying(false);
  },

  onEnded() {
    this.onPause();
    if (this.visualizer) this.visualizer.setProgress(0);
    this.updateTimeDisplay(0, this.audio.duration || 0);
  },

  onTimeUpdate() {
    const cur = this.audio.currentTime || 0;
    const dur = this.audio.duration || 0;
    const pct = dur > 0 ? cur / dur : 0;

    if (this.visualizer) this.visualizer.setProgress(pct);
    this.updateTimeDisplay(cur, dur);

    const overlay = document.getElementById('studio-waveform-progress');
    if (overlay) overlay.style.width = `${pct * 100}%`;
  },

  updateTimeDisplay(cur, dur) {
    const timeEl = document.getElementById('player-time-display');
    if (timeEl) {
      timeEl.textContent = `${this.formatTime(cur)} / ${this.formatTime(dur)}`;
    }
  },

  formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  },

  download() {
    if (!this.currentBlob) {
      Toast.show('No audio available for download.', 'error');
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(this.currentBlob);
    a.download = this.currentFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    Toast.show('Audio download started.', 'success');
  }
};

// --- HERO DEMO AUDIO PLAYER ---
const HeroPlayer = {
  audio: new Audio(),
  visualizer: null,
  isPlaying: false,

  init() {
    const canvas = document.getElementById('hero-waveform-canvas');
    if (canvas) {
      this.visualizer = new WaveformVisualizer(canvas, {
        barCount: 36,
        colorActive: '#31493c',
        colorIdle: '#d4e5e7'
      });
    }

    const btn = document.getElementById('hero-demo-play-btn');
    if (btn) {
      btn.addEventListener('click', () => this.toggleDemo());
    }

    this.audio.addEventListener('ended', () => {
      this.setPlaying(false);
      if (this.visualizer) this.visualizer.setProgress(0);
    });

    this.audio.addEventListener('timeupdate', () => {
      if (this.audio.duration && this.visualizer) {
        this.visualizer.setProgress(this.audio.currentTime / this.audio.duration);
      }
    });
  },

  toggleDemo() {
    if (this.isPlaying) {
      this.audio.pause();
      this.setPlaying(false);
    } else {
      // Find Rachel or first voice preview URL
      const voice = AppState.voices.find(v => v.name.toLowerCase().includes('rachel')) || AppState.voices[0];
      if (voice && voice.preview_url) {
        this.audio.src = voice.preview_url;
        this.audio.play()
          .then(() => this.setPlaying(true))
          .catch(err => {
            console.warn('Demo play error:', err.message);
            Toast.show('Could not stream preview audio sample.', 'error');
          });
      } else {
        Toast.show('Voice preview audio is loading...', 'info');
      }
    }
  },

  setPlaying(playing) {
    this.isPlaying = playing;
    const playIcon = document.getElementById('hero-demo-icon-play');
    const pauseIcon = document.getElementById('hero-demo-icon-pause');
    if (playIcon) playIcon.style.display = playing ? 'none' : 'block';
    if (pauseIcon) pauseIcon.style.display = playing ? 'block' : 'none';
    if (this.visualizer) this.visualizer.setPlaying(playing);
  }
};

// --- VOICES & CONTROLS MANAGER ---
const VoicesManager = {
  async loadVoices() {
    try {
      const headers = {};
      if (AppState.clientApiKey) {
        headers['x-api-key'] = AppState.clientApiKey;
      }
      const res = await fetch('/api/voices', { headers });
      if (res.ok) {
        const data = await res.json();
        AppState.voices = data.voices || [];
        // Default to Rachel (guaranteed free-tier stock voice)
        AppState.selectedVoice = AppState.voices.find(v => v.voice_id === '21m00Tcm4TlvDq8ikWAM') ||
                                  AppState.voices.find(v => v.isFreeTier) ||
                                  AppState.voices[0];
        this.renderVoiceSelection();
        this.renderVoicesModalGrid('', 'free_tier');
      }
    } catch (err) {
      console.error('[VOICES] Failed to load voices:', err);
    }
  },

  renderVoiceSelection() {
    if (!AppState.voices.length) return;

    // Ensure default to Rachel or first free tier voice
    if (!AppState.selectedVoice) {
      AppState.selectedVoice = AppState.voices.find(v => v.voice_id === '21m00Tcm4TlvDq8ikWAM') ||
                                AppState.voices.find(v => v.isFreeTier) ||
                                AppState.voices[0];
    }

    const current = AppState.selectedVoice;
    const nameEl = document.getElementById('active-voice-name');
    const avatarEl = document.getElementById('active-voice-avatar');
    const descEl = document.getElementById('active-voice-desc');
    const tagsContainer = document.getElementById('active-voice-tags');

    if (nameEl) nameEl.textContent = current.name;
    if (avatarEl) avatarEl.textContent = current.name.charAt(0).toUpperCase();
    if (descEl) descEl.textContent = current.description || 'Natural high-fidelity voice';

    if (tagsContainer) {
      tagsContainer.innerHTML = '';
      
      // Free Tier Compatibility badge
      const freeBadge = document.createElement('span');
      if (current.isFreeTier !== false) {
        freeBadge.className = 'tag-pill';
        freeBadge.style.color = '#059669';
        freeBadge.style.backgroundColor = '#ECFDF5';
        freeBadge.style.borderColor = '#A7F3D0';
        freeBadge.style.fontWeight = '600';
        freeBadge.textContent = '✓ Free Tier Ready';
      } else {
        freeBadge.className = 'tag-pill';
        freeBadge.style.color = '#D97706';
        freeBadge.style.backgroundColor = '#FFFBEB';
        freeBadge.style.borderColor = '#FDE68A';
        freeBadge.style.fontWeight = '600';
        freeBadge.textContent = '⚠ Paid Plan / Credits Required';
      }
      tagsContainer.appendChild(freeBadge);

      const labels = current.labels || {};
      const pills = [labels.accent, labels.gender, labels.use_case, labels.descriptive].filter(Boolean);
      if (pills.length === 0 && current.category) pills.push(current.category);

      pills.slice(0, 2).forEach((tag, idx) => {
        const span = document.createElement('span');
        span.className = `tag-pill ${idx === 0 ? 'accent' : ''}`;
        span.textContent = tag;
        tagsContainer.appendChild(span);
      });
    }

    // Audition preview button in active voice card
    const btnAudition = document.getElementById('btn-audition-active-voice');
    if (btnAudition) {
      btnAudition.onclick = (e) => {
        e.stopPropagation();
        this.toggleAudition(current.preview_url, btnAudition);
      };
    }
  },

  selectVoice(voiceId) {
    const voice = AppState.voices.find(v => v.voice_id === voiceId);
    if (voice) {
      AppState.selectedVoice = voice;
      this.renderVoiceSelection();
      ModalManager.closeAll();
      Toast.show(`Selected voice: ${voice.name}`, 'info');
    }
  },

  toggleAudition(url, btnElement) {
    if (!url) {
      Toast.show('No preview audio available for this voice.', 'info');
      return;
    }

    if (AppState.activeAuditionAudio && AppState.activeAuditionAudio.src === url && !AppState.activeAuditionAudio.paused) {
      // Pause current
      AppState.activeAuditionAudio.pause();
      this.resetAuditionButton(AppState.activeAuditionButton);
      AppState.activeAuditionAudio = null;
      AppState.activeAuditionButton = null;
      return;
    }

    // Stop any existing audition
    if (AppState.activeAuditionAudio) {
      AppState.activeAuditionAudio.pause();
      this.resetAuditionButton(AppState.activeAuditionButton);
    }

    const audio = new Audio(url);
    AppState.activeAuditionAudio = audio;
    AppState.activeAuditionButton = btnElement;

    // Set playing icon
    btnElement.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';

    audio.play().catch(e => {
      console.warn('Audition play failed:', e.message);
      this.resetAuditionButton(btnElement);
    });

    audio.onended = () => {
      this.resetAuditionButton(btnElement);
      AppState.activeAuditionAudio = null;
      AppState.activeAuditionButton = null;
    };
  },

  resetAuditionButton(btn) {
    if (!btn) return;
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
  },

  renderVoicesModalGrid(filterQuery = '', categoryFilter = 'free_tier') {
    const container = document.getElementById('voices-modal-grid');
    if (!container) return;

    let filtered = AppState.voices.filter(v => {
      const matchQuery = !filterQuery || 
        v.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
        (v.description && v.description.toLowerCase().includes(filterQuery.toLowerCase())) ||
        (v.labels && Object.values(v.labels).some(l => String(l).toLowerCase().includes(filterQuery.toLowerCase())));

      if (!matchQuery) return false;

      if (categoryFilter === 'all') return true;
      if (categoryFilter === 'free_tier') return v.isFreeTier !== false;

      const labels = v.labels || {};
      const useCase = (labels.use_case || '').toLowerCase();
      const desc = (labels.descriptive || '').toLowerCase();

      if (categoryFilter === 'narration') return useCase.includes('narrat') || desc.includes('calm') || desc.includes('deep');
      if (categoryFilter === 'conversational') return useCase.includes('conversat') || desc.includes('casual') || desc.includes('friendly');
      if (categoryFilter === 'storytelling') return useCase.includes('story') || desc.includes('expressive');
      if (categoryFilter === 'news') return useCase.includes('news') || desc.includes('authoritative') || desc.includes('confident');
      if (categoryFilter === 'social') return useCase.includes('social') || desc.includes('energetic');

      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--text-secondary);">No voices matched your search criteria.</div>';
      return;
    }

    container.innerHTML = filtered.map(v => {
      const isSelected = AppState.selectedVoice && AppState.selectedVoice.voice_id === v.voice_id;
      const isFree = v.isFreeTier !== false;
      const labels = v.labels || {};
      const pills = [labels.accent, labels.gender, labels.use_case].filter(Boolean);

      return `
        <div class="voice-card-select ${isSelected ? 'selected' : ''}" data-voice-id="${v.voice_id}">
          <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <div class="voice-avatar-badge" style="width: 32px; height: 32px; font-size: 0.8rem; background: ${isFree ? 'linear-gradient(135deg, #171717, #383838)' : 'linear-gradient(135deg, #92400E, #D97706)'}">
                ${v.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
                  <h4 style="font-size: 0.88rem; font-weight: 600; color: var(--text-primary);">${v.name}</h4>
                  ${isFree ? 
                    '<span class="tag-pill" style="color:#059669; background:#ECFDF5; border-color:#A7F3D0; font-size:0.65rem; font-weight:600;">✓ Free Tier</span>' : 
                    '<span class="tag-pill" style="color:#D97706; background:#FFFBEB; border-color:#FDE68A; font-size:0.65rem; font-weight:600;">⚠ Paid / Credits</span>'
                  }
                </div>
                <div style="display: flex; gap: 0.25rem; margin-top: 0.15rem; flex-wrap: wrap;">
                  ${pills.map(p => `<span class="tag-pill">${p}</span>`).join('')}
                </div>
              </div>
            </div>
            ${v.preview_url ? `
              <button class="btn btn-ghost btn-sm btn-audition-item" data-url="${v.preview_url}" title="Audition Voice" style="padding: 0.3rem 0.5rem;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>
              </button>
            ` : ''}
          </div>
          <p style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.4; margin: 0.2rem 0 0.5rem;">
            ${v.description || 'ElevenLabs synthetic voice'}
          </p>
          <button class="btn ${isSelected ? 'btn-primary' : 'btn-secondary'} btn-sm btn-select-voice-action" data-voice-id="${v.voice_id}" style="width: 100%;">
            ${isSelected ? 'Selected' : (isFree ? 'Use This Voice (Free)' : 'Use This Voice (Paid Plan)')}
          </button>
        </div>
      `;
    }).join('');

    // Attach listeners
    container.querySelectorAll('.btn-audition-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleAudition(btn.dataset.url, btn);
      });
    });

    container.querySelectorAll('.btn-select-voice-action').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectVoice(btn.dataset.voiceId);
      });
    });

    container.querySelectorAll('.voice-card-select').forEach(card => {
      card.addEventListener('click', () => {
        this.selectVoice(card.dataset.voiceId);
      });
    });
  }
};

// --- MODAL CONTROLLER ---
const ModalManager = {
  init() {
    // Voice Modal
    const btnChangeVoice = document.getElementById('btn-change-voice');
    const btnActiveVoiceCard = document.getElementById('active-voice-card-box');
    const heroExploreBtn = document.getElementById('hero-explore-voices-btn');
    const navVoicesLink = document.getElementById('nav-voices-link');

    [btnChangeVoice, btnActiveVoiceCard, heroExploreBtn, navVoicesLink].forEach(btn => {
      if (btn) btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.open('voices-modal');
      });
    });

    // API Settings Modal
    const btnApiStatus = document.getElementById('api-status-badge');
    const navSettingsLink = document.getElementById('nav-settings-link');
    const footerSettingsLink = document.getElementById('footer-settings-link');

    [btnApiStatus, navSettingsLink, footerSettingsLink].forEach(btn => {
      if (btn) btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.open('settings-modal');
      });
    });

    // Close buttons & backdrop click
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) this.closeAll();
      });
    });

    document.querySelectorAll('.btn-close-modal').forEach(btn => {
      btn.addEventListener('click', () => this.closeAll());
    });

    // Voice search input in modal
    const searchInput = document.getElementById('voices-modal-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const activeChip = document.querySelector('.category-chip.active');
        const cat = activeChip ? activeChip.dataset.cat : 'all';
        VoicesManager.renderVoicesModalGrid(e.target.value, cat);
      });
    }

    // Category chips in modal
    document.querySelectorAll('.category-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const searchVal = document.getElementById('voices-modal-search')?.value || '';
        VoicesManager.renderVoicesModalGrid(searchVal, chip.dataset.cat);
      });
    });

    // Key validation test button
    const btnTestKey = document.getElementById('btn-validate-api-key');
    if (btnTestKey) {
      btnTestKey.addEventListener('click', () => this.testApiKey());
    }

    // Save key button
    const btnSaveKey = document.getElementById('btn-save-settings');
    if (btnSaveKey) {
      btnSaveKey.addEventListener('click', () => this.saveApiKey());
    }
  },

  open(modalId) {
    const el = document.getElementById(modalId);
    if (el) {
      el.classList.add('open');
      document.body.style.overflow = 'hidden';
      if (modalId === 'voices-modal') {
        VoicesManager.renderVoicesModalGrid();
      } else if (modalId === 'settings-modal') {
        const input = document.getElementById('input-client-api-key');
        if (input) input.value = AppState.clientApiKey;
      }
    }
  },

  closeAll() {
    document.querySelectorAll('.modal-backdrop').forEach(b => b.classList.remove('open'));
    document.body.style.overflow = '';
    // Stop any active audition
    if (AppState.activeAuditionAudio) {
      AppState.activeAuditionAudio.pause();
      VoicesManager.resetAuditionButton(AppState.activeAuditionButton);
      AppState.activeAuditionAudio = null;
    }
  },

  async testApiKey() {
    const input = document.getElementById('input-client-api-key');
    const statusDiv = document.getElementById('api-key-test-result');
    const key = (input ? input.value : '').trim();

    if (!key && !AppState.serverStatus.hasServerApiKey) {
      if (statusDiv) {
        statusDiv.style.display = 'block';
        statusDiv.innerHTML = '<span style="color: var(--status-danger);">Please enter an API key to test.</span>';
      }
      return;
    }

    if (statusDiv) {
      statusDiv.style.display = 'block';
      statusDiv.innerHTML = '<span style="color: var(--text-secondary);">Testing key with ElevenLabs subscription API...</span>';
    }

    try {
      const res = await fetch('/api/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key })
      });

      const data = await res.json();
      if (res.ok && data.valid) {
        statusDiv.innerHTML = `
          <div style="color: var(--status-success); font-weight: 500;">
            ✓ API Key is valid! Subscription Tier: <strong>${data.tier || 'Standard'}</strong><br>
            <span style="font-size: 0.8rem; color: var(--text-secondary);">
              Characters remaining: <strong>${(data.remainingCharacters || 0).toLocaleString()}</strong> / ${(data.characterLimit || 0).toLocaleString()}
            </span>
          </div>
        `;
      } else {
        statusDiv.innerHTML = `
          <div style="color: var(--status-danger);">
            ✕ Validation failed: ${data.error || 'Invalid API key'}
          </div>
        `;
      }
    } catch (err) {
      if (statusDiv) {
        statusDiv.innerHTML = `<span style="color: var(--status-danger);">Network error: ${err.message}</span>`;
      }
    }
  },

  saveApiKey() {
    const input = document.getElementById('input-client-api-key');
    const key = (input ? input.value : '').trim();
    AppState.clientApiKey = key;
    if (key) {
      localStorage.setItem('voxa_client_api_key', key);
      Toast.show('API key saved locally.', 'success');
    } else {
      localStorage.removeItem('voxa_client_api_key');
      Toast.show('Client API key cleared. Using server default.', 'info');
    }
    updateApiStatusDisplay();
    VoicesManager.loadVoices();
    this.closeAll();
  }
};

// --- STUDIO MAIN CONTROLLER ---
const StudioController = {
  init() {
    const textarea = document.getElementById('script-editor-textarea');
    const charCountEl = document.getElementById('char-counter');
    const durationEl = document.getElementById('est-duration');
    const btnClear = document.getElementById('btn-clear-text');
    let lastClearedText = '';

    // Live Metrics Calculation
    const updateMetrics = () => {
      const text = textarea.value || '';
      const len = text.length;
      if (charCountEl) {
        charCountEl.textContent = `${len.toLocaleString()} / 5,000`;
        const metricItem = charCountEl.closest('.metric-item');
        if (metricItem) {
          if (len > 5000) {
            metricItem.classList.add('warning');
          } else {
            metricItem.classList.remove('warning');
          }
        }
      }

      // Word count & Duration estimate (approx 2.5 words / sec or 150 wpm)
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      const estSec = Math.round(words / 2.5);
      if (durationEl) {
        durationEl.textContent = `~${estSec}s audio`;
      }
    };

    if (textarea) {
      textarea.addEventListener('input', updateMetrics);
      // Keyboard shortcut Ctrl+Enter / Cmd+Enter to generate
      textarea.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          this.generate();
        }
      });
      // Initial calculation
      updateMetrics();
    }

    // Clear Button with Undo Toast
    if (btnClear && textarea) {
      btnClear.addEventListener('click', () => {
        if (!textarea.value.trim()) return;
        lastClearedText = textarea.value;
        textarea.value = '';
        updateMetrics();
        Toast.show('Script cleared. Press Ctrl+Z or paste to restore.', 'info');
      });
    }

    // Script Presets
    document.querySelectorAll('.preset-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const key = chip.dataset.preset;
        if (PRESETS[key] && textarea) {
          textarea.value = PRESETS[key];
          updateMetrics();
          textarea.focus();
          Toast.show(`Loaded preset: ${chip.textContent.trim()}`, 'info');
        }
      });
    });

    // Sliders & Fine-Tuning
    const setupSlider = (id, valId, stateKey, suffix = '%', multiplier = 100) => {
      const slider = document.getElementById(id);
      const valDisplay = document.getElementById(valId);
      if (slider) {
        slider.addEventListener('input', (e) => {
          const raw = parseFloat(e.target.value);
          AppState[stateKey] = raw;
          if (valDisplay) valDisplay.textContent = `${Math.round(raw * multiplier)}${suffix}`;
        });
      }
    };

    setupSlider('slider-stability', 'val-stability', 'stability');
    setupSlider('slider-similarity', 'val-similarity', 'similarity');
    setupSlider('slider-style', 'val-style', 'style');

    const toggleBoost = document.getElementById('toggle-speaker-boost');
    if (toggleBoost) {
      toggleBoost.addEventListener('change', (e) => {
        AppState.speakerBoost = e.target.checked;
      });
    }

    const selectModel = document.getElementById('select-tts-model');
    if (selectModel) {
      selectModel.addEventListener('change', (e) => {
        AppState.selectedModel = e.target.value;
      });
    }

    // Reset settings button
    const btnReset = document.getElementById('btn-reset-settings');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        AppState.stability = 0.50;
        AppState.similarity = 0.75;
        AppState.style = 0.0;
        AppState.speakerBoost = true;

        const sStab = document.getElementById('slider-stability');
        const sSim = document.getElementById('slider-similarity');
        const sStyle = document.getElementById('slider-style');
        const tBoost = document.getElementById('toggle-speaker-boost');

        if (sStab) sStab.value = 0.50;
        if (sSim) sSim.value = 0.75;
        if (sStyle) sStyle.value = 0.0;
        if (tBoost) tBoost.checked = true;

        document.getElementById('val-stability').textContent = '50%';
        document.getElementById('val-similarity').textContent = '75%';
        document.getElementById('val-style').textContent = '0%';

        Toast.show('Voice settings reset to defaults.', 'info');
      });
    }

    // Generate Button
    const btnGen = document.getElementById('btn-generate-speech');
    if (btnGen) {
      btnGen.addEventListener('click', () => this.generate());
    }

    // Dismiss error banner button
    const btnCloseError = document.getElementById('btn-close-error-banner');
    if (btnCloseError) {
      btnCloseError.addEventListener('click', () => {
        const banner = document.getElementById('studio-error-banner');
        if (banner) banner.style.display = 'none';
      });
    }
  },

  async generate() {
    if (AppState.isGenerating) return;

    const textarea = document.getElementById('script-editor-textarea');
    const text = (textarea ? textarea.value : '').trim();
    const btn = document.getElementById('btn-generate-speech');
    const btnText = document.getElementById('btn-generate-text');
    const errorBanner = document.getElementById('studio-error-banner');
    const errorMsg = document.getElementById('studio-error-message');

    if (errorBanner) errorBanner.style.display = 'none';

    // Validation
    if (!text) {
      Toast.show('Please enter or paste your script first.', 'error');
      if (textarea) textarea.focus();
      return;
    }

    if (text.length > 5000) {
      Toast.show('Script exceeds 5,000 characters limit. Please shorten it.', 'error');
      return;
    }

    if (!AppState.selectedVoice) {
      Toast.show('Please select a voice first.', 'error');
      return;
    }

    // Check API Key
    const hasKey = AppState.serverStatus.hasServerApiKey || Boolean(AppState.clientApiKey);
    if (!hasKey) {
      if (errorBanner && errorMsg) {
        errorBanner.style.display = 'flex';
        errorMsg.innerHTML = `
          <strong>ElevenLabs API Key Required</strong>
          To synthesize speech with real AI voices, configure your ElevenLabs API key in 
          <code>.env.local</code> or click 
          <a href="#" id="link-open-settings" style="text-decoration: underline; font-weight: 600;">Studio Settings</a> 
          to add it securely in your browser.
        `;
        document.getElementById('link-open-settings')?.addEventListener('click', (e) => {
          e.preventDefault();
          ModalManager.open('settings-modal');
        });
      }
      Toast.show('ElevenLabs API key is missing. Open Settings to configure.', 'error', 4500);
      return;
    }

    // Set generating state
    AppState.isGenerating = true;
    if (btn) {
      btn.disabled = true;
      btn.classList.add('generating');
    }
    if (btnText) {
      btnText.innerHTML = `
        <span class="pulsing-bar" style="display:inline-block; width:3px; height:12px; background:white; margin-right:3px;"></span>
        <span class="pulsing-bar" style="display:inline-block; width:3px; height:18px; background:white; margin-right:3px; animation-delay:0.2s;"></span>
        <span class="pulsing-bar" style="display:inline-block; width:3px; height:10px; background:white; margin-right:8px; animation-delay:0.4s;"></span>
        Synthesizing Voice...
      `;
    }

    const voice = AppState.selectedVoice;
    const payload = {
      text,
      voiceId: voice.voice_id,
      modelId: AppState.selectedModel,
      voiceSettings: {
        stability: AppState.stability,
        similarity_boost: AppState.similarity,
        style: AppState.style,
        use_speaker_boost: AppState.speakerBoost
      }
    };

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (AppState.clientApiKey) {
        headers['x-api-key'] = AppState.clientApiKey;
      }

      const res = await fetch('/api/tts', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        let errJson = {};
        try { errJson = await res.json(); } catch (_) {}
        const message = errJson.message || `ElevenLabs synthesis failed with HTTP ${res.status}`;
        const isLibErr = errJson.isLibraryVoiceError || 
          message.toLowerCase().includes('library voice') || 
          message.toLowerCase().includes('library_voice') || 
          message.toLowerCase().includes('free users cannot use');

        if (isLibErr) {
          if (errorBanner && errorMsg) {
            errorBanner.style.display = 'flex';
            errorMsg.innerHTML = `
              <div style="line-height: 1.5;">
                <strong style="color: #991B1B; font-size: 0.95rem;">⚠️ ElevenLabs Free Tier Voice Restriction</strong>
                <p style="color: #7F1D1D; font-size: 0.85rem; margin: 0.3rem 0 0.75rem;">
                  Free ElevenLabs accounts cannot use Community Library voices via the API. Free accounts have full access to official Default Premade voices like <strong>Rachel</strong>, <strong>Adam</strong>, <strong>Antoni</strong>, and <strong>Josh</strong>.
                </p>
                <button class="btn btn-sm btn-primary" id="btn-fix-switch-rachel" style="background: #171717; color: white; font-weight: 600; padding: 0.45rem 1rem; cursor: pointer;">
                  👉 Switch to Rachel (Free Tier) & Generate Speech
                </button>
              </div>
            `;
            document.getElementById('btn-fix-switch-rachel')?.addEventListener('click', (e) => {
              e.preventDefault();
              VoicesManager.selectVoice('21m00Tcm4TlvDq8ikWAM');
              Toast.show('Switched to Rachel (Free Tier). Synthesizing speech...', 'info');
              setTimeout(() => StudioController.generate(), 200);
            });
          }
          Toast.show('Free tier accounts cannot use Library voices. Switch to Rachel or Adam!', 'error', 6000);
          return;
        }

        throw new Error(message);
      }

      const blob = await res.blob();
      
      // Load into audio player
      StudioPlayer.loadAudio(blob, {
        voiceName: voice.name,
        modelName: AppState.selectedModel,
        charCount: text.length
      });

      // Save to IndexedDB history
      const historyItem = {
        id: `gen_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        text: text,
        voiceId: voice.voice_id,
        voiceName: voice.name,
        modelId: AppState.selectedModel,
        createdAt: Date.now(),
        audioBlob: blob
      };

      await Storage.saveGeneration(historyItem);
      HistoryManager.render();
      Toast.show('Speech synthesized successfully!', 'success');

    } catch (err) {
      console.error('[GENERATION_ERROR]', err);
      if (errorBanner && errorMsg) {
        errorBanner.style.display = 'flex';
        errorMsg.innerHTML = `
          <strong>Synthesis Failed</strong>
          ${err.message}
        `;
      }
      Toast.show(`Generation error: ${err.message}`, 'error', 5000);
    } finally {
      AppState.isGenerating = false;
      if (btn) {
        btn.disabled = false;
        btn.classList.remove('generating');
      }
      if (btnText) {
        btnText.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2v20M17 5v14M7 9v6M2 11v2M22 11v2"/>
          </svg>
          Generate Speech
        `;
      }
    }
  }
};

// --- HISTORY MANAGER ---
const HistoryManager = {
  activeCardAudio: null,
  activeCardBtn: null,

  async init() {
    const btnClearAll = document.getElementById('btn-clear-history');
    if (btnClearAll) {
      btnClearAll.addEventListener('click', async () => {
        if (confirm('Clear all local generation history? This cannot be undone.')) {
          await Storage.clearAll();
          this.render();
          Toast.show('History cleared.', 'info');
        }
      });
    }
    await this.render();
  },

  async render() {
    const container = document.getElementById('history-cards-container');
    const emptyState = document.getElementById('empty-history-placeholder');
    if (!container) return;

    const items = await Storage.getGenerations();

    if (!items || items.length === 0) {
      container.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    container.innerHTML = items.map(item => {
      const dateStr = this.formatDate(item.createdAt);
      return `
        <div class="history-card" data-id="${item.id}">
          <div class="history-card-header">
            <div class="history-voice-pill">
              <span class="voice-avatar-badge" style="width: 24px; height: 24px; font-size: 0.7rem;">
                ${(item.voiceName || 'V').charAt(0).toUpperCase()}
              </span>
              <span>${item.voiceName || 'ElevenLabs Voice'}</span>
            </div>
            <span class="history-timestamp">${dateStr}</span>
          </div>
          <p class="history-text-snippet">"${this.escapeHtml(item.text)}"</p>
          <div class="history-card-footer">
            <div class="history-mini-player">
              ${item.audioBlob ? `
                <button class="btn btn-secondary btn-sm btn-play-history-card" data-id="${item.id}" title="Play Audio">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>
                </button>
                <button class="btn btn-ghost btn-sm btn-download-history-card" data-id="${item.id}" title="Download MP3">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </button>
              ` : `
                <span style="font-size: 0.74rem; color: var(--text-muted);">Audio offline</span>
              `}
              <button class="btn btn-ghost btn-sm btn-load-to-editor" data-text="${encodeURIComponent(item.text)}" title="Copy script into text editor">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
            </div>
            <button class="btn btn-ghost btn-sm btn-delete-history-card" data-id="${item.id}" title="Delete" style="color: var(--text-muted); padding: 0.2rem;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Listeners for cards
    container.querySelectorAll('.btn-play-history-card').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const item = items.find(x => x.id === id);
        if (item && item.audioBlob) {
          this.togglePlayCard(item.audioBlob, btn);
        }
      });
    });

    container.querySelectorAll('.btn-download-history-card').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const item = items.find(x => x.id === id);
        if (item && item.audioBlob) {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(item.audioBlob);
          a.download = `voxa-${(item.voiceName || 'voice').toLowerCase().replace(/\s+/g, '-')}-${item.createdAt}.mp3`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      });
    });

    container.querySelectorAll('.btn-load-to-editor').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = decodeURIComponent(btn.dataset.text || '');
        const editor = document.getElementById('script-editor-textarea');
        if (editor) {
          editor.value = text;
          editor.dispatchEvent(new Event('input'));
          editor.focus();
          editor.scrollIntoView({ behavior: 'smooth' });
          Toast.show('Loaded script from history.', 'info');
        }
      });
    });

    container.querySelectorAll('.btn-delete-history-card').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        await Storage.deleteGeneration(id);
        this.render();
        Toast.show('Item removed from history.', 'info');
      });
    });
  },

  togglePlayCard(blob, btn) {
    if (this.activeCardAudio && !this.activeCardAudio.paused) {
      this.activeCardAudio.pause();
      if (this.activeCardBtn) {
        this.activeCardBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
      }
      if (this.activeCardBtn === btn) {
        this.activeCardAudio = null;
        this.activeCardBtn = null;
        return;
      }
    }

    const audio = new Audio(URL.createObjectURL(blob));
    this.activeCardAudio = audio;
    this.activeCardBtn = btn;
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';

    audio.play().catch(e => console.warn('Card audio play failed:', e.message));
    audio.onended = () => {
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
      this.activeCardAudio = null;
      this.activeCardBtn = null;
    };
  },

  formatDate(ts) {
    if (!ts) return '';
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  },

  escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m]));
  }
};

// --- STATUS CHECKER ---
async function updateApiStatusDisplay() {
  const badge = document.getElementById('api-status-badge');
  const dot = document.getElementById('api-status-dot');
  const text = document.getElementById('api-status-text');

  try {
    const res = await fetch('/api/status');
    if (res.ok) {
      AppState.serverStatus = await res.json();
    }
  } catch (err) {
    AppState.serverStatus = { ok: false, hasServerApiKey: false };
  }

  const hasKey = AppState.serverStatus.hasServerApiKey || Boolean(AppState.clientApiKey);

  if (dot && text) {
    if (hasKey) {
      dot.className = 'status-dot active';
      text.textContent = AppState.serverStatus.hasServerApiKey ? 'API Connected' : 'Client Key Active';
      if (badge) badge.title = 'ElevenLabs API is ready for generation. Click to manage.';
    } else {
      dot.className = 'status-dot warning';
      text.textContent = 'API Key Required';
      if (badge) badge.title = 'Click to configure your ElevenLabs API Key';
    }
  }
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
  await updateApiStatusDisplay();
  await Storage.init();
  StudioPlayer.init();
  HeroPlayer.init();
  await VoicesManager.loadVoices();
  StudioController.init();
  ModalManager.init();
  await HistoryManager.init();

  // Primary Hero CTA "Start Creating" scroll
  const heroCta = document.getElementById('hero-start-creating-btn');
  if (heroCta) {
    heroCta.addEventListener('click', (e) => {
      e.preventDefault();
      const studio = document.getElementById('studio-section');
      if (studio) {
        studio.scrollIntoView({ behavior: 'smooth' });
        setTimeout(() => {
          document.getElementById('script-editor-textarea')?.focus();
        }, 500);
      }
    });
  }

  // Nav "Open Studio" CTA
  const navStudioBtn = document.getElementById('nav-open-studio-btn');
  if (navStudioBtn) {
    navStudioBtn.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('studio-section')?.scrollIntoView({ behavior: 'smooth' });
    });
  }
});
