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

    // ======= КАРТИНКИ =======
    const ENEMY_IMGS = ['shit1.png','shit2.png','shit3.png','shit4.png'].map(src => {
        const img = new Image(); img.src = src; return img;
    });
    const BOSS_IMG = new Image();
    BOSS_IMG.src = 'shit_final.png';

    // ============================================================
    //  СИСТЕМА НИКОВ
    // ============================================================
    const DEV_NICKS = ['miralys', 'vikxii', 'dr.hentai'];
    const MIRALYS_PASSWORD = 'CHANGE_ME';
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
        const saved = localStorage.getItem(getDevPassKey(nick));
        return saved !== null && saved === pass;
    }
    function isDevSessionOk(nick) { return devSessionAuth.has(nick.toLowerCase().trim()); }
    function markDevSession(nick) { devSessionAuth.add(nick.toLowerCase().trim()); }
    function saveLastNick(nick) { localStorage.setItem('galuha_last_nick', nick); }
    function getLastNick() { return localStorage.getItem('galuha_last_nick') || ''; }

    // === Рекорды ===
    function getRecords() {
        try { const d = localStorage.getItem('galuha_records'); return d ? JSON.parse(d) : []; }
        catch (e) { return []; }
    }
    function saveRecord(nick, sc, waveNum) {
        const records = getRecords();
        const existing = records.find(r => r.nick.toLowerCase() === nick.toLowerCase());
        const isDev = isDevNick(nick), isMain = isMainDev(nick);
        let isNew = false;
        if (existing) {
            if (sc > existing.score) { existing.score = sc; existing.wave = waveNum; existing.date = Date.now(); existing.isDev = isDev; existing.isMain = isMain; isNew = true; }
        } else { records.push({ nick, score: sc, wave: waveNum, date: Date.now(), isDev, isMain }); isNew = true; }
        records.sort((a, b) => b.score - a.score);
        localStorage.setItem('galuha_records', JSON.stringify(records));
        return isNew;
    }
    function getPlayerRecord(nick) { return getRecords().find(r => r.nick.toLowerCase() === nick.toLowerCase()) || null; }

    window.renderRecords = function () {
        const list = document.getElementById('records-list');
        const records = getRecords();
        if (records.length === 0) { list.innerHTML = '<p class="no-records">Пока никто не играл. Будь первым!</p>'; return; }
        const medals = ['👑', '🥈', '🥉'];
        let html = '';
        records.forEach((r, i) => {
            const medal = i < 3 ? medals[i] : (i + 1);
            let badge = '';
            if (r.isMain || r.nick.toLowerCase() === 'miralys') badge = '<span class="dev-badge main-dev">MAIN DEV</span>';
            else if (r.isDev) badge = '<span class="dev-badge">DEV</span>';
            html += `<div class="record-row ${i === 0 ? 'gold' : ''}"><span class="record-rank">${medal}</span><span class="record-nick">${r.nick}${badge}</span><span class="record-score">${r.score}</span><span class="record-wave">W${r.wave}</span></div>`;
        });
        list.innerHTML = html;
    };

    function getPassInput() { return document.getElementById('dev-password'); }

    function showNickModal() {
        nickModal.classList.remove('hidden');
        nickWelcome.classList.add('hidden');
        devCheck.classList.add('hidden');
        devCheck.innerHTML = '';
        const lastNick = getLastNick();
        nickInput.value = lastNick;
        if (lastNick) {
            if (isDevNick(lastNick) && isDevSessionOk(lastNick)) { currentNick = lastNick; hideNickModal(); launchGame(); return; }
            handleNickInput(lastNick);
        }
        nickInput.focus();
    }
    function hideNickModal() { nickModal.classList.add('hidden'); }

    function handleNickInput(nick) {
        nickWelcome.classList.add('hidden');
        devCheck.classList.add('hidden');
        devCheck.innerHTML = '';
        if (!nick) return;
        if (isDevNick(nick)) {
            if (isDevSessionOk(nick)) {
                const rec = getPlayerRecord(nick);
                nickWelcome.classList.remove('hidden');
                const role = isMainDev(nick) ? '(MAIN DEV)' : '(DEV)';
                nickWelcome.innerHTML = rec
                    ? `<p>С возвращением, <strong>${rec.nick}</strong>! ${role} 👋</p><p class="welcome-record">Твой рекорд: ${rec.score} очков (волна ${rec.wave})</p>`
                    : `<p>С возвращением, <strong>${nick}</strong>! ${role} 👋</p>`;
                return;
            }
            devCheck.classList.remove('hidden');
            const n = nick.toLowerCase().trim();
            if (n === 'miralys' || hasDevPassword(nick)) {
                devCheck.innerHTML = `<p class="dev-check-text">Это никнейм разработчика. Пруфани, что это ты.</p><input type="password" id="dev-password" class="nick-input dev-password-input" placeholder="Пароль..." maxlength="32" autocomplete="off">`;
            } else {
                devCheck.innerHTML = `<p class="dev-check-text setup-text">О, мы тебя знаем. Ты тоже разраб этой игры. Придумай пароль, пока никакая сука не спиздила аккаунт.</p><input type="password" id="dev-password" class="nick-input dev-password-input" placeholder="Придумай пароль..." maxlength="32" autocomplete="off">`;
            }
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
            const passInput = getPassInput();
            const pass = passInput ? passInput.value : '';
            if (!pass) { if (passInput) { passInput.style.borderColor = '#f44'; setTimeout(() => { passInput.style.borderColor = '#ffcc00'; }, 1000); } return; }
            const n = nick.toLowerCase().trim();
            if (n === 'miralys' || hasDevPassword(nick)) { if (!checkDevPassword(nick, pass)) { hideNickModal(); impostorModal.classList.remove('hidden'); return; } }
            else { saveDevPassword(nick, pass); }
            markDevSession(nick);
        }
        currentNick = nick; saveLastNick(nick); hideNickModal(); launchGame();
    });

    nickInput.addEventListener('keydown', e => { if (e.key === 'Enter') { const pi = getPassInput(); if (pi && !pi.value) pi.focus(); else btnNickGo.click(); } });

    // ============================================================
    //  ЗВУКОВОЙ ДВИЖОК
    // ============================================================
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    let audioCtx = null, audioReady = false, audioUnlocked = false;
    const soundBuffers = {};
    const SOUND_FILES = { kill: 'snd_kill.mp3', playerHit: 'snd_player_hit.mp3', bossWarn: 'snd_boss_warn.mp3', bossKill: 'snd_boss_kill.mp3', gameover: 'snd_gameover.mp3' };
    const SOUND_VOLUME = { kill: 0.5, playerHit: 0.6, bossWarn: 0.6, bossKill: 0.7, gameover: 0.7 };
    const musicTrack = new Audio('crystals.mp3');
    musicTrack.loop = true; musicTrack.volume = 0.4; musicTrack.preload = 'auto';
    let musicPlaying = false;

    function initAudio() { if (audioCtx) return; try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); loadAllSounds(); } catch (e) {} }
    function loadAllSounds() { const entries = Object.entries(SOUND_FILES); let loaded = 0; entries.forEach(([key, url]) => { fetch(url).then(r => r.arrayBuffer()).then(buf => audioCtx.decodeAudioData(buf)).then(decoded => { soundBuffers[key] = decoded; loaded++; if (loaded === entries.length) audioReady = true; }).catch(() => { loaded++; if (loaded === entries.length) audioReady = true; }); }); }
    function playSound(name) { if (!audioCtx || !soundBuffers[name]) return; try { if (audioCtx.state === 'suspended') audioCtx.resume(); const s = audioCtx.createBufferSource(), g = audioCtx.createGain(); s.buffer = soundBuffers[name]; g.gain.value = SOUND_VOLUME[name] || 0.5; s.connect(g); g.connect(audioCtx.destination); s.start(0); } catch (e) {} }
    function playGameoverSound() { if (!audioCtx || !soundBuffers['gameover']) return; try { if (audioCtx.state === 'suspended') audioCtx.resume(); setTimeout(() => { const s = audioCtx.createBufferSource(), g = audioCtx.createGain(); s.buffer = soundBuffers['gameover']; g.gain.value = 0.7; s.connect(g); g.connect(audioCtx.destination); s.start(0); }, 50); } catch (e) {} }

    function playSynthShoot() { if (!audioCtx) return; try { if (audioCtx.state === 'suspended') audioCtx.resume(); const o = audioCtx.createOscillator(), g = audioCtx.createGain(), n = audioCtx.currentTime; o.type = 'square'; o.frequency.setValueAtTime(880, n); o.frequency.exponentialRampToValueAtTime(220, n + 0.08); g.gain.setValueAtTime(0.06, n); g.gain.exponentialRampToValueAtTime(0.001, n + 0.1); o.connect(g); g.connect(audioCtx.destination); o.start(n); o.stop(n + 0.1); } catch (e) {} }
    function playSynthHit() { if (!audioCtx) return; try { if (audioCtx.state === 'suspended') audioCtx.resume(); const o = audioCtx.createOscillator(), g = audioCtx.createGain(), n = audioCtx.currentTime; o.type = 'sine'; o.frequency.setValueAtTime(600, n); o.frequency.exponentialRampToValueAtTime(200, n + 0.06); g.gain.setValueAtTime(0.08, n); g.gain.exponentialRampToValueAtTime(0.001, n + 0.08); o.connect(g); g.connect(audioCtx.destination); o.start(n); o.stop(n + 0.08); } catch (e) {} }
    function playSynthWave() { if (!audioCtx) return; try { if (audioCtx.state === 'suspended') audioCtx.resume(); const o = audioCtx.createOscillator(), g = audioCtx.createGain(), n = audioCtx.currentTime; o.type = 'sine'; o.frequency.setValueAtTime(440, n); o.frequency.exponentialRampToValueAtTime(880, n + 0.2); g.gain.setValueAtTime(0.1, n); g.gain.linearRampToValueAtTime(0.1, n + 0.15); g.gain.exponentialRampToValueAtTime(0.001, n + 0.4); o.connect(g); g.connect(audioCtx.destination); o.start(n); o.stop(n + 0.4); } catch (e) {} }
    function playSynthWaveDone() { if (!audioCtx) return; try { if (audioCtx.state === 'suspended') audioCtx.resume(); const n = audioCtx.currentTime; [523, 659, 784].forEach((f, i) => { const o = audioCtx.createOscillator(), g = audioCtx.createGain(), t = n + i * 0.12; o.type = 'sine'; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t + 0.3); }); } catch (e) {} }
    function playSynthHeal() { if (!audioCtx) return; try { if (audioCtx.state === 'suspended') audioCtx.resume(); const n = audioCtx.currentTime; [660, 880, 1100].forEach((f, i) => { const o = audioCtx.createOscillator(), g = audioCtx.createGain(), t = n + i * 0.1; o.type = 'sine'; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25); o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t + 0.25); }); } catch (e) {} }

    function startMusic() { musicTrack.currentTime = 0; musicPlaying = false; function tryPlay() { musicTrack.play().then(() => { musicPlaying = true; }).catch(() => { if (!musicPlaying && running) setTimeout(tryPlay, 500); }); } tryPlay(); }
    function stopMusic() { musicPlaying = false; musicTrack.pause(); musicTrack.currentTime = 0; }
    function unlockAudio() { if (audioUnlocked) return; audioUnlocked = true; initAudio(); const v = musicTrack.volume; musicTrack.volume = 0.001; musicTrack.play().then(() => { musicTrack.pause(); musicTrack.currentTime = 0; musicTrack.volume = v; }).catch(() => { musicTrack.volume = v; }); if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); }
    document.addEventListener('click', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);

    // ======= КОНФИГ =======
    const CFG = { playerSpeed: 7, bulletSpeed: 12, fireRate: 140, enemyBaseHp: 1, enemyHpGrow: 0.15, enemySpeed: 1.0, enemySpeedGrow: 0.08, enemyCount: 4, bossEvery: 5, bossHp: 15, bossHpGrow: 2, lives: 3, invincTime: 2000, wavePause: 2500, spawnDelay: 1200 };

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
    function initStars() { stars = []; for (let i = 0; i < 130; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.8 + 0.3, speed: Math.random() * 2 + 0.5, alpha: Math.random() * 0.7 + 0.3 }); }
    function updateStars() { for (const s of stars) { s.y += s.speed; if (s.y > H) { s.y = -2; s.x = Math.random() * W; } } }
    function drawStars() { for (const s of stars) { ctx.globalAlpha = s.alpha; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1; }

    // ===== ИГРОК =====
    function initPlayer() { player = { x: W / 2, y: H - 100, w: 40, h: 50 }; }
    function updatePlayer(dt) {
        if (keys['ArrowLeft'] || keys['KeyA']) player.x -= CFG.playerSpeed;
        if (keys['ArrowRight'] || keys['KeyD']) player.x += CFG.playerSpeed;
        if (pointerX !== null) player.x += (pointerX - player.x) * 0.14;
        player.x = Math.max(22, Math.min(W - 22, player.x));
        if (invincible) { invTimer -= dt; if (invTimer <= 0) invincible = false; }
    }
    function drawPlayer() {
        if (invincible && Math.floor(Date.now() / 80) % 2) return;
        const { x, y } = player; ctx.save(); ctx.translate(x, y);
        ctx.shadowBlur = 12; ctx.shadowColor = '#f80'; ctx.fillStyle = '#f80';
        const fl = 8 + Math.random() * 12; ctx.beginPath(); ctx.moveTo(-6, 22); ctx.lineTo(0, 22 + fl); ctx.lineTo(6, 22); ctx.closePath(); ctx.fill();
        ctx.shadowColor = '#0ff'; ctx.shadowBlur = 15; ctx.fillStyle = '#0af';
        ctx.beginPath(); ctx.moveTo(0, -25); ctx.lineTo(-20, 22); ctx.lineTo(-8, 16); ctx.lineTo(0, 22); ctx.lineTo(8, 16); ctx.lineTo(20, 22); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#0ff'; ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(-6, 6); ctx.lineTo(6, 6); ctx.closePath(); ctx.fill();
        ctx.restore();
    }

    // ===== ПУЛИ =====
    function shoot() { bullets.push({ x: player.x, y: player.y - 28, w: 4, h: 14 }); playSynthShoot(); }
    function handleFiring(dt) { if (!firing) { fireTimer = 0; return; } fireTimer -= dt; if (fireTimer <= 0) { shoot(); fireTimer = CFG.fireRate; } }
    function updateBullets() { for (let i = bullets.length - 1; i >= 0; i--) { bullets[i].y -= CFG.bulletSpeed; if (bullets[i].y < -20) bullets.splice(i, 1); } }
    function drawBullets() { ctx.save(); ctx.shadowBlur = 10; ctx.shadowColor = '#0ff'; ctx.fillStyle = '#0ff'; for (const b of bullets) { ctx.globalAlpha = 1; ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h); ctx.globalAlpha = 0.3; ctx.fillRect(b.x - b.w, b.y, b.w * 2, b.h * 1.5); } ctx.globalAlpha = 1; ctx.restore(); }

    // ===== ВРАГИ =====
    function spawnEnemy(isBoss) {
        const sz = isBoss ? 110 : 48 + Math.random() * 24;
        const spd = isBoss ? 0.6 + wave * 0.06 : CFG.enemySpeed + wave * CFG.enemySpeedGrow + Math.random() * 0.8;
        const hp = isBoss ? CFG.bossHp + wave * CFG.bossHpGrow : Math.ceil(CFG.enemyBaseHp + wave * CFG.enemyHpGrow);
        enemies.push({ x: Math.random() * (W - sz * 2) + sz, y: -sz - 30, w: sz, h: sz, speed: spd, hp, maxHp: hp, img: isBoss ? BOSS_IMG : ENEMY_IMGS[Math.floor(Math.random() * ENEMY_IMGS.length)], boss: !!isBoss, zigzag: !isBoss && Math.random() > 0.4, zigAmp: (Math.random() - 0.5) * 4, angle: Math.random() * Math.PI * 2, flash: 0, bossDir: Math.random() > 0.5 ? 1 : -1, bossDiveTimer: 0, bossDiving: false, bossReturning: false });
    }
    function isOnScreen(e) { return (e.y - e.h / 2) >= 0; }
    function updateEnemies(dt) {
        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            if (!e.boss) { e.y += e.speed; if (e.zigzag) { e.angle += 0.04; e.x += Math.sin(e.angle) * e.zigAmp; } e.x = Math.max(e.w / 2, Math.min(W - e.w / 2, e.x)); if (e.y > H + e.h) { enemies.splice(i, 1); playerHit(); continue; } }
            if (e.boss) {
                if (!isOnScreen(e) && !e.bossDiving) { e.y += 1.5; e.x = Math.max(e.w / 2, Math.min(W - e.w / 2, e.x)); if (e.flash > 0) e.flash -= dt; continue; }
                const bsx = 2.5 + wave * 0.3; e.x += e.bossDir * bsx;
                if (e.x < e.w / 2 + 20) { e.x = e.w / 2 + 20; e.bossDir = 1; } if (e.x > W - e.w / 2 - 20) { e.x = W - e.w / 2 - 20; e.bossDir = -1; }
                if (!e.bossDiving && !e.bossReturning) { e.bossDiveTimer += dt; if (e.bossDiveTimer > Math.max(1800, 4000 - wave * 200)) { e.bossDiving = true; e.bossDiveTimer = 0; } const ty = H * 0.15 + e.h / 2; if (e.y < ty - 3) e.y += 1; else if (e.y > ty + 3) e.y -= 1; e.y += Math.sin(Date.now() / 800) * 0.4; }
                if (e.bossDiving) { e.y += 5 + wave * 0.4; if (e.y >= player.y - 10) { e.y = player.y - 10; e.bossDiving = false; e.bossReturning = true; doShake(6, 200); } if (e.y > H - 30) { e.y = H - 30; e.bossDiving = false; e.bossReturning = true; doShake(6, 200); } }
                if (e.bossReturning) { e.y -= 2.5; if (e.y <= H * 0.15 + e.h / 2) { e.y = H * 0.15 + e.h / 2; e.bossReturning = false; e.bossDiveTimer = 0; } }
                e.x = Math.max(e.w / 2, Math.min(W - e.w / 2, e.x));
            }
            if (e.flash > 0) e.flash -= dt;
        }
    }
    function drawEnemies() {
        for (const e of enemies) {
            if (!e.boss && !isOnScreen(e)) continue; ctx.save();
            if (e.flash > 0) { ctx.shadowBlur = 25; ctx.shadowColor = '#fff'; }
            ctx.drawImage(e.img, e.x - e.w / 2, e.y - e.h / 2, e.w, e.h);
            if (e.maxHp > 1 && e.hp > 0) { const bw = e.w * (e.boss ? 1.3 : 1), bh = e.boss ? 8 : 5, bx = e.x - bw / 2, by = e.y - e.h / 2 - (e.boss ? 20 : 12), r = e.hp / e.maxHp; ctx.fillStyle = '#222'; ctx.fillRect(bx, by, bw, bh); ctx.fillStyle = r > 0.5 ? '#0f0' : r > 0.25 ? '#ff0' : '#f00'; ctx.fillRect(bx, by, bw * r, bh); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, bh); }
            if (e.boss && e.hp > 0) { ctx.fillStyle = '#ff0'; ctx.font = 'bold 14px Orbitron'; ctx.textAlign = 'center'; ctx.shadowBlur = 8; ctx.shadowColor = '#ff0'; ctx.fillText('ГАЛЮХА-БОСС', e.x, e.y - e.h / 2 - 28); }
            ctx.restore();
        }
    }

    // ===== ЧАСТИЦЫ + ТЕКСТ =====
    function boom(x, y, c, col) { for (let i = 0; i < c; i++) { const a = Math.random() * Math.PI * 2, v = Math.random() * 5 + 2; particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: Math.random() * 4 + 1.5, life: 1, decay: Math.random() * 0.025 + 0.015, color: col || `hsl(${Math.random() * 50 + 10},100%,55%)` }); } }
    function updateParticles() { for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.life -= p.decay; if (p.life <= 0) particles.splice(i, 1); } }
    function drawParticles() { for (const p of particles) { ctx.save(); ctx.globalAlpha = p.life; ctx.shadowBlur = 6; ctx.shadowColor = p.color; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); ctx.restore(); } }
    function addText(x, y, t, c, s, d) { floatTexts.push({ x, y, text: t, color: c, size: s || 22, life: 1, vy: -1.2, decay: d || 0.015 }); }
    function updateTexts() { for (let i = floatTexts.length - 1; i >= 0; i--) { const t = floatTexts[i]; t.y += t.vy; t.life -= t.decay; if (t.life <= 0) floatTexts.splice(i, 1); } }
    function drawTexts() { for (const t of floatTexts) { ctx.save(); ctx.globalAlpha = t.life; ctx.fillStyle = t.color; ctx.font = `bold ${t.size}px Orbitron`; ctx.textAlign = 'center'; ctx.shadowBlur = 12; ctx.shadowColor = t.color; ctx.fillText(t.text, t.x, t.y); ctx.restore(); } }

    // ===== СЕРДЕЧКИ =====
    function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

    function spawnHeart() { hearts.push({ x: Math.random() * (W - 60) + 30, y: -30, size: 22, speed: 1.5 + Math.random() * 0.8, glow: 0 }); }

    function updateHearts(dt) {
        heartTimer += dt;
        if (heartTimer >= HEART_INTERVAL) { heartTimer = 0; if (Math.random() < HEART_CHANCE && lives < MAX_LIVES) spawnHeart(); }
        for (let i = hearts.length - 1; i >= 0; i--) {
            const h = hearts[i]; h.y += h.speed; h.glow += 0.05;
            if (h.y > H + 40) { hearts.splice(i, 1); continue; }
            if (dist(player.x, player.y, h.x, h.y) < 30) {
                hearts.splice(i, 1);
                if (lives < MAX_LIVES) { lives++; elLives.textContent = lives; addText(h.x, h.y, '+1 ❤️', '#ff4444', 24); boom(h.x, h.y, 12, '#ff4444'); playSynthHeal(); }
            }
        }
    }

    function drawHearts() {
        for (const h of hearts) {
            ctx.save();
            const pulse = 1 + Math.sin(h.glow) * 0.15;
            ctx.translate(h.x, h.y); ctx.scale(pulse, pulse);
            ctx.shadowBlur = 15 + Math.sin(h.glow * 2) * 5; ctx.shadowColor = '#ff4444';
            ctx.fillStyle = '#ff4444'; ctx.beginPath(); ctx.moveTo(0, -8);
            ctx.bezierCurveTo(-12, -22, -26, -10, -14, 4); ctx.lineTo(0, 18);
            ctx.lineTo(14, 4); ctx.bezierCurveTo(26, -10, 12, -22, 0, -8); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath();
            ctx.ellipse(-6, -10, 4, 3, -0.5, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
    }

    // ===== СТОЛКНОВЕНИЯ =====
    function checkCollisions() {
        for (let bi = bullets.length - 1; bi >= 0; bi--) { const b = bullets[bi];
            for (let ei = enemies.length - 1; ei >= 0; ei--) { const e = enemies[ei]; if (!isOnScreen(e)) continue;
                if (dist(b.x, b.y, e.x, e.y) < e.w / 2 + 6) { bullets.splice(bi, 1); e.hp--; e.flash = 80; boom(b.x, b.y, 4, '#0ff'); playSynthHit();
                    if (e.hp <= 0) { const pts = e.boss ? 500 * wave : 100; score += pts; elScore.textContent = score; boom(e.x, e.y, e.boss ? 55 : 20, e.boss ? '#ff0' : '#f80'); addText(e.x, e.y, '+' + pts, e.boss ? '#ff0' : '#0ff');
                        if (e.boss) { bossAlive = false; doShake(16, 600); addText(W / 2, H / 2, 'ГАЛЮХА УНИЧТОЖЕНА!', '#0f0', 26, 0.008); playSound('bossKill'); } else playSound('kill'); enemies.splice(ei, 1); } break; } } }
        if (!invincible) { for (let ei = enemies.length - 1; ei >= 0; ei--) { const e = enemies[ei]; if (!isOnScreen(e)) continue;
            if (dist(player.x, player.y, e.x, e.y) < e.w / 2 + 16) { if (!e.boss) enemies.splice(ei, 1); boom(player.x, player.y, 22, '#f44'); playerHit(); break; } } }
    }

    // ===== УРОН / GAME OVER =====
    function playerHit() { if (invincible) return; lives--; elLives.textContent = lives; invincible = true; invTimer = CFG.invincTime; doShake(8, 250); playSound('playerHit'); if (lives <= 0) gameOver(); }
    function gameOver() { running = false; cancelAnimationFrame(animId); stopMusic(); setTimeout(() => playGameoverSound(), 100); const isNew = saveRecord(currentNick, score, wave); elFinalScore.textContent = score; elFinalWave.textContent = wave; elGameoverNick.textContent = currentNick; if (isNew) elNewRecord.classList.remove('hidden'); else elNewRecord.classList.add('hidden'); setTimeout(() => showScreen(overScreen), 600); }

    // ===== ТРЯСКА + ВОЛНЫ =====
    function doShake(a, d) { shakeAmt = a; shakeDur = d; }
    function updateShake(dt) { if (shakeDur > 0) { shakeDur -= dt; shakeX = (Math.random() - 0.5) * shakeAmt; shakeY = (Math.random() - 0.5) * shakeAmt; if (shakeDur <= 0) shakeX = shakeY = shakeAmt = 0; } }
    function startWave() { waveState = 'active'; const isBoss = wave % CFG.bossEvery === 0; if (isBoss) { toSpawn = 0; spawnEnemy(true); bossAlive = true; addText(W / 2, H / 2 - 30, '⚠ БОСС-ГАЛЮХА ⚠', '#ff0', 28, 0.008); playSound('bossWarn'); } else { toSpawn = CFG.enemyCount + wave * 2; spawnInterval = Math.max(350, CFG.spawnDelay - wave * 40); spawnTimer = 0; addText(W / 2, H / 2, 'ВОЛНА ' + wave, '#0ff', 32, 0.008); playSynthWave(); } elWave.textContent = wave; }
    function updateWave(dt) { if (waveState === 'active') { if (toSpawn > 0) { spawnTimer += dt; if (spawnTimer >= spawnInterval) { spawnTimer = 0; spawnEnemy(false); toSpawn--; } } if (toSpawn <= 0 && enemies.length === 0) { waveState = 'cooldown'; wavePauseTimer = 0; addText(W / 2, H / 2, '✔ ВОЛНА ПРОЙДЕНА!', '#0f0', 26, 0.008); playSynthWaveDone(); } } else { wavePauseTimer += dt; if (wavePauseTimer >= CFG.wavePause) { wave++; startWave(); } } }

    // ===== ГЛАВНЫЙ ЦИКЛ =====
    function loop(time) {
        if (!running) return; animId = requestAnimationFrame(loop);
        const dt = Math.min(time - lastTime, 50); lastTime = time;
        updateStars(); updatePlayer(dt); handleFiring(dt); updateBullets(); updateEnemies(dt);
        updateParticles(); updateTexts(); updateHearts(dt); checkCollisions(); updateWave(dt); updateShake(dt);
        ctx.save(); ctx.translate(shakeX, shakeY); ctx.fillStyle = '#050510'; ctx.fillRect(-10, -10, W + 20, H + 20);
        drawStars(); drawBullets(); drawEnemies(); drawHearts(); drawPlayer(); drawParticles(); drawTexts();
        ctx.restore();
    }

    // ===== СТАРТ =====
    function launchGame() {
        unlockAudio();
        setTimeout(() => { resize(); score = 0; lives = CFG.lives; wave = 1;
            elScore.textContent = '0'; elLives.textContent = lives; elWave.textContent = '1';
            bullets = []; enemies = []; particles = []; floatTexts = []; hearts = []; heartTimer = 0;
            invincible = false; invTimer = 0; bossAlive = false; shakeX = shakeY = shakeAmt = shakeDur = 0;
            fireTimer = 0; firing = false; pointerX = null; touchActive = false;
            initStars(); initPlayer(); showScreen(gameScreen); startMusic();
            running = true; lastTime = performance.now(); animId = requestAnimationFrame(loop); startWave();
        }, 200);
    }

    btnPlay.addEventListener('click', () => showNickModal());
    btnRestart.addEventListener('click', () => launchGame());
    btnMenu.addEventListener('click', () => { running = false; cancelAnimationFrame(animId); stopMusic(); showScreen(menuScreen); });

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

})();
