// Sintetizador de áudio retrô via Web Audio API (sem dependências externas).
(function () {
    'use strict';

    let actx = null;
    let master = null;
    let muted = false;

    function ensureAudio() {
        if (muted) return null;
        if (!actx) {
            try {
                const Ctor = window.AudioContext || window.webkitAudioContext;
                if (!Ctor) return null;
                actx = new Ctor();
                master = actx.createGain();
                master.gain.value = 0.42;
                master.connect(actx.destination);
            } catch (e) {
                actx = null;
                return null;
            }
        }
        if (actx.state === 'suspended') {
            actx.resume().catch(() => {});
        }
        return actx;
    }

    function tone(freq, dur, type, vol, slideTo, delay) {
        const a = ensureAudio();
        if (!a) return;
        const t0 = a.currentTime + (delay || 0);
        const osc = a.createOscillator();
        const gain = a.createGain();
        osc.type = type || 'square';
        osc.frequency.setValueAtTime(Math.max(20, freq), t0);
        if (slideTo) {
            osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
        }
        gain.gain.setValueAtTime(Math.max(0.0001, vol), t0);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(gain);
        gain.connect(master);
        osc.start(t0);
        osc.stop(t0 + dur + 0.02);
    }

    function noise(dur, vol, filterType, freq, delay, slideTo) {
        const a = ensureAudio();
        if (!a) return;
        const t0 = a.currentTime + (delay || 0);
        const frames = Math.max(1, Math.floor(a.sampleRate * dur));
        const buffer = a.createBuffer(1, frames, a.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < frames; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const src = a.createBufferSource();
        src.buffer = buffer;
        const filter = a.createBiquadFilter();
        filter.type = filterType || 'lowpass';
        filter.frequency.setValueAtTime(freq || 1200, t0);
        if (slideTo) {
            filter.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + dur);
        }
        const gain = a.createGain();
        gain.gain.setValueAtTime(Math.max(0.0001, vol), t0);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        src.start(t0);
    }

    function play(name, arg) {
        if (muted) return;
        switch (name) {
            case 'step':
                noise(0.055, 0.2, 'lowpass', 420);
                tone(95, 0.05, 'triangle', 0.08, 60);
                break;
            case 'turn':
                noise(0.05, 0.12, 'bandpass', 750, 0, 1200);
                break;
            case 'card':
                tone(680, 0.045, 'square', 0.09, 880);
                break;
            case 'stapler':
                // Grampeador pesado + mordida metálica
                tone(240, 0.06, 'square', 0.25, 80);
                tone(920, 0.05, 'triangle', 0.2, 420, 0.02);
                noise(0.09, 0.35, 'bandpass', 1800, 0.01, 450);
                break;
            case 'coffee':
                // Café pelando fervendo / explosão ígnea
                noise(0.24, 0.32, 'bandpass', 1400, 0, 3200);
                tone(180, 0.18, 'sawtooth', 0.16, 75, 0.03);
                break;
            case 'whip':
                // Chicote de cabo de rede Cat6 elétrico
                noise(0.14, 0.35, 'highpass', 2200, 0, 700);
                tone(980, 0.12, 'sawtooth', 0.18, 220);
                tone(1420, 0.08, 'square', 0.1, 480, 0.04);
                break;
            case 'shield':
                // Carimbo burocrático + barreira arcana
                tone(330, 0.11, 'triangle', 0.2, 440);
                tone(660, 0.14, 'triangle', 0.18, 880, 0.05);
                break;
            case 'combo': {
                const mult = Math.max(1, arg || 1);
                const base = 392 * Math.pow(1.12246, Math.min(mult - 1, 10));
                tone(base, 0.09, 'square', 0.12, base * 1.15);
                break;
            }
            case 'hit':
                tone(185, 0.09, 'square', 0.22, 65);
                noise(0.06, 0.22, 'lowpass', 1400);
                break;
            case 'hurt':
                tone(210, 0.22, 'sawtooth', 0.28, 55);
                noise(0.12, 0.22, 'lowpass', 700);
                break;
            case 'block':
                // Clangor metálico de escudo
                tone(1100, 0.08, 'triangle', 0.22, 680);
                tone(1760, 0.22, 'square', 0.09, 1680, 0.01);
                tone(2640, 0.18, 'sine', 0.08, 2560, 0.01);
                noise(0.05, 0.18, 'highpass', 2800);
                break;
            case 'stun':
                tone(520, 0.08, 'square', 0.15, 260);
                tone(380, 0.12, 'square', 0.15, 190, 0.07);
                break;
            case 'immune':
                tone(140, 0.15, 'sawtooth', 0.22, 95);
                tone(110, 0.18, 'triangle', 0.2, 80, 0.08);
                break;
            case 'overkill':
                [523, 659, 784, 1047].forEach((f, i) => {
                    tone(f, 0.14, 'sawtooth', 0.16, f * 1.04, i * 0.05);
                });
                noise(0.18, 0.26, 'bandpass', 2000, 0, 600);
                break;
            case 'death':
                tone(260, 0.28, 'sawtooth', 0.2, 55);
                noise(0.24, 0.2, 'lowpass', 900, 0, 140);
                break;
            case 'xpTick':
                tone(980 + Math.random() * 280, 0.055, 'sine', 0.1, 1480);
                break;
            case 'chest':
                [587, 740, 880, 1175].forEach((f, i) => {
                    tone(f, 0.13, 'triangle', 0.16, 0, i * 0.07);
                });
                break;
            case 'levelup':
                [440, 554, 659, 880, 1108].forEach((f, i) => {
                    tone(f, 0.2, 'square', 0.14, 0, i * 0.09);
                });
                break;
            case 'victory':
                [523, 659, 784, 1047, 1318].forEach((f, i) => {
                    tone(f, 0.24, 'square', 0.16, 0, i * 0.12);
                });
                break;
            case 'defeat':
                [330, 294, 247, 196, 147].forEach((f, i) => {
                    tone(f, 0.28, 'sawtooth', 0.16, 0, i * 0.16);
                });
                break;
            case 'alert':
                // Alerta "!" de inimigo avistando o jogador
                tone(880, 0.07, 'square', 0.2, 1320);
                tone(1320, 0.16, 'square', 0.22, 1760, 0.08);
                break;
            case 'windup':
                // Antecipação do golpe inimigo
                tone(140, 0.15, 'sawtooth', 0.16, 320);
                break;
            case 'lunge':
                noise(0.16, 0.3, 'bandpass', 500, 0, 2400);
                tone(220, 0.14, 'square', 0.14, 70);
                break;
            case 'projectile':
                noise(0.2, 0.26, 'highpass', 1200, 0, 4200);
                tone(620, 0.18, 'triangle', 0.14, 1500);
                break;
            case 'buff':
                [392, 523, 659].forEach((f, i) => {
                    tone(f, 0.12, 'triangle', 0.15, f * 1.5, i * 0.06);
                });
                break;
            case 'encounter':
                tone(147, 0.16, 'sawtooth', 0.22, 220);
                tone(220, 0.22, 'square', 0.18, 110, 0.1);
                break;
        }
    }

    function toggleMute() {
        muted = !muted;
        if (master) {
            master.gain.value = muted ? 0 : 0.42;
        }
        return muted;
    }

    function isMuted() {
        return muted;
    }

    window.GameAudio = {
        play: play,
        toggleMute: toggleMute,
        isMuted: isMuted,
        unlock: ensureAudio
    };
})();
