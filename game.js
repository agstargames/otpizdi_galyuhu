/* ==============================================
   СИМУЛЯТОР: ОТПИЗДИ ГАЛЮХУ
   Autistic Games | ВайкокинStar Games
   ============================================== */

(function () {
    'use strict';

    // ======= DOM =======
    const menuScreen    = document.getElementById('menu-screen');
    const gameScreen    = document.getElementById('game-screen');
    const overScreen    = document.getElementById('gameover-screen');
    const canvas        = document.getElementById('gameCanvas');
    const ctx           = canvas.getContext('2d');
    const elScore       = document.getElementById('score');
    const elLives       = document.getElementById('lives');
    const elWave        = document.getElementById('wave');
    const elFinalScore  = document.getElementById('final-score');
    const elFinalWave   = document.getElementById('final-wave');
    const elGameoverNick= document.getElementById('gameover-nick');
    const elNewRecord   = document.getElementById('new-record');
    const btnPlay       = document.getElementById('btn-play');
    const btnRestart    = document.getElementById('btn-restart');
    const btnMenu       = document.getElementById('btn-menu');
    const nickModal     = document.getElementById('nick-modal');
    const nickInput     = document.getElementById('nick-input');
    const nickWelcome   = document.getElementById('nick-welcome');
    const devCheck      = document.getElementById('dev-check');
    const btnNickGo     = document.getElementById('btn-nick-go');
    const impostorModal = document.getElementById('impostor-modal');

    // ============================================================
    //  ★ SUPABASE — инициализация
    // ============================================================
    const SUPABASE_URL = 'https://cdqffguutlbrocghbovs.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkcWZmZ3V1dGxicm9jZ2hib3ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0OTE2NDIsImV4cCI6MjA4NzA2NzY0Mn0.EQjgGIyeYEM94TKC_CiEmYCeynzqzNhvZLhjxcbAYn4';
    let sb = null;

    function initSupabase() {
        try {
            if (window.supabase && window.supabase.createClient) {
                sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
                console.log('✅ Supabase подключён');
                syncFromDB();
            }
        } catch (e) { console.warn('Supabase init error:', e); }
    }

    async function syncFromDB() {
        if (!sb) return;
        try {
            const { data, error } = await sb.from('records').select('*').order('score', { ascending: false });
            if (error) throw error;
            if (!data || data.length === 0) return;

            const localRecords = getRecords();
            const merged = new Map();

            for (const r of localRecords) {
                merged.set(r.nick.toLowerCase(), { nick: r.nick, score: r.score, wave: r.wave, date: r.date, isDev: r.isDev || false, isMain: r.isMain || false });
            }

            for (const r of data) {
                const key = r.nick.toLowerCase();
                const local = merged.get(key);
                if (!local || r.score > local.score) {
                    merged.set(key, { nick: r.nick, score: r.score, wave: r.wave, date: r.created_at, isDev: r.is_dev || false, isMain: r.is_main || false });
                }
            }

            const records = Array.from(merged.values());
            records.sort((a, b) => b.score - a.score);
            localStorage.setItem('galuha_records', JSON.stringify(records));

            for (const r of localRecords) {
                const dbRec = data.find(d => d.nick.toLowerCase() === r.nick.toLowerCase());
                if (!dbRec) {
                    await sb.from('records').insert({ nick: r.nick, score: r.score, wave: r.wave || 1, created_at: r.date || Date.now(), is_dev: r.isDev || false, is_main: r.isMain || false }).catch(() => {});
                } else if (r.score > dbRec.score) {
                    await sb.from('records').update({ score: r.score, wave: r.wave || 1, created_at: r.date || Date.now(), is_dev: r.isDev || false, is_main: r.isMain || false }).eq('id', dbRec.id).catch(() => {});
                }
            }
        } catch (e) { console.warn('Supabase sync error:', e); }
    }

    async function pushRecordToDB(nick, sc, waveNum) {
        if (!sb) return;
        try {
            const isDev = isDevNick(nick), isMain = isMainDev(nick);
            const { data: existing, error: fetchErr } = await sb.from('records').select('*').ilike('nick', nick).maybeSingle();
            if (fetchErr) throw fetchErr;

            if (existing) {
                if (sc > existing.score) {
                    await sb.from('records').update({ score: sc, wave: waveNum, created_at: Date.now(), is_dev: isDev, is_main: isMain }).eq('id', existing.id);
                }
            } else {
                await sb.from('records').insert({ nick, score: sc, wave: waveNum, created_at: Date.now(), is_dev: isDev, is_main: isMain });
            }
        } catch (e) { console.warn('Supabase pushRecord error:', e); }
    }

    async function fetchLeaderboard() {
        if (!sb) return null;
        try {
            const { data, error } = await sb.from('records').select('*').order('score', { ascending: false });
            if (error) throw error;
            return (data || []).map(r => ({ nick: r.nick, score: r.score, wave: r.wave, date: r.created_at, isDev: r.is_dev, isMain: r.is_main }));
        } catch (e) { return null; }
    }

    // ============================================================
    //  ★ ПРЕЛОАДЕР КАРТИНОК
    // ============================================================
    let imagesLoaded = false;
    btnPlay.innerHTML = '⏳ ЗАГРУЗКА...';
    btnPlay.style.pointerEvents = 'none';
    btnPlay.style.opacity = '0.5';

    function loadImg(src) {
        return new Promise(resolve => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(img); // В инкогнито может упасть сюда
            img.src = src;
        });
    }

    const ENEMY_IMGS = [];
    const BOSS_IMG = new Image();

    Promise.all([
        loadImg('shit1.png'), loadImg('shit2.png'), loadImg('shit3.png'), loadImg('shit4.png'), loadImg('shit_final.png')
    ]).then(imgs => {
        ENEMY_IMGS.push(imgs[0], imgs[1], imgs[2], imgs[3]);
        BOSS_IMG.src = imgs[4].src; BOSS_IMG.onload = () => {};
        Object.assign(BOSS_IMG, { width: imgs[4].width, height: imgs[4].height });
        imagesLoaded = true;
        btnPlay.innerHTML = '🚀 ИГРАТЬ';
        btnPlay.style.pointerEvents = 'auto';
        btnPlay.style.opacity = '1';
    });

    function drawImgSafe(img, x, y, w, h) {
        if (img && img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, x, y, w, h);
        } else {
            ctx.fillStyle = '#ff6600'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
            ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Orbitron'; ctx.textAlign = 'center';
            ctx.fillText('👵', x + w / 2, y + h / 2 + 4);
        }
    }

    // ============================================================
    //  СИСТЕМА НИКОВ
    // ============================================================
    const DEV_NICKS = ['miralys', 'vikxii', 'dr.hentai'];
    const MIRALYS_PASSWORD = 'шайлили';
    let currentNick = '';
    const devSessionAuth = new Set();

    function isDevNick(nick) { return DEV_NICKS.includes(nick.toLowerCase().trim()); }
    function isMainDev(nick) { return nick.toLowerCase().trim() === 'miralys'; }
    function getDevPassKey(nick) { return 'galuha_dev_pass_' + nick.toLowerCase().trim(); }
    function hasDevPassword(nick) { return localStorage.getItem(getDevPassKey(nick)) !== null; }
    function saveDevPassword(nick, pass) { localStorage.setItem(getDevPassKey(nick), pass); }
    function checkDevPassword(nick, pass) {
        const n = nick.toLowerCase().trim();
        if (n === 'miralys') return pass === MIRALYS_PASSWORD;
        return localStorage.getItem(getDevPassKey(nick)) === pass;
    }
    function isDevSessionOk(nick) { return devSessionAuth.has(nick.toLowerCase().trim()); }
    function markDevSession(nick) { devSessionAuth.add(nick.toLowerCase().trim()); }
    function saveLastNick(nick) { localStorage.setItem('galuha_last_nick', nick); }
    function getLastNick() { return localStorage.getItem('galuha_last_nick') || ''; }
    function getRecords() { try { const d = localStorage.getItem('galuha_records'); return d ? JSON.parse(d) : []; } catch (e) { return []; } }

    function saveRecord(nick, sc, waveNum) {
        const records = getRecords();
        const existing = records.find(r => r.nick.toLowerCase() === nick.toLowerCase());
        const isDev = isDevNick(nick), isMain = isMainDev(nick);
        let isNew = false;
        if (existing) {
            if (sc > existing.score) {
                existing.score = sc; existing.wave = waveNum; existing.date = Date.now(); existing.isDev = isDev; existing.isMain = isMain; isNew = true;
            }
        } else {
            records.push({ nick, score: sc, wave: waveNum, date: Date.now(), isDev, isMain }); isNew = true;
        }
        records.sort((a, b) => b.score - a.score);
        localStorage.setItem('galuha_records', JSON.stringify(records));
        pushRecordToDB(nick, sc, waveNum);
        return isNew;
    }

    function getPlayerRecord(nick) { return getRecords().find(r => r.nick.toLowerCase() === nick.toLowerCase()) || null; }

    function renderRecordsList(records, list) {
        if (records.length === 0) { list.innerHTML = '<p class="no-records">Пока никто не играл. Будь первым!</p>'; return; }
        const medals = ['👑', '🥈', '🥉']; let html = '';
        records.forEach((r, i) => {
            const medal = i < 3 ? medals[i] : (i + 1); let badge = '';
            if (r.isMain || r.nick.toLowerCase() === 'miralys') badge = '<span class="dev-badge main-dev">MAIN DEV</span>';
            else if (r.isDev) badge = '<span class="dev-badge">DEV</span>';
            html += `<div class="record-row ${i === 0 ? 'gold' : ''}"><span class="record-rank">${medal}</span><span class="record-nick">${r.nick}${badge}</span><span class="record-score">${r.score}</span><span class="record-wave">W${r.wave}</span></div>`;
        });
        list.innerHTML = html;
    }

    window.renderRecords = function () {
        const list = document.getElementById('records-list');
        renderRecordsList(getRecords(), list);
        fetchLeaderboard().then(dbRecords => { if (dbRecords && dbRecords.length > 0) { renderRecordsList(dbRecords, list); localStorage.setItem('galuha_records', JSON.stringify(dbRecords)); } });
    };

    function getPassInput() { return document.getElementById('dev-password'); }

    function showNickModal() {
        nickModal.classList.remove('hidden'); nickWelcome.classList.add('hidden'); devCheck.classList.add('hidden'); devCheck.innerHTML = '';
        const lastNick = getLastNick(); nickInput.value = lastNick;
        if (lastNick) {
            if (isDevNick(lastNick) && isDevSessionOk(lastNick)) { currentNick = lastNick; hideNickModal(); startGameDirect(); return; }
            handleNickInput(lastNick);
        }
        nickInput.focus();
    }
    function hideNickModal() { nickModal.classList.add('hidden'); }

    function handleNickInput(nick) {
        nickWelcome.classList.add('hidden'); devCheck.classList.add('hidden'); devCheck.innerHTML = '';
        if (!nick) return;
        if (isDevNick(nick)) {
            if (isDevSessionOk(nick)) {
                const rec = getPlayerRecord(nick); nickWelcome.classList.remove('hidden'); const role = isMainDev(nick) ? '(MAIN DEV)' : '(DEV)';
                nickWelcome.innerHTML = rec ? `<p>С возвращением, <strong>${rec.nick}</strong>! ${role} 👋</p><p class="welcome-record">Твой рекорд: ${rec.score} очков (волна ${rec.wave})</p>` : `<p>С возвращением, <strong>${nick}</strong>! ${role} 👋</p>`;
                return;
            }
            devCheck.classList.remove('hidden'); const n = nick.toLowerCase().trim();
            if (n === 'miralys' || hasDevPassword(nick)) { devCheck.innerHTML = `<p class="dev-check-text">Это никнейм разработчика. Пруфани, что это ты.</p><input type="password" id="dev-password" class="nick-input dev-password-input" placeholder="Пароль..." maxlength="32" autocomplete="off">`; } 
            else { devCheck.innerHTML = `<p class="dev-check-text setup-text">О, мы тебя знаем. Ты тоже разраб этой игры. Придумай пароль, пока никакая сука не спиздила аккаунт.</p><input type="password" id="dev-password" class="nick-input dev-password-input" placeholder="Придумай пароль..." maxlength="32" autocomplete="off">`; }
            setTimeout(() => { const pi = getPassInput(); if (pi) pi.addEventListener('keydown', e => { if (e.key === 'Enter') btnNickGo.click(); }); }, 50);
        } else {
            const rec = getPlayerRecord(nick);
            if (rec) { nickWelcome.classList.remove('hidden'); nickWelcome.innerHTML = `<p>О, это ты, <strong>${rec.nick}</strong>! 👋</p><p class="welcome-record">Твой рекорд: ${rec.score} очков (волна ${rec.wave})</p>`; }
        }
    }

    nickInput.addEventListener('input', function () { handleNickInput(nickInput.value.trim()); });

    btnNickGo.addEventListener('click', function () {
        const nick = nickInput.value.trim();
        if (!nick) { nickInput.style.borderColor = '#f44'; setTimeout(() => { nickInput.style.borderColor = '#555'; }, 1000); return; }
        if (isDevNick(nick) && !isDevSessionOk(nick)) {
            const passInput = getPassInput(); const pass = passInput ? passInput.value : '';
            if (!pass) { if (passInput) { passInput.style.borderColor = '#f44'; setTimeout(() => { passInput.style.borderColor = '#ffcc00'; }, 1000); } return; }
            if (isMainDev(nick) || hasDevPassword(nick)) { if (!checkDevPassword(nick, pass)) { hideNickModal(); impostorModal.classList.remove('hidden'); return; } } 
            else { saveDevPassword(nick, pass); }
            markDevSession(nick);
        }
        currentNick = nick; saveLastNick(nick); hideNickModal();
        
        unlockAudio();
        startGameDirect();
    });

    nickInput.addEventListener('keydown', e => { if (e.key === 'Enter') { const pi = getPassInput(); if (pi && !pi.value) pi.focus(); else btnNickGo.click(); } });

    // ============================================================
    //  ★ ЗВУКОВОЙ ДВИЖОК С АНТИ-ЛАГ ПРОГРЕВОМ
    // ============================================================
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    let audioCtx = null, audioUnlocked = false;
    const soundBuffers = {};
    const SOUND_FILES = { kill: 'snd_kill.mp3', playerHit: 'snd_player_hit.mp3', bossWarn: 'snd_boss_warn.mp3', bossKill: 'snd_boss_kill.mp3', gameover: 'snd_gameover.mp3' };
    const SOUND_VOLUME = { kill: 0.5, playerHit: 0.6, bossWarn: 0.6, bossKill: 0.7, gameover: 0.7 };
    
    const musicTrack = new Audio('crystals.mp3');
    musicTrack.loop = true; musicTrack.volume = 0.4; musicTrack.preload = 'auto';

    function initAudio() {
        if (audioCtx) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContext();
            Object.entries(SOUND_FILES).forEach(([key, url]) => {
                fetch(url).then(r => r.arrayBuffer()).then(buf => audioCtx.decodeAudioData(buf)).then(decoded => { soundBuffers[key] = decoded; }).catch(()=>{});
            });
        } catch (e) {}
    }

    function warmUpAudioEngine() {
        if (!audioCtx || audioCtx.state === 'suspended') return;
        try {
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            g.gain.value = 0.001; 
            o.connect(g); g.connect(audioCtx.destination);
            o.start(0); o.stop(audioCtx.currentTime + 0.05);
        } catch (e) {}
    }

    function playSound(name) {
        if (!audioCtx || !soundBuffers[name]) return;
        try {
            if (audioCtx.state === 'suspended') audioCtx.resume();
            const s = audioCtx.createBufferSource(), g = audioCtx.createGain();
            s.buffer = soundBuffers[name]; g.gain.value = SOUND_VOLUME[name] || 0.5;
            s.connect(g); g.connect(audioCtx.destination); s.start(0);
        } catch (e) {}
    }

    function playSynthShoot() {
        if (!audioCtx) return;
        try {
            if (audioCtx.state === 'suspended') audioCtx.resume();
            const o = audioCtx.createOscillator(), g = audioCtx.createGain(), n = audioCtx.currentTime;
            o.type = 'square'; o.frequency.setValueAtTime(880, n); o.frequency.exponentialRampToValueAtTime(220, n + 0.08);
            g.gain.setValueAtTime(0.06, n); g.gain.exponentialRampToValueAtTime(0.001, n + 0.1);
            o.connect(g); g.connect(audioCtx.destination); o.start(n); o.stop(n + 0.1);
        } catch (e) {}
    }
    function playSynthHit() {
        if (!audioCtx) return;
        try {
            if (audioCtx.state === 'suspended') audioCtx.resume();
            const o = audioCtx.createOscillator(), g = audioCtx.createGain(), n = audioCtx.currentTime;
            o.type = 'sine'; o.frequency.setValueAtTime(600, n); o.frequency.exponentialRampToValueAtTime(200, n + 0.06);
            g.gain.setValueAtTime(0.08, n); g.gain.exponentialRampToValueAtTime(0.001, n + 0.08);
            o.connect(g); g.connect(audioCtx.destination); o.start(n); o.stop(n + 0.08);
        } catch (e) {}
    }
    function playSynthWave() {
        if (!audioCtx) return;
        try {
            const o = audioCtx.createOscillator(), g = audioCtx.createGain(), n = audioCtx.currentTime;
            o.type = 'sine'; o.frequency.setValueAtTime(440, n); o.frequency.exponentialRampToValueAtTime(880, n + 0.2);
            g.gain.setValueAtTime(0.1, n); g.gain.linearRampToValueAtTime(0.1, n + 0.15); g.gain.exponentialRampToValueAtTime(0.001, n + 0.4);
            o.connect(g); g.connect(audioCtx.destination); o.start(n); o.stop(n + 0.4);
        } catch (e) {}
    }
    function playSynthWaveDone() {
        if (!audioCtx) return;
        try {
            const n = audioCtx.currentTime;
            [523, 659, 784].forEach((f, i) => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain(), t = n + i * 0.12;
                o.type = 'sine'; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
                o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t + 0.3);
            });
        } catch (e) {}
    }
    function playSynthHeal() {
        if (!audioCtx) return;
        try {
            const n = audioCtx.currentTime;
            [660, 880, 1100].forEach((f, i) => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain(), t = n + i * 0.1;
                o.type = 'sine'; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
                o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t + 0.25);
            });
        } catch (e) {}
    }

    function unlockAudio() {
        initAudio();
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        
        if (!audioUnlocked) {
            audioUnlocked = true;
            warmUpAudioEngine();
            musicTrack.play().then(() => {
                musicTrack.pause();
                musicTrack.currentTime = 0;
            }).catch(()=>{});
        }
    }

    document.addEventListener('click', unlockAudio, { once: true });
    document.addEventListener('touchstart', unlockAudio, { once: true });

    // ============================================================
    //  ★ КОНФИГ + БАЛАНС 
    // ============================================================
    const CFG = {
        playerSpeed:  12,       // Базовая скорость (будет расти)
        bulletSpeed:  20,       
        fireRate:     110,      // Базовая задержка (будет падать)
        lives:        3,
        invincTime:   2000,
        wavePause:    2500,
        bossEvery:    5
    };

    function scaleLimitless(startVal, softCap, currentWave, speedFactor) {
        if (currentWave <= 1) return startVal;
        const w = currentWave - 1;
        const t = w / (w + speedFactor);
        const base = startVal + (softCap - startVal) * t;
        const hardcoreCreep = w * (Math.abs(startVal) * 0.03); 
        return base + hardcoreCreep;
    }

    // ======= СОСТОЯНИЕ =======
    let W, H, score, lives, wave, running = false, animId, lastTime;
    let player = {};
    let bullets = [], enemies = [], particles = [], floatTexts = [], stars = [];
    let hearts = [], heartTimer = 0;
    const HEART_INTERVAL = 18000, HEART_CHANCE = 0.6, MAX_LIVES = 5;
    let toSpawn, spawnTimer, spawnInterval, waveState, wavePauseTimer, bossAlive;
    let keys = {}, pointerX = null, touchActive = false, firing = false, fireTimer = 0;
    let invincible, invTimer, shakeX, shakeY, shakeAmt, shakeDur;

    function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; if (player && player.y) player.y = H - 100; }
    window.addEventListener('resize', resize); resize();
    function showScreen(el) { [menuScreen, gameScreen, overScreen].forEach(s => s.classList.add('hidden')); el.classList.remove('hidden'); }

    // ===== ЗВЁЗДЫ =====
    function initStars() { stars = []; for (let i = 0; i < 130; i++) { stars.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.8 + 0.3, speed: Math.random() * 2 + 0.5, alpha: Math.random() * 0.7 + 0.3 }); } }
    function updateStars(dt) { const s60 = dt / 16.666; for (const s of stars) { s.y += s.speed * s60; if (s.y > H) { s.y = -2; s.x = Math.random() * W; } } }
    function drawStars() { for (const s of stars) { ctx.globalAlpha = s.alpha; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1; }

    // ===== ИГРОК =====
    function initPlayer() { player = { x: W / 2, y: H - 100, w: 40, h: 50 }; }
    function updatePlayer(dt) {
        const s60 = dt / 16.666;
        
        // ★ ПРОКАЧКА: С каждой волной корабль становится маневреннее
        const currentSpd = Math.min(22, CFG.playerSpeed + wave * 0.15);
        const speed = currentSpd * s60;

        if (keys['ArrowLeft'] || keys['KeyA']) player.x -= speed;
        if (keys['ArrowRight'] || keys['KeyD']) player.x += speed;
        if (pointerX !== null) player.x += (pointerX - player.x) * (0.2 * s60); 
        player.x = Math.max(22, Math.min(W - 22, player.x));
        if (invincible) { invTimer -= dt; if (invTimer <= 0) invincible = false; }
    }
    
    function drawPlayer() {
        if (invincible && Math.floor(Date.now() / 80) % 2) return;
        const { x, y } = player; ctx.save(); ctx.translate(x, y);
        ctx.shadowBlur = 12; ctx.shadowColor = '#f80'; ctx.fillStyle = '#f80';
        const fl = 8 + Math.random() * 12;
        ctx.beginPath(); ctx.moveTo(-6, 22); ctx.lineTo(0, 22 + fl); ctx.lineTo(6, 22); ctx.closePath(); ctx.fill();
        ctx.shadowColor = '#0ff'; ctx.shadowBlur = 15; ctx.fillStyle = '#0af';
        ctx.beginPath(); ctx.moveTo(0, -25); ctx.lineTo(-20, 22); ctx.lineTo(-8, 16); ctx.lineTo(0, 22); ctx.lineTo(8, 16); ctx.lineTo(20, 22); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#0ff'; ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(-6, 6); ctx.lineTo(6, 6); ctx.closePath(); ctx.fill();
        ctx.restore();
    }

    // ===== ПУЛИ (ЭВОЛЮЦИЯ СТВОЛОВ) =====
    function shoot() {
        const w = 4, h = 14;
        const bSpd = CFG.bulletSpeed; // Базовая скорость пули

        // ★ ПРОКАЧКА ОРУЖИЯ В ЗАВИСИМОСТИ ОТ ВОЛНЫ
        if (wave < 5) {
            // Уровень 1: Одиночная (Волны 1-4)
            bullets.push({ x: player.x, y: player.y - 28, w, h, vx: 0, vy: -bSpd });
        } else if (wave < 10) {
            // Уровень 2: Двойная (Волны 5-9)
            bullets.push({ x: player.x - 8, y: player.y - 28, w, h, vx: 0, vy: -bSpd });
            bullets.push({ x: player.x + 8, y: player.y - 28, w, h, vx: 0, vy: -bSpd });
        } else if (wave < 15) {
            // Уровень 3: Тройной веер (Волны 10-14)
            bullets.push({ x: player.x, y: player.y - 32, w, h, vx: 0, vy: -bSpd });
            bullets.push({ x: player.x - 10, y: player.y - 28, w, h, vx: -bSpd * 0.15, vy: -bSpd * 0.98 });
            bullets.push({ x: player.x + 10, y: player.y - 28, w, h, vx: bSpd * 0.15, vy: -bSpd * 0.98 });
        } else {
            // Уровень 4: МАШИНА СМЕРТИ (5 пуль, Волны 15+)
            bullets.push({ x: player.x, y: player.y - 32, w, h, vx: 0, vy: -bSpd });
            bullets.push({ x: player.x - 12, y: player.y - 28, w, h, vx: -bSpd * 0.15, vy: -bSpd * 0.98 });
            bullets.push({ x: player.x + 12, y: player.y - 28, w, h, vx: bSpd * 0.15, vy: -bSpd * 0.98 });
            bullets.push({ x: player.x - 24, y: player.y - 24, w, h, vx: -bSpd * 0.3, vy: -bSpd * 0.95 });
            bullets.push({ x: player.x + 24, y: player.y - 24, w, h, vx: bSpd * 0.3, vy: -bSpd * 0.95 });
        }
        
        playSynthShoot();
    }

    function handleFiring(dt) { 
        if (!firing) { fireTimer = 0; return; } 
        fireTimer -= dt; 
        if (fireTimer <= 0) { 
            shoot(); 
            // ★ ПРОКАЧКА: Скорострельность растет с каждой волной (база 110мс, снижается до 55мс)
            fireTimer = Math.max(55, CFG.fireRate - (wave * 2)); 
        } 
    }

    function updateBullets(dt) { 
        const s60 = dt / 16.666; 
        for (let i = bullets.length - 1; i >= 0; i--) { 
            bullets[i].x += bullets[i].vx * s60;
            bullets[i].y += bullets[i].vy * s60; 
            // Удаляем пулю, если она улетела за края экрана
            if (bullets[i].y < -20 || bullets[i].x < -20 || bullets[i].x > W + 20) {
                bullets.splice(i, 1); 
            }
        } 
    }

    function drawBullets() { 
        ctx.save(); 
        ctx.shadowBlur = 10; ctx.shadowColor = '#0ff'; ctx.fillStyle = '#0ff'; 
        for (const b of bullets) { 
            ctx.globalAlpha = 1; 
            ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h); 
            ctx.globalAlpha = 0.3; 
            ctx.fillRect(b.x - b.w, b.y, b.w * 2, b.h * 1.5); 
        } 
        ctx.globalAlpha = 1; 
        ctx.restore(); 
    }

    // ============================================================
    //  ★ ВРАГИ И БОСС 
    // ============================================================
    function spawnEnemy(isBoss) {
        const sz = isBoss ? 110 : 48 + Math.random() * 24;
        const spd = isBoss ? 0 : scaleLimitless(2.0, 5.0, wave, 25) + Math.random() * 1.5;

        let hp;
        if (isBoss) {
            // ★ БОСС ЖИРЕЕТ СИЛЬНЕЕ, потому что у тебя теперь дробовик
            hp = 40 + (wave * 25);
        } else {
            // Обычные мобы тоже слегка крепают
            hp = Math.floor(scaleLimitless(1, 5, wave, 15));
        }

        const img = isBoss ? BOSS_IMG : (ENEMY_IMGS.length > 0 ? ENEMY_IMGS[Math.floor(Math.random() * ENEMY_IMGS.length)] : null);

        enemies.push({
            x: Math.random() * (W - sz * 2) + sz, y: -sz - 30, w: sz, h: sz,
            speed: spd, hp: hp, maxHp: hp, img: img, boss: !!isBoss,
            zigzag: !isBoss && Math.random() > 0.4, 
            zigAmp: (Math.random() - 0.5) * 6,     
            angle: Math.random() * Math.PI * 2, flash: 0,
            bossDir: Math.random() > 0.5 ? 1 : -1,
            bossDiveTimer: 0, bossDiving: false, bossReturning: false
        });
    }

    function isOnScreen(e) { return (e.y - e.h / 2) >= 0; }

    function updateEnemies(dt) {
        const s60 = dt / 16.666;

        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];

            if (!e.boss) {
                e.y += e.speed * s60;
                if (e.zigzag) {
                    e.angle += 0.05 * s60;
                    e.x += Math.sin(e.angle) * e.zigAmp * s60;
                }
                e.x = Math.max(e.w / 2, Math.min(W - e.w / 2, e.x));
                if (e.y > H + e.h) { enemies.splice(i, 1); playerHit(); continue; }
            }

            if (e.boss) {
                if (!isOnScreen(e) && !e.bossDiving) { e.y += 2.0 * s60; e.x = Math.max(e.w / 2, Math.min(W - e.w / 2, e.x)); if (e.flash > 0) e.flash -= dt; continue; }

                const hpPercent = Math.max(0.1, e.hp / e.maxHp);
                const enrageMult = 1 + (1 - hpPercent) * 0.35; 

                const bossHorizSpd = scaleLimitless(2.5, 5.0, wave, 30) * enrageMult * s60;
                e.x += e.bossDir * bossHorizSpd;
                
                if (e.x < e.w / 2 + 20) { e.x = e.w / 2 + 20; e.bossDir = 1; }
                if (e.x > W - e.w / 2 - 20) { e.x = W - e.w / 2 - 20; e.bossDir = -1; }

                if (!e.bossDiving && !e.bossReturning) {
                    e.bossDiveTimer += dt;
                    
                    const diveInterval = Math.max(1500, scaleLimitless(3500, 2000, wave, 25) * hpPercent);
                    
                    if (e.bossDiveTimer > diveInterval) { e.bossDiving = true; e.bossDiveTimer = 0; }

                    const ty = H * 0.15 + e.h / 2;
                    if (e.y < ty - 3) e.y += 1.5 * s60; else if (e.y > ty + 3) e.y -= 1.5 * s60;
                    e.y += Math.sin(Date.now() / 600) * 0.6 * s60;
                }

                if (e.bossDiving) {
                    const diveSpd = scaleLimitless(6.0, 9.5, wave, 30) * enrageMult * s60;
                    e.y += diveSpd;
                    if (e.y >= player.y - 10 || e.y > H - 30) { 
                        e.y = Math.min(player.y - 10, H - 30); 
                        e.bossDiving = false; e.bossReturning = true; doShake(10, 250); 
                    }
                }

                if (e.bossReturning) {
                    const retSpd = scaleLimitless(3.5, 6.0, wave, 30) * s60;
                    e.y -= retSpd;
                    if (e.y <= H * 0.15 + e.h / 2) { 
                        e.y = H * 0.15 + e.h / 2; 
                        e.bossReturning = false; 
                        e.bossDiveTimer = 0;
                    }
                }
                e.x = Math.max(e.w / 2, Math.min(W - e.w / 2, e.x));
            }
            if (e.flash > 0) e.flash -= dt;
        }
    }

    function drawEnemies() {
        for (const e of enemies) {
            if (!e.boss && !isOnScreen(e)) continue; ctx.save();
            if (e.flash > 0) { ctx.shadowBlur = 25; ctx.shadowColor = '#fff'; }
            drawImgSafe(e.img, e.x - e.w / 2, e.y - e.h / 2, e.w, e.h);
            
            if (e.hp > 0) {
                const bw = e.w * (e.boss ? 1.3 : 1), bh = e.boss ? 8 : 5, bx = e.x - bw / 2, by = e.y - e.h / 2 - (e.boss ? 20 : 12), r = e.hp / e.maxHp;
                ctx.fillStyle = '#222'; ctx.fillRect(bx, by, bw, bh); ctx.fillStyle = r > 0.5 ? '#0f0' : r > 0.25 ? '#ff0' : '#f00';
                ctx.fillRect(bx, by, bw * r, bh); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, bh);
            }
            
            if (e.boss && e.hp > 0) { ctx.fillStyle = '#ff0'; ctx.font = 'bold 14px Orbitron'; ctx.textAlign = 'center'; ctx.shadowBlur = 8; ctx.shadowColor = '#ff0'; ctx.fillText('ГАЛЮХА-БОСС', e.x, e.y - e.h / 2 - 28); }
            ctx.restore();
        }
    }

    // ===== ЧАСТИЦЫ + ТЕКСТ =====
    function boom(x, y, c, col) { for (let i = 0; i < c; i++) { const a = Math.random() * Math.PI * 2, v = Math.random() * 5 + 2; particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: Math.random() * 4 + 1.5, life: 1, decay: Math.random() * 0.025 + 0.015, color: col || `hsl(${Math.random() * 50 + 10},100%,55%)` }); } }
    function updateParticles(dt) { const s60 = dt / 16.666; for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.x += p.vx * s60; p.y += p.vy * s60; p.vy += 0.06 * s60; p.life -= p.decay * s60; if (p.life <= 0) particles.splice(i, 1); } }
    function drawParticles() { for (const p of particles) { ctx.save(); ctx.globalAlpha = p.life; ctx.shadowBlur = 6; ctx.shadowColor = p.color; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); ctx.restore(); } }
    function addText(x, y, t, c, s, d) { floatTexts.push({ x, y, text: t, color: c, size: s || 22, life: 1, vy: -1.2, decay: d || 0.015 }); }
    function updateTexts(dt) { const s60 = dt / 16.666; for (let i = floatTexts.length - 1; i >= 0; i--) { const t = floatTexts[i]; t.y += t.vy * s60; t.life -= t.decay * s60; if (t.life <= 0) floatTexts.splice(i, 1); } }
    function drawTexts() { for (const t of floatTexts) { ctx.save(); ctx.globalAlpha = t.life; ctx.fillStyle = t.color; ctx.font = `bold ${t.size}px Orbitron`; ctx.textAlign = 'center'; ctx.shadowBlur = 12; ctx.shadowColor = t.color; ctx.fillText(t.text, t.x, t.y); ctx.restore(); } }

    // ===== СЕРДЕЧКИ =====
    function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
    function spawnHeart() { hearts.push({ x: Math.random() * (W - 60) + 30, y: -30, size: 22, speed: 2.0 + Math.random() * 1.5, glow: 0 }); }
    function updateHearts(dt) {
        const s60 = dt / 16.666; heartTimer += dt;
        if (heartTimer >= HEART_INTERVAL) { heartTimer = 0; if (Math.random() < HEART_CHANCE && lives < MAX_LIVES) spawnHeart(); }
        for (let i = hearts.length - 1; i >= 0; i--) {
            const h = hearts[i]; h.y += h.speed * s60; h.glow += 0.05 * s60;
            if (h.y > H + 40) { hearts.splice(i, 1); continue; }
            if (dist(player.x, player.y, h.x, h.y) < 30) { hearts.splice(i, 1); if (lives < MAX_LIVES) { lives++; elLives.textContent = lives; addText(h.x, h.y, '+1 ❤️', '#ff4444', 24); boom(h.x, h.y, 12, '#ff4444'); playSynthHeal(); } }
        }
    }
    function drawHearts() { for (const h of hearts) { ctx.save(); const pulse = 1 + Math.sin(h.glow) * 0.15; ctx.translate(h.x, h.y); ctx.scale(pulse, pulse); ctx.shadowBlur = 15 + Math.sin(h.glow * 2) * 5; ctx.shadowColor = '#ff4444'; ctx.fillStyle = '#ff4444'; ctx.beginPath(); ctx.moveTo(0, -8); ctx.bezierCurveTo(-12, -22, -26, -10, -14, 4); ctx.lineTo(0, 18); ctx.lineTo(14, 4); ctx.bezierCurveTo(26, -10, 12, -22, 0, -8); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(-6, -10, 4, 3, -0.5, 0, Math.PI * 2); ctx.fill(); ctx.restore(); } }

    // ===== СТОЛКНОВЕНИЯ =====
    function checkCollisions() {
        for (let bi = bullets.length - 1; bi >= 0; bi--) {
            const b = bullets[bi];
            for (let ei = enemies.length - 1; ei >= 0; ei--) {
                const e = enemies[ei]; if (!isOnScreen(e)) continue;
                if (dist(b.x, b.y, e.x, e.y) < e.w / 2 + 6) {
                    bullets.splice(bi, 1); e.hp--; e.flash = 80; boom(b.x, b.y, 4, '#0ff'); playSynthHit();
                    if (e.hp <= 0) {
                        const pts = e.boss ? 500 * wave : 100; score += pts; elScore.textContent = score; 
                        boom(e.x, e.y, e.boss ? 55 : 20, e.boss ? '#ff0' : '#f80'); 
                        
                        const tx = e.x + (Math.random() - 0.5) * 30;
                        const ty = e.y + (Math.random() - 0.5) * 20;
                        addText(tx, ty, '+' + pts, e.boss ? '#ff0' : '#0ff');

                        if (e.boss) { 
                            bossAlive = false; doShake(16, 600); 
                            floatTexts = floatTexts.filter(t => !t.text.includes('ГАЛЮХА УНИЧТОЖЕНА'));
                            addText(W / 2, H / 2, 'ГАЛЮХА УНИЧТОЖЕНА!', '#0f0', 26, 0.008); 
                            playSound('bossKill'); 
                        } else { 
                            playSound('kill'); 
                        }
                        enemies.splice(ei, 1);
                    }
                    break; // Переходим к следующей пуле
                }
            }
        }
        if (!invincible) {
            for (let ei = enemies.length - 1; ei >= 0; ei--) {
                const e = enemies[ei]; if (!isOnScreen(e)) continue;
                if (dist(player.x, player.y, e.x, e.y) < e.w / 2 + 16) {
                    if (!e.boss) enemies.splice(ei, 1); boom(player.x, player.y, 22, '#f44'); playerHit(); break;
                }
            }
        }
    }

    // ===== УРОН / GAME OVER =====
    function playerHit() {
        if (invincible) return;
        lives--; elLives.textContent = lives; invincible = true; invTimer = CFG.invincTime; doShake(12, 350); playSound('playerHit');
        if (lives <= 0) gameOver();
    }
    function gameOver() {
        running = false; cancelAnimationFrame(animId);
        musicTrack.pause();
        setTimeout(() => { playSound('gameover'); }, 100);
        const isNew = saveRecord(currentNick, score, wave);
        elFinalScore.textContent = score; elFinalWave.textContent = wave; elGameoverNick.textContent = currentNick;
        if (isNew) elNewRecord.classList.remove('hidden'); else elNewRecord.classList.add('hidden');
        setTimeout(() => showScreen(overScreen), 600);
    }

    function doShake(a, d) { shakeAmt = a; shakeDur = d; }
    function updateShake(dt) { if (shakeDur > 0) { shakeDur -= dt; shakeX = (Math.random() - 0.5) * shakeAmt; shakeY = (Math.random() - 0.5) * shakeAmt; if (shakeDur <= 0) shakeX = shakeY = shakeAmt = 0; } }

    // ============================================================
    //  ★ ВОЛНЫ
    // ============================================================
    function startWave() {
        waveState = 'active';
        const isBoss = wave % CFG.bossEvery === 0;

        if (isBoss) {
            toSpawn = 0; spawnEnemy(true); bossAlive = true; 
            floatTexts = floatTexts.filter(t => !t.text.includes('БОСС')); 
            addText(W / 2, H / 2 - 30, '⚠ БОСС-ГАЛЮХА ⚠', '#ff0', 28, 0.008); playSound('bossWarn');
        } else {
            toSpawn = Math.floor(scaleLimitless(8, 45, wave, 25));
            spawnInterval = Math.max(250, scaleLimitless(900, 300, wave, 25));

            // ★ Выводим инфу, если корабль прокачался
            let extraText = '';
            if (wave === 5) extraText = 'ОТКРЫТ ДВОЙНОЙ СТВОЛ!';
            if (wave === 10) extraText = 'ОТКРЫТ ТРОЙНОЙ ВЕЕР!';
            if (wave === 15) extraText = 'МАШИНА СМЕРТИ АКТИВИРОВАНА!';

            spawnTimer = 0; 
            addText(W / 2, H / 2, 'ВОЛНА ' + wave, '#0ff', 32, 0.008); 
            if (extraText) setTimeout(() => addText(W / 2, H / 2 + 40, extraText, '#0f0', 20, 0.006), 500);
            
            playSynthWave();
        }
        elWave.textContent = wave;
    }

    function updateWave(dt) {
        if (waveState === 'active') {
            if (toSpawn > 0) { spawnTimer += dt; if (spawnTimer >= spawnInterval) { spawnTimer = 0; spawnEnemy(false); toSpawn--; } }
            if (toSpawn <= 0 && enemies.length === 0) { waveState = 'cooldown'; wavePauseTimer = 0; addText(W / 2, H / 2, '✔ ВОЛНА ПРОЙДЕНА!', '#0f0', 26, 0.008); playSynthWaveDone(); }
        } else {
            wavePauseTimer += dt; if (wavePauseTimer >= CFG.wavePause) { wave++; startWave(); }
        }
    }

    // ===== ГЛАВНЫЙ ЦИКЛ =====
    function loop(time) {
        if (!running) return; animId = requestAnimationFrame(loop);
        const dt = Math.min(time - lastTime, 50); lastTime = time;

        updateStars(dt); updatePlayer(dt); handleFiring(dt); updateBullets(dt); updateEnemies(dt); updateParticles(dt); updateTexts(dt); updateHearts(dt); checkCollisions(); updateWave(dt); updateShake(dt);

        ctx.save(); ctx.translate(shakeX, shakeY); ctx.fillStyle = '#050510'; ctx.fillRect(-10, -10, W + 20, H + 20);
        drawStars(); drawBullets(); drawEnemies(); drawHearts(); drawPlayer(); drawParticles(); drawTexts(); ctx.restore();
    }

    // ===== СТАРТ =====
    function startGameDirect() {
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        
        musicTrack.currentTime = 0;
        musicTrack.play().catch(()=>{});

        resize();
        score = 0; lives = CFG.lives; wave = 1;
        elScore.textContent = '0'; elLives.textContent = lives; elWave.textContent = '1';
        bullets = []; enemies = []; particles = []; floatTexts = []; hearts = []; heartTimer = 0;
        invincible = false; invTimer = 0; bossAlive = false; shakeX = shakeY = shakeAmt = shakeDur = 0;
        fireTimer = 0; firing = false; pointerX = null; touchActive = false;
        initStars(); initPlayer(); showScreen(gameScreen);

        requestAnimationFrame(() => { resize(); running = true; lastTime = performance.now(); animId = requestAnimationFrame(loop); startWave(); });
    }

    btnPlay.addEventListener('click', () => { showNickModal(); });
    btnRestart.addEventListener('click', () => { unlockAudio(); startGameDirect(); });
    btnMenu.addEventListener('click', () => { running = false; cancelAnimationFrame(animId); musicTrack.pause(); showScreen(menuScreen); });

    // ===== УПРАВЛЕНИЕ =====
    window.addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'Space') { e.preventDefault(); firing = true; } });
    window.addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'Space') firing = false; });
    canvas.addEventListener('mousemove', e => { if (running && !isMobile) pointerX = e.clientX; });
    canvas.addEventListener('mousedown', () => { if (running && !isMobile) firing = true; });
    canvas.addEventListener('mouseup', () => { if (!isMobile) firing = false; });
    canvas.addEventListener('mouseleave', () => { if (!isMobile) pointerX = null; });
    canvas.addEventListener('touchstart', e => { e.preventDefault(); if (!running) return; touchActive = true; if (e.touches.length) pointerX = e.touches[0].clientX; firing = true; }, { passive: false });
    canvas.addEventListener('touchmove', e => { e.preventDefault(); if (!running) return; if (e.touches.length) pointerX = e.touches[0].clientX; }, { passive: false });
    canvas.addEventListener('touchend', e => { e.preventDefault(); if (e.touches.length > 0) pointerX = e.touches[0].clientX; else { pointerX = null; touchActive = false; firing = false; } }, { passive: false });

    initSupabase();

})();
