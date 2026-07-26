'use strict';

/**
 * ============================================================
 *  ROMÁRIO — Football Platform Game
 *  File: script.js
 *  Version: 1.0.0
 *  Purpose: Complete game logic, rendering, audio, physics, AI,
 *           collision detection, state management, and UI sync.
 * ============================================================
 */
(function() {

/* ============================================================
   CONFIGURATION
   ============================================================ */
const CFG = {
  CANVAS_W: 960,
  CANVAS_H: 540,
  LOGICAL_W: 960,
  LOGICAL_H: 540,
  GRAVITY: 0.55,
  MAX_FALL: 12,
  WORLD_W: 15000,
  WORLD_H: 1200,
  FLOOR_Y: 460,

  // Player physics
  PLAYER_W: 28,
  PLAYER_H: 48,
  PLAYER_CROUCH_H: 30,
  PLAYER_SPEED: 3.2,
  PLAYER_ACCEL: 0.45,
  PLAYER_FRICTION: 0.78,
  JUMP_FORCE: -11.5,
  DOUBLE_JUMP_FORCE: -10,
  SLIDE_SPEED: 5,
  SLIDE_DURATION: 28,
  INVULN_TIME: 90,
  CROUCH_SPEED_MULT: 0.5,

  // Controls
  KEYS: {
    LEFT: 'ArrowLeft', RIGHT: 'ArrowRight', UP: 'ArrowUp', DOWN: 'ArrowDown',
    JUMP: 'KeyA', SHOOT: 'KeyS', SLIDE: 'KeyD', ESCAPE: 'Escape', PAUSE: 'KeyP'
  },

  // Difficulty multipliers
  DIFFICULTY: {
    FACIL: {
      label: 'Fácil',
      enemySpeed: 0.75,
      enemyHealth: 0.7,
      enemyDamage: 1,
      bossHealth: 120,
      invulnTime: 120,
      coinHeartThreshold: 10,
      enemyAggression: 0.6,
      enemyProjectileSpeed: 0.8,
      bossPhase2Threshold: 0.5,
      bossAttackCooldown: 180
    },
    MEDIO: {
      label: 'Médio',
      enemySpeed: 1.0,
      enemyHealth: 1.0,
      enemyDamage: 1,
      bossHealth: 180,
      invulnTime: 75,
      coinHeartThreshold: 10,
      enemyAggression: 0.8,
      enemyProjectileSpeed: 1.0,
      bossPhase2Threshold: 0.4,
      bossAttackCooldown: 130
    },
    DIFICIL: {
      label: 'Difícil',
      enemySpeed: 1.3,
      enemyHealth: 1.3,
      enemyDamage: 1,
      bossHealth: 240,
      invulnTime: 50,
      coinHeartThreshold: 10,
      enemyAggression: 1.0,
      enemyProjectileSpeed: 1.3,
      bossPhase2Threshold: 0.3,
      bossAttackCooldown: 90
    }
  },

  // Game constants
  MAX_HEARTS: 3,
  STARTING_HEARTS: 3,
  STARTING_CONTINUES: 3,
  COIN_HEART_THRESHOLD: 10,
  TOTAL_COINS: 30,
  TOTAL_FIREBALLS: 2,
  TOTAL_CHECKPOINTS: 4,
  FIREBALL_SHOTS: 5,
  MAX_PROJECTILES: 8,
  MAX_PARTICLES: 80,
  MAX_ENEMIES_ACTIVE: 12,
  DT_CLAMP: 0.05,

  // Colors
  COLORS: {
    sky1: '#1a2a4a',
    sky2: '#0d1b30',
    ground: '#3a5a30',
    groundDark: '#2a4520',
    pavement: '#666',
    brick: '#8a4a30',
    grass: '#2d8a2d',
    grassLight: '#3aaa3a',
    crowd: '#444',
    coin: '#ffd700',
    coinDark: '#cc9900',
    fireball: '#ff4422',
    fireballDark: '#cc2200',
    player: '#ffcc00',
    playerDark: '#cc9900',
    playerShirt: '#ffffff',
    playerShorts: '#2244aa',
    enemySupporter: '#cc2222',
    enemyReferee: '#222222',
    bossCoach: '#442266',
    checkpoint: '#00ff88',
    wall: '#555',
    vehicle: '#4466aa',
    crate: '#886644'
  },

  // Zones
  ZONES: {
    STREET: { name: 'Rua do Bairro', xStart: 0, xEnd: 3500 },
    TRAINING: { name: 'Centro de Treinamento', xStart: 3500, xEnd: 7500 },
    STADIUM_ENTRANCE: { name: 'Entrada do Estádio', xStart: 7500, xEnd: 11500 },
    FIELD: { name: 'Campo de Futebol', xStart: 11500, xEnd: 15000 }
  },

  // Debug
  DEBUG: false
};

/* ============================================================
   GLOBAL STATE
   ============================================================ */
let game = null;
let canvas = null;
let ctx = null;
let audioCtx = null;
let animFrameId = null;
let lastTime = 0;
let running = false;

/* ============================================================
   DOM REFERENCES (populated in init)
   ============================================================ */
const DOM = {};

/* ============================================================
   UTILITY FUNCTIONS
   ============================================================ */
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function rng(min, max) { return Math.random() * (max - min) + min; }
function rngInt(min, max) { return Math.floor(rng(min, max + 1)); }
function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function circleAABB(cx, cy, cr, bx, by, bw, bh) {
  const closestX = clamp(cx, bx, bx + bw);
  const closestY = clamp(cy, by, by + bh);
  const dx = cx - closestX;
  const dy = cy - closestY;
  return (dx * dx + dy * dy) < (cr * cr);
}
function distance(a, b) {
  const dx = a.x - b.x; const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/* ============================================================
   INPUT MANAGER
   ============================================================ */
class InputManager {
  constructor() {
    this.keys = {};
    this.justPressed = {};
    this.prevKeys = {};
    this._boundKeyDown = this._onKeyDown.bind(this);
    this._boundKeyUp = this._onKeyUp.bind(this);
    this._boundBlur = this._onBlur.bind(this);
    this._boundVis = this._onVisibility.bind(this);
  }

  init() {
    document.addEventListener('keydown', this._boundKeyDown);
    document.addEventListener('keyup', this._boundKeyUp);
    window.addEventListener('blur', this._boundBlur);
    document.addEventListener('visibilitychange', this._boundVis);
  }

  destroy() {
    document.removeEventListener('keydown', this._boundKeyDown);
    document.removeEventListener('keyup', this._boundKeyUp);
    window.removeEventListener('blur', this._boundBlur);
    document.removeEventListener('visibilitychange', this._boundVis);
    this.keys = {};
    this.justPressed = {};
  }

  _onKeyDown(e) {
    const k = e.code;
    if (CFG.KEYS && Object.values(CFG.KEYS).includes(k)) {
      e.preventDefault();
    }
    if (!this.keys[k]) this.justPressed[k] = true;
    this.keys[k] = true;
  }

  _onKeyUp(e) {
    const k = e.code;
    if (CFG.KEYS && Object.values(CFG.KEYS).includes(k)) {
      e.preventDefault();
    }
    this.keys[k] = false;
  }

  _onBlur() {
    this.keys = {};
    this.justPressed = {};
  }

  _onVisibility() {
    if (document.hidden) {
      this.keys = {};
      this.justPressed = {};
    }
  }

  isDown(code) { return !!this.keys[code]; }
  wasPressed(code) { return !!this.justPressed[code]; }
  endFrame() { this.justPressed = {}; }
}

/* ============================================================
   AUDIO MANAGER
   ============================================================ */
class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicOsc = null;
    this.musicNodes = [];
    this.musicInterval = null;
    this.muted = false;
    this.volume = 0.5;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.3;
      this.musicGain.connect(this.masterGain);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.5;
      this.sfxGain.connect(this.masterGain);
      this.initialized = true;
    } catch(e) {
      console.warn('Web Audio API not available:', e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setVolume(v) {
    this.volume = clamp(v, 0, 1);
    if (this.masterGain) this.masterGain.gain.value = this.muted ? 0 : this.volume;
  }

  setMuted(m) {
    this.muted = m;
    if (this.masterGain) this.masterGain.gain.value = m ? 0 : this.volume;
  }

  // Play a simple tone
  _playTone(freq, dur, type, gainNode, dest) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.3, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    osc.connect(g);
    g.connect(dest || this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + dur);
  }

  playJump() { this._playTone(400, 0.15, 'square'); this._playTone(500, 0.1, 'square'); }
  playShoot() { this._playTone(300, 0.1, 'sawtooth'); }
  playHit() { this._playTone(200, 0.2, 'square'); }
  playCoin() { this._playTone(880, 0.08, 'sine'); setTimeout(() => this._playTone(1100, 0.08, 'sine'), 60); }
  playCheckpoint() { this._playTone(523, 0.15, 'sine'); setTimeout(() => this._playTone(659, 0.15, 'sine'), 100); setTimeout(() => this._playTone(784, 0.2, 'sine'), 200); }
  playHurt() { this._playTone(150, 0.3, 'sawtooth'); this._playTone(100, 0.4, 'square'); }
  playExplosion() { this._playTone(80, 0.4, 'sawtooth'); this._playTone(60, 0.5, 'square'); }
  playBossHit() { this._playTone(250, 0.15, 'square'); this._playTone(300, 0.1, 'sawtooth'); }
  playVictory() {
    const notes = [523, 659, 784, 1047, 784, 1047];
    notes.forEach((n, i) => {
      setTimeout(() => this._playTone(n, 0.3, 'sine', this.musicGain), i * 200);
    });
  }
  playGameOver() {
    const notes = [400, 350, 300, 200];
    notes.forEach((n, i) => {
      setTimeout(() => this._playTone(n, 0.3, 'sawtooth'), i * 250);
    });
  }

  // Simple MIDI-like background music
  startMusic(zone) {
    this.stopMusic();
    if (!this.ctx) return;
    const bpm = zone === 'boss' ? 160 : zone === 'menu' ? 100 : 130;
    const beatMs = 60000 / bpm;
    const patterns = {
      menu: [262, 330, 392, 330, 262, 196, 262, 330],
      street: [330, 392, 440, 392, 330, 262, 330, 392],
      training: [392, 440, 523, 440, 392, 330, 392, 440],
      stadium: [440, 523, 587, 523, 440, 392, 440, 523],
      field: [523, 587, 659, 587, 523, 440, 523, 587],
      boss: [262, 311, 262, 349, 311, 262, 392, 311],
      victory: [523, 659, 784, 1047, 784, 659, 523, 659]
    };
    const pattern = patterns[zone] || patterns.street;
    let idx = 0;
    this.musicInterval = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const note = pattern[idx % pattern.length];
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = idx % 2 === 0 ? 'square' : 'triangle';
      osc.frequency.value = note;
      g.gain.setValueAtTime(0.15, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
      osc.connect(g);
      g.connect(this.musicGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.25);

      // Bass note every 2 beats
      if (idx % 2 === 0) {
        const bass = this.ctx.createOscillator();
        const bg = this.ctx.createGain();
        bass.type = 'sawtooth';
        bass.frequency.value = note / 2;
        bg.gain.setValueAtTime(0.08, this.ctx.currentTime);
        bg.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
        bass.connect(bg);
        bg.connect(this.musicGain);
        bass.start();
        bass.stop(this.ctx.currentTime + 0.3);
      }
      idx++;
    }, beatMs);
  }

  stopMusic() {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }

  destroy() {
    this.stopMusic();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
    }
  }
}

/* ============================================================
   CAMERA
   ============================================================ */
class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.deadZone = 80;
    this.smoothing = 0.08;
    this.locked = false;
    this.lockX = 0;
  }

  update(playerX, playerY) {
    if (this.locked) {
      this.x = this.lockX;
      this.y = 0;
      return;
    }
    this.targetX = playerX - CFG.CANVAS_W / 2;
    this.targetX = clamp(this.targetX, 0, CFG.WORLD_W - CFG.CANVAS_W);
    this.x = lerp(this.x, this.targetX, this.smoothing);
    this.y = 0;
  }

  lock(x) {
    this.locked = true;
    this.lockX = x;
  }

  unlock() {
    this.locked = false;
  }

  worldToScreen(wx, wy) {
    return { x: wx - this.x, y: wy - this.y };
  }
}

/* ============================================================
   PARTICLE SYSTEM
   ============================================================ */
class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  emit(x, y, count, color, speed, life) {
    for (let i = 0; i < count && this.particles.length < CFG.MAX_PARTICLES; i++) {
      this.particles.push({
        x, y,
        vx: rng(-speed, speed),
        vy: rng(-speed * 1.5, speed * 0.5),
        life: life || 30,
        maxLife: life || 30,
        color: color,
        size: rng(2, 5)
      });
    }
  }

  emitExplosion(x, y) {
    this.emit(x, y, 15, '#ff6622', 4, 25);
    this.emit(x, y, 8, '#ffcc00', 3, 20);
  }

  emitCoin(x, y) {
    this.emit(x, y, 6, '#ffd700', 2, 20);
  }

  emitHit(x, y) {
    this.emit(x, y, 8, '#ff4444', 3, 18);
  }

  emitCheckpoint(x, y) {
    this.emit(x, y, 12, '#00ff88', 2.5, 35);
  }

  emitVictory(x, y) {
    for (let i = 0; i < 20; i++) {
      const colors = ['#ffd700', '#ff6622', '#00ff88', '#4488ff', '#ff44aa'];
      this.emit(x + rng(-100, 100), y, 3, colors[rngInt(0, 4)], 3, 40);
    }
  }

  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1;
      p.life--;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  render(ctx, cam) {
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      const s = cam.worldToScreen(p.x, p.y);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.floor(s.x), Math.floor(s.y), Math.ceil(p.size), Math.ceil(p.size));
    }
    ctx.globalAlpha = 1;
  }

  clear() {
    this.particles = [];
  }
}

/* ============================================================
   ENTITY BASE
   ============================================================ */
class Entity {
  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.vx = 0; this.vy = 0;
    this.alive = true;
    this.hitbox = { x: x, y: y, w: w, h: h };
  }
  updateHitbox() {
    this.hitbox.x = this.x;
    this.hitbox.y = this.y;
    this.hitbox.w = this.w;
    this.hitbox.h = this.h;
  }
}

/* ============================================================
   PLATFORM
   ============================================================ */
class Platform extends Entity {
  constructor(x, y, w, h, type) {
    super(x, y, w, h);
    this.type = type || 'solid'; // solid, oneWay
    this.color = CFG.COLORS.ground;
  }
}

class MovingPlatform extends Entity {
  constructor(x, y, w, h, moveX, moveY, speed) {
    super(x, y, w, h);
    this.startX = x; this.startY = y;
    this.moveX = moveX || 0; this.moveY = moveY || 0;
    this.speed = speed || 1;
    this.phase = rng(0, Math.PI * 2);
    this.type = 'solid';
  }
  update() {
    this.phase += 0.02 * this.speed;
    this.x = this.startX + Math.sin(this.phase) * this.moveX;
    this.y = this.startY + Math.sin(this.phase) * this.moveY;
    this.updateHitbox();
  }
}

/* ============================================================
   HAZARD
   ============================================================ */
class Hazard extends Entity {
  constructor(x, y, w, h) {
    super(x, y, w, h);
    this.damage = 1;
  }
}

/* ============================================================
   COLLECTIBLE
   ============================================================ */
class Collectible extends Entity {
  constructor(x, y, type) {
    super(x, y, 16, 16);
    this.type = type; // 'coin' or 'fireball'
    this.collected = false;
    this.bobPhase = rng(0, Math.PI * 2);
  }
  update() {
    this.bobPhase += 0.05;
  }
}

/* ============================================================
   CHECKPOINT
   ============================================================ */
class Checkpoint extends Entity {
  constructor(x, y, index) {
    super(x, y, 32, 64);
    this.index = index;
    this.activated = false;
    this.flagPhase = 0;
  }
  update() {
    this.flagPhase += 0.08;
  }
}

/* ============================================================
   PROJECTILE
   ============================================================ */
class Projectile extends Entity {
  constructor(x, y, vx, vy, type, owner) {
    super(x, y, 12, 12);
    this.vx = vx; this.vy = vy;
    this.type = type; // 'ball', 'low', 'high', 'fireball', 'enemy', 'boss'
    this.owner = owner;
    this.life = 180;
    this.damage = 1;
    this.gravity = type === 'high' ? 0.35 : 0;
    this.bounce = type === 'low' ? 1 : 0;
    this.radius = type === 'fireball' ? 24 : 6;
    this.exploded = false;
    this.hitEnemies = new Set();
    this.hitBoss = false;
  }
  update(platforms) {
    this.vy += this.gravity;
    this.x += this.vx;
    this.y += this.vy;
    this.life--;

    // Ground bounce for low shots
    if (this.bounce > 0 && this.y + this.h >= CFG.FLOOR_Y) {
      this.y = CFG.FLOOR_Y - this.h;
      this.vy = -this.vy * 0.5;
      this.bounce -= 0.5;
      if (Math.abs(this.vy) < 0.5) this.vy = 0;
    }

    // World bounds
    if (this.x < 0 || this.x > CFG.WORLD_W || this.y > CFG.WORLD_H || this.life <= 0) {
      this.alive = false;
    }

    // Platform collision
    for (const p of platforms) {
      if (aabb(this, p)) {
        if (this.bounce > 0) {
          this.vy = -Math.abs(this.vy) * 0.5;
          this.y = p.y - this.h;
          this.bounce -= 0.5;
        } else {
          this.alive = false;
        }
        break;
      }
    }

    this.updateHitbox();
  }
}

/* ============================================================
   PLAYER (Romário)
   ============================================================ */
class Player extends Entity {
  constructor(x, y) {
    super(x, y, CFG.PLAYER_W, CFG.PLAYER_H);
    this.maxHealth = CFG.MAX_HEARTS;
    this.health = CFG.STARTING_HEARTS;
    this.facing = 1; // 1 = right, -1 = left
    this.onGround = false;
    this.crouching = false;
    this.sliding = false;
    this.slideTimer = 0;
    this.invuln = 0;
    this.state = 'idle'; // idle, run, jump, fall, crouch, slide, kick, hurt, defeat
    this.animTimer = 0;
    this.animFrame = 0;
    this.kickCooldown = 0;
    this.slideCooldown = 0;
    this.bicycleKick = false;
    this.bicycleTimer = 0;
    this.bicyclePhase = 0;
    this.inBicycle = false;
    this.doubleJump = false;
    this.hasJumped = false;
    this.checkpointIndex = 0;
    this.coinsCollected = 0;
    this.score = 0;
    this.enemiesDefeated = 0;
    this.startTime = 0;
    this.completionTime = 0;
    this.fireballAmmo = 0;
    this.shootCooldown = 0;
    this.lowShootCooldown = 0;
    this.highShootCooldown = 0;
    this.balaozinhoCooldown = 0;
    this.bicycleCooldown = 0;
  }

  takeDamage(amount, knockbackDir, knockbackForce) {
    if (this.invuln > 0) return false;
    this.health = Math.max(0, this.health - amount);
    this.invuln = CFG.INVULN_TIME;
    this.state = 'hurt';
    this.vx = knockbackDir * knockbackForce;
    this.vy = -4;
    return true;
  }

  heal() {
    this.health = Math.min(this.maxHealth, this.health + 1);
  }

  respawn(x, y) {
    this.x = x;
    this.y = y - CFG.PLAYER_H;
    this.vx = 0;
    this.vy = 0;
    this.health = this.maxHealth;
    this.invuln = 120;
    this.state = 'idle';
    this.crouching = false;
    this.sliding = false;
    this.slideTimer = 0;
    this.inBicycle = false;
  }

  update(input) {
    // Cooldowns
    if (this.kickCooldown > 0) this.kickCooldown--;
    if (this.slideCooldown > 0) this.slideCooldown--;
    if (this.shootCooldown > 0) this.shootCooldown--;
    if (this.lowShootCooldown > 0) this.lowShootCooldown--;
    if (this.highShootCooldown > 0) this.highShootCooldown--;
    if (this.balaozinhoCooldown > 0) this.balaozinhoCooldown--;
    if (this.bicycleCooldown > 0) this.bicycleCooldown--;
    if (this.invuln > 0) this.invuln--;
    this.animTimer++;

    // Bicycle kick state
    if (this.inBicycle) {
      this.bicycleTimer--;
      this.bicyclePhase += 0.15;
      if (this.bicycleTimer <= 0) {
        this.inBicycle = false;
        this.bicyclePhase = 0;
      }
      return;
    }

    // Slide state
    if (this.sliding) {
      this.slideTimer--;
      this.vx = this.facing * CFG.SLIDE_SPEED;
      if (this.slideTimer <= 0) {
        this.sliding = false;
        this.h = CFG.PLAYER_H;
      }
      this.vy += CFG.GRAVITY;
      if (this.vy > CFG.MAX_FALL) this.vy = CFG.MAX_FALL;
      this.x += this.vx;
      this.y += this.vy;
      this.updateHitbox();
      return;
    }

    // Input handling
    const moveLeft = input.isDown(CFG.KEYS.LEFT);
    const moveRight = input.isDown(CFG.KEYS.RIGHT);
    const jumpPressed = input.wasPressed(CFG.KEYS.JUMP);
    const shootPressed = input.wasPressed(CFG.KEYS.SHOOT);
    const slidePressed = input.wasPressed(CFG.KEYS.SLIDE);
    const crouchInput = input.isDown(CFG.KEYS.DOWN);

    // Crouching
    this.crouching = crouchInput && this.onGround && !this.sliding;
    if (this.crouching) {
      this.h = CFG.PLAYER_CROUCH_H;
      this.state = 'crouch';
    } else if (this.onGround) {
      this.h = CFG.PLAYER_H;
    }

    // Movement
    let moveX = 0;
    if (moveLeft) moveX -= 1;
    if (moveRight) moveX += 1;

    if (moveX !== 0) {
      this.facing = moveX;
      this.vx += moveX * CFG.PLAYER_ACCEL * (this.crouching ? CFG.CROUCH_SPEED_MULT : 1);
      if (this.onGround) this.state = 'run';
    } else {
      this.vx *= CFG.PLAYER_FRICTION;
      if (Math.abs(this.vx) < 0.1) {
        this.vx = 0;
        if (this.onGround && !this.crouching) this.state = 'idle';
      }
    }

    // Speed cap
    const maxSpeed = this.crouching ? CFG.PLAYER_SPEED * CFG.CROUCH_SPEED_MULT : CFG.PLAYER_SPEED;
    this.vx = clamp(this.vx, -maxSpeed, maxSpeed);

    // Jumping
    if (jumpPressed) {
      if (this.onGround) {
        this.vy = CFG.JUMP_FORCE;
        this.onGround = false;
        this.hasJumped = true;
        this.state = 'jump';
      } else if (this.doubleJump) {
        this.vy = CFG.DOUBLE_JUMP_FORCE;
        this.doubleJump = false;
        this.hasJumped = true;
        this.state = 'jump';
      }
    }

    // Bicycle kick (A + S in air)
    if (jumpPressed && shootPressed && !this.onGround && this.bicycleCooldown <= 0) {
      this.inBicycle = true;
      this.bicycleTimer = 25;
      this.bicyclePhase = 0;
      this.bicycleCooldown = 90;
      this.vy = -3;
      this.vx = this.facing * 4;
      this.state = 'bicycle';
    }

    // Shooting
    if (shootPressed && this.kickCooldown <= 0) {
      if (input.isDown(CFG.KEYS.UP)) {
        // High shot
        this.kickCooldown = 30;
        this.highShootCooldown = 40;
        this.state = 'kick';
      } else if (crouchInput) {
        // Low shot
        this.kickCooldown = 25;
        this.lowShootCooldown = 35;
        this.state = 'kick';
      } else if (input.isDown(CFG.KEYS.UP) && input.wasPressed(CFG.KEYS.UP)) {
        // Balãozinho
        this.kickCooldown = 35;
        this.balaozinhoCooldown = 50;
        this.state = 'kick';
      } else {
        // Standard shot
        this.kickCooldown = 20;
        this.shootCooldown = 25;
        this.state = 'kick';
      }
    }

    // Sliding
    if (slidePressed && this.onGround && this.slideCooldown <= 0 && !this.crouching) {
      this.sliding = true;
      this.slideTimer = CFG.SLIDE_DURATION;
      this.slideCooldown = 45;
      this.h = CFG.PLAYER_CROUCH_H;
      this.state = 'slide';
    }

    // Gravity
    this.vy += CFG.GRAVITY;
    if (this.vy > CFG.MAX_FALL) this.vy = CFG.MAX_FALL;

    // Apply velocity
    this.x += this.vx;
    this.y += this.vy;

    // Ground check
    if (this.y + this.h >= CFG.FLOOR_Y) {
      this.y = CFG.FLOOR_Y - this.h;
      this.vy = 0;
      this.onGround = true;
      this.doubleJump = true;
      this.hasJumped = false;
    } else {
      this.onGround = false;
      if (this.vy < 0) this.state = 'jump';
      else if (this.vy > 2) this.state = 'fall';
    }

    // World bounds
    this.x = clamp(this.x, 0, CFG.WORLD_W - this.w);

    this.updateHitbox();
  }
}

/* ============================================================
   ENEMY: RIVAL SUPPORTER
   ============================================================ */
class RivalSupporter extends Entity {
  constructor(x, y) {
    super(x, y, 28, 44);
    this.health = 2;
    this.maxHealth = 2;
    this.state = 'patrol';
    this.facing = Math.random() > 0.5 ? 1 : -1;
    this.patrolStart = x - 100;
    this.patrolEnd = x + 100;
    this.speed = 1.2;
    this.alertRange = 200;
    this.attackCooldown = 0;
    this.attackTimer = 0;
    this.hurtTimer = 0;
    this.hitEnemies = new Set();
    this.difficultyScale = 1;
    this.invuln = 0;
  }

  scaleDifficulty(diffCfg) {
    this.speed *= diffCfg.enemySpeed;
    this.health = Math.ceil(this.maxHealth * diffCfg.enemyHealth);
    this.maxHealth = this.health;
  }

  update(player, game) {
    if (this.invuln > 0) this.invuln--;
    if (this.hurtTimer > 0) this.hurtTimer--;

    const dist = distance(this, player);

    switch (this.state) {
      case 'patrol':
        this.x += this.facing * this.speed * 0.5;
        if (this.x <= this.patrolStart || this.x >= this.patrolEnd) {
          this.facing *= -1;
        }
        if (dist < this.alertRange) {
          this.state = 'chase';
        }
        break;
      case 'chase':
        if (dist > 400) {
          this.state = 'patrol';
          break;
        }
        const dir = player.x > this.x ? 1 : -1;
        this.facing = dir;
        this.x += dir * this.speed;
        if (dist < 50 && this.attackCooldown <= 0) {
          this.state = 'attack';
          this.attackTimer = 30;
        }
        break;
      case 'attack':
        this.attackTimer--;
        if (this.attackTimer <= 0) {
          // Throw object
          if (this.attackCooldown <= 0) {
            const dir = player.x > this.x ? 1 : -1;
            game.addProjectile(new Projectile(
              this.x + this.w / 2, this.y,
              dir * 3, -2, 'enemy', 'enemy'
            ));
            this.attackCooldown = 90;
          }
          this.state = 'cooldown';
          this.attackCooldown = 60;
        }
        break;
      case 'cooldown':
        this.attackCooldown--;
        if (this.attackCooldown <= 0) {
          this.state = dist < this.alertRange ? 'chase' : 'patrol';
        }
        break;
      case 'hurt':
        this.hurtTimer--;
        if (this.hurtTimer <= 0) {
          this.state = 'patrol';
        }
        break;
    }

    if (this.attackCooldown > 0) this.attackCooldown--;

    // Keep on ground
    if (this.y + this.h < CFG.FLOOR_Y) {
      this.vy = (this.vy || 0) + CFG.GRAVITY;
      this.y += this.vy;
      if (this.y + this.h >= CFG.FLOOR_Y) {
        this.y = CFG.FLOOR_Y - this.h;
        this.vy = 0;
      }
    }

    this.x = clamp(this.x, 0, CFG.WORLD_W - this.w);
    this.updateHitbox();
  }

  takeDamage(amount) {
    if (this.invuln > 0) return false;
    this.health -= amount;
    this.invuln = 15;
    this.hurtTimer = 20;
    this.state = 'hurt';
    this.vx = -this.facing * 3;
    if (this.health <= 0) {
      this.alive = false;
      return true;
    }
    return false;
  }
}

/* ============================================================
   ENEMY: REFEREE
   ============================================================ */
class RefereeEnemy extends Entity {
  constructor(x, y) {
    super(x, y, 28, 48);
    this.health = 3;
    this.maxHealth = 3;
    this.state = 'patrol';
    this.facing = Math.random() > 0.5 ? 1 : -1;
    this.patrolStart = x - 120;
    this.patrolEnd = x + 120;
    this.speed = 1.0;
    this.alertRange = 250;
    this.attackCooldown = 0;
    this.attackTimer = 0;
    this.hurtTimer = 0;
    this.invuln = 0;
    this.whistleTimer = 0;
    this.playerSlowed = false;
  }

  scaleDifficulty(diffCfg) {
    this.speed *= diffCfg.enemySpeed;
    this.health = Math.ceil(this.maxHealth * diffCfg.enemyHealth);
    this.maxHealth = this.health;
  }

  update(player, game) {
    if (this.invuln > 0) this.invuln--;
    if (this.hurtTimer > 0) this.hurtTimer--;
    if (this.whistleTimer > 0) {
      this.whistleTimer--;
      if (this.whistleTimer <= 0) {
        this.playerSlowed = false;
      }
    }

    const dist = distance(this, player);

    switch (this.state) {
      case 'patrol':
        this.x += this.facing * this.speed * 0.4;
        if (this.x <= this.patrolStart || this.x >= this.patrolEnd) {
          this.facing *= -1;
        }
        if (dist < this.alertRange) {
          this.state = 'chase';
        }
        break;
      case 'chase':
        if (dist > 450) {
          this.state = 'patrol';
          break;
        }
        const dir = player.x > this.x ? 1 : -1;
        this.facing = dir;
        this.x += dir * this.speed * 0.7;
        if (dist < 80 && this.attackCooldown <= 0) {
          this.state = 'attack';
          this.attackTimer = 25;
        }
        break;
      case 'attack':
        this.attackTimer--;
        if (this.attackTimer <= 0) {
          // Blow whistle (slow player briefly)
          this.playerSlowed = true;
          this.whistleTimer = 120;
          // Throw card projectile
          const dir = player.x > this.x ? 1 : -1;
          game.addProjectile(new Projectile(
            this.x + this.w / 2, this.y + 10,
            dir * 2.5, -1, 'enemy', 'enemy'
          ));
          this.attackCooldown = 120;
          this.state = 'cooldown';
        }
        break;
      case 'cooldown':
        this.attackCooldown--;
        if (this.attackCooldown <= 0) {
          this.state = dist < this.alertRange ? 'chase' : 'patrol';
        }
        break;
      case 'hurt':
        this.hurtTimer--;
        if (this.hurtTimer <= 0) {
          this.state = 'patrol';
        }
        break;
    }

    if (this.attackCooldown > 0) this.attackCooldown--;

    // Gravity
    if (this.y + this.h < CFG.FLOOR_Y) {
      this.vy = (this.vy || 0) + CFG.GRAVITY;
      this.y += this.vy;
      if (this.y + this.h >= CFG.FLOOR_Y) {
        this.y = CFG.FLOOR_Y - this.h;
        this.vy = 0;
      }
    }

    this.x = clamp(this.x, 0, CFG.WORLD_W - this.w);
    this.updateHitbox();
  }

  takeDamage(amount) {
    if (this.invuln > 0) return false;
    this.health -= amount;
    this.invuln = 15;
    this.hurtTimer = 20;
    this.state = 'hurt';
    if (this.health <= 0) {
      this.alive = false;
      return true;
    }
    return false;
  }
}

/* ============================================================
   BOSS: RIVAL COACH
   ============================================================ */
class BossCoach extends Entity {
  constructor(x, y) {
    super(x, y, 64, 96);
    this.health = 180;
    this.maxHealth = 180;
    this.state = 'idle';
    this.facing = -1;
    this.phase = 1;
    this.attackPattern = 0;
    this.attackTimer = 0;
    this.windUp = 0;
    this.cooldown = 0;
    this.chargeDir = 0;
    this.chargeTimer = 0;
    this.hitInvuln = 0;
    this.defeated = false;
    this.arenaLeft = 0;
    this.arenaRight = CFG.WORLD_W;
    this.startX = x;
    this.startY = y;
    this.introTimer = 0;
    this.enraged = false;
  }

  scaleDifficulty(diffCfg) {
    this.health = diffCfg.bossHealth;
    this.maxHealth = this.health;
  }

  update(player, game) {
    if (this.defeated) return;
    if (this.hitInvuln > 0) this.hitInvuln--;
    if (this.cooldown > 0) this.cooldown--;

    // Phase transition
    const healthPercent = this.health / this.maxHealth;
    if (healthPercent < 0.4 && this.phase === 1) {
      this.phase = 2;
      this.enraged = true;
    }

    // Arena bounds
    this.x = clamp(this.x, this.arenaLeft, this.arenaRight - this.w);

    switch (this.state) {
      case 'intro':
        this.introTimer--;
        if (this.introTimer <= 0) {
          this.state = 'attack';
        }
        break;
      case 'attack':
        if (this.cooldown <= 0) {
          this.selectPattern(player, game);
        }
        this.attackTimer--;
        if (this.attackTimer <= 0) {
          this.state = 'cooldown';
          this.cooldown = 60;
        }
        break;
      case 'cooldown':
        this.cooldown--;
        if (this.cooldown <= 0) {
          this.state = 'attack';
        }
        break;
      case 'hurt':
        this.attackTimer--;
        if (this.attackTimer <= 0) {
          this.state = 'attack';
        }
        break;
      case 'charge':
        this.x += this.chargeDir * 4;
        this.chargeTimer--;
        if (this.chargeTimer <= 0) {
          this.state = 'attack';
          this.cooldown = 40;
        }
        break;
    }

    // Keep boss on ground
    if (this.y + this.h < CFG.FLOOR_Y) {
      this.vy = (this.vy || 0) + CFG.GRAVITY;
      this.y += this.vy;
      if (this.y + this.h >= CFG.FLOOR_Y) {
        this.y = CFG.FLOOR_Y - this.h;
        this.vy = 0;
      }
    }

    this.updateHitbox();
  }

  selectPattern(player, game) {
    const patterns = ['straight', 'highArc', 'bounce', 'volley', 'charge', 'shockwave'];
    const idx = this.attackPattern % patterns.length;
    this.attackPattern++;
    const pattern = patterns[idx];
    const dir = player.x > this.x ? 1 : -1;
    this.facing = dir;

    switch (pattern) {
      case 'straight':
        this.state = 'attack';
        this.attackTimer = 20;
        // Straight flaming ball
        game.addProjectile(new Projectile(
          this.x + this.w / 2, this.y + 30,
          dir * 5, 0, 'boss', 'boss'
        ));
        break;
      case 'highArc':
        this.state = 'attack';
        this.attackTimer = 30;
        game.addProjectile(new Projectile(
          this.x + this.w / 2, this.y + 20,
          dir * 3, -8, 'boss', 'boss'
        ));
        break;
      case 'bounce':
        this.state = 'attack';
        this.attackTimer = 25;
        const p = new Projectile(
          this.x + this.w / 2, this.y + 30,
          dir * 4, -3, 'boss', 'boss'
        );
        p.bounce = 3;
        p.gravity = 0.4;
        game.addProjectile(p);
        break;
      case 'volley':
        this.state = 'attack';
        this.attackTimer = 40;
        for (let i = 0; i < 3; i++) {
          setTimeout(() => {
            game.addProjectile(new Projectile(
              this.x + this.w / 2, this.y + 20,
              dir * (4 + i), -5 + i * 2, 'boss', 'boss'
            ));
          }, i * 150);
        }
        break;
      case 'charge':
        this.state = 'charge';
        this.chargeDir = dir;
        this.chargeTimer = 40;
        break;
      case 'shockwave':
        this.state = 'attack';
        this.attackTimer = 25;
        // Ground shockwave - create hazard
        const sw = new Hazard(this.x + this.w / 2 - 80, CFG.FLOOR_Y - 10, 160, 10);
        game.addHazard(sw);
        setTimeout(() => {
          game.removeHazard(sw);
        }, 800);
        break;
    }
  }

  takeDamage(amount) {
    if (this.hitInvuln > 0 || this.defeated) return false;
    this.health -= amount;
    this.hitInvuln = 30;
    this.state = 'hurt';
    this.attackTimer = 20;
    if (this.health <= 0) {
      this.health = 0;
      this.defeated = true;
      this.alive = false;
      return true;
    }
    return false;
  }

  getHealthPercent() {
    return clamp(this.health / this.maxHealth, 0, 1);
  }
}

/* ============================================================
   COLLISION SYSTEM
   ============================================================ */
class CollisionSystem {
  static resolvePlayerPlatforms(player, platforms, movingPlatforms) {
    player.onGround = false;
    const allPlatforms = [...platforms, ...movingPlatforms];
    for (const p of allPlatforms) {
      if (aabb(player, p)) {
        // Check if landing on top
        const prevBottom = player.y + player.h - player.vy;
        if (prevBottom <= p.y + 4 && player.vy >= 0) {
          player.y = p.y - player.h;
          player.vy = 0;
          player.onGround = true;
          player.doubleJump = true;
        } else if (player.vy < 0 && player.y > p.y) {
          // Hit from below
          player.y = p.y + p.h;
          player.vy = 0;
        } else {
          // Side collision
          if (player.vx > 0) {
            player.x = p.x - player.w;
          } else if (player.vx < 0) {
            player.x = p.x + p.w;
          }
          player.vx = 0;
        }
      }
    }
  }

  static checkPlayerEnemies(player, enemies, game) {
    if (player.invuln > 0) return;
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      if (aabb(player, enemy)) {
        // Check if player has active attack
        if (game.playerHasAttackHitbox()) {
          const killed = enemy.takeDamage(1);
          if (killed) {
            player.score += 100;
            player.enemiesDefeated++;
            game.particles.emitHit(enemy.x + enemy.w / 2, enemy.y);
          }
        } else {
          const dir = player.x < enemy.x ? -1 : 1;
          if (player.takeDamage(1, dir, 5)) {
            game.onPlayerHit();
          }
        }
      }
    }
  }

  static checkProjectilesEnemies(projectiles, enemies, player, game) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const proj = projectiles[i];
      if (proj.owner === 'enemy' || proj.owner === 'boss') continue;
      for (const enemy of enemies) {
        if (!enemy.alive) continue;
        if (proj.hitEnemies.has(enemy)) continue;
        // Check collision
        if (circleAABB(proj.x + proj.w / 2, proj.y + proj.h / 2, proj.radius,
            enemy.x, enemy.y, enemy.w, enemy.h)) {
          if (proj.type === 'fireball') {
            // Explosion damage
            game.particles.emitExplosion(proj.x, proj.y);
            game.audio.playExplosion();
            // Damage all enemies in radius
            for (const e of enemies) {
              if (!e.alive) continue;
              const d = Math.sqrt((e.x + e.w / 2 - proj.x) ** 2 + (e.y + e.h / 2 - proj.y) ** 2);
              if (d < 80) {
                const killed = e.takeDamage(3);
                if (killed) {
                  player.score += 100;
                  player.enemiesDefeated++;
                }
              }
            }
            proj.alive = false;
          } else {
            const killed = enemy.takeDamage(proj.damage);
            if (killed) {
              player.score += 100;
              player.enemiesDefeated++;
              game.particles.emitHit(enemy.x + enemy.w / 2, enemy.y);
            }
            proj.alive = false;
          }
          proj.hitEnemies.add(enemy);
          break;
        }
      }
    }
  }

  static checkProjectilesBoss(projectiles, boss, player, game) {
    if (!boss || boss.defeated) return;
    if (boss.hitInvuln > 0) return;
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const proj = projectiles[i];
      if (proj.owner === 'enemy' || proj.owner === 'boss') continue;
      if (proj.hitBoss) continue;
      if (circleAABB(proj.x + proj.w / 2, proj.y + proj.h / 2, proj.radius,
          boss.x, boss.y, boss.w, boss.h)) {
        let dmg = proj.type === 'fireball' ? 5 : proj.damage;
        if (proj.type === 'high') dmg = 2;
        const killed = boss.takeDamage(dmg);
        if (killed) {
          player.score += 1000;
          game.onBossDefeated();
        } else {
          game.audio.playBossHit();
          game.particles.emitHit(boss.x + boss.w / 2, boss.y + boss.h / 3);
        }
        proj.alive = false;
        proj.hitBoss = true;
        break;
      }
    }
  }

  static checkEnemyProjectilesPlayer(projectiles, player, game) {
    if (player.invuln > 0) return;
    for (const proj of projectiles) {
      if (proj.owner !== 'enemy' && proj.owner !== 'boss') continue;
      if (circleAABB(proj.x + proj.w / 2, proj.y + proj.h / 2, proj.radius,
          player.x, player.y, player.w, player.h)) {
        const dir = proj.vx > 0 ? 1 : -1;
        if (player.takeDamage(1, dir, 4)) {
          game.onPlayerHit();
        }
        proj.alive = false;
      }
    }
  }

  static checkCollectibles(player, collectibles, game) {
    for (const c of collectibles) {
      if (c.collected || !c.alive) continue;
      if (aabb(player, c)) {
        c.collected = true;
        c.alive = false;
        if (c.type === 'coin') {
          player.coinsCollected++;
          player.score += 10;
          game.audio.playCoin();
          game.particles.emitCoin(c.x, c.y);
          // Every 10 coins = 1 heart
          if (player.coinsCollected % CFG.COIN_HEART_THRESHOLD === 0) {
            if (player.health < player.maxHealth) {
              player.heal();
              game.showToast('+1 Vida!');
            } else {
              player.score += 50;
              game.showToast('+50 Pontos!');
            }
          }
        } else if (c.type === 'fireball') {
          player.fireballAmmo += CFG.FIREBALL_SHOTS;
          game.audio.playCheckpoint();
          game.showToast('+5 Bola de Fogo!');
        }
      }
    }
  }

  static checkCheckpoints(player, checkpoints, game) {
    for (const cp of checkpoints) {
      if (cp.activated) continue;
      if (aabb(player, cp)) {
        cp.activated = true;
        player.checkpointIndex = cp.index;
        game.audio.playCheckpoint();
        game.particles.emitCheckpoint(cp.x + cp.w / 2, cp.y);
        game.showCheckpointNotification(cp.index + 1);
      }
    }
  }

  static checkHazards(player, hazards, game) {
    if (player.invuln > 0) return;
    for (const h of hazards) {
      if (aabb(player, h)) {
        const dir = player.vx > 0 ? 1 : -1;
        if (player.takeDamage(1, dir, 3)) {
          game.onPlayerHit();
        }
      }
    }
  }
}

/* ============================================================
   CANVAS RENDERER
   ============================================================ */
class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
  }

  clear() {
    this.ctx.fillStyle = CFG.COLORS.sky1;
    this.ctx.fillRect(0, 0, CFG.CANVAS_W, CFG.CANVAS_H);
  }

  drawSky(cam) {
    const ctx = this.ctx;
    // Gradient sky
    const grad = ctx.createLinearGradient(0, 0, 0, CFG.FLOOR_Y);
    grad.addColorStop(0, '#0a1530');
    grad.addColorStop(0.5, '#1a2a50');
    grad.addColorStop(1, '#2a3a60');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CFG.CANVAS_W, CFG.FLOOR_Y);

    // Stars
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 30; i++) {
      const sx = ((i * 137 + 50) % CFG.CANVAS_W);
      const sy = ((i * 89 + 20) % (CFG.FLOOR_Y - 50));
      ctx.globalAlpha = 0.3 + Math.sin(Date.now() * 0.001 + i) * 0.2;
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  drawZoneBackground(cam, zone) {
    const ctx = this.ctx;
    const screenX = -cam.x;

    switch (zone) {
      case 'STREET':
        // Pavement
        ctx.fillStyle = CFG.COLORS.pavement;
        ctx.fillRect(screenX, CFG.FLOOR_Y - 20, CFG.WORLD_W, 20);
        // Buildings
        ctx.fillStyle = '#554433';
        for (let bx = 0; bx < CFG.WORLD_W; bx += 200) {
          const bw = 80 + (bx % 60);
          const bh = 100 + (bx % 80);
          ctx.fillRect(bx, CFG.FLOOR_Y - 20 - bh, bw, bh);
          // Windows
          ctx.fillStyle = '#ffcc44';
          for (let wy = CFG.FLOOR_Y - 20 - bh + 15; wy < CFG.FLOOR_Y - 35; wy += 25) {
            for (let wx = bx + 10; wx < bx + bw - 15; wx += 20) {
              ctx.fillRect(wx, wy, 8, 10);
            }
          }
          ctx.fillStyle = '#554433';
        }
        break;
      case 'TRAINING':
        // Training ground
        ctx.fillStyle = '#4a7a4a';
        ctx.fillRect(screenX, CFG.FLOOR_Y - 5, CFG.WORLD_W, 5);
        // Fences
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 2;
        for (let fx = 0; fx < CFG.WORLD_W; fx += 150) {
          ctx.beginPath();
          ctx.moveTo(fx, CFG.FLOOR_Y - 60);
          ctx.lineTo(fx, CFG.FLOOR_Y);
          ctx.stroke();
        }
        // Goal posts
        ctx.fillStyle = '#ffffff';
        for (let gx = 500; gx < CFG.WORLD_W; gx += 2000) {
          ctx.fillRect(gx, CFG.FLOOR_Y - 80, 4, 80);
          ctx.fillRect(gx + 60, CFG.FLOOR_Y - 80, 4, 80);
          ctx.fillRect(gx, CFG.FLOOR_Y - 80, 64, 4);
        }
        break;
      case 'STADIUM_ENTRANCE':
        // Stadium walls
        ctx.fillStyle = '#666';
        ctx.fillRect(screenX, CFG.FLOOR_Y - 200, CFG.WORLD_W, 200);
        // Gates
        ctx.fillStyle = '#888';
        for (let gx = 0; gx < CFG.WORLD_W; gx += 400) {
          ctx.fillRect(gx + 150, CFG.FLOOR_Y - 120, 100, 120);
          // Gate bars
          ctx.fillStyle = '#444';
          for (let bar = 0; bar < 5; bar++) {
            ctx.fillRect(gx + 155 + bar * 20, CFG.FLOOR_Y - 120, 4, 120);
          }
          ctx.fillStyle = '#888';
        }
        break;
      case 'FIELD':
        // Grass field
        const grassGrad = ctx.createLinearGradient(0, CFG.FLOOR_Y - 10, 0, CFG.FLOOR_Y + 80);
        grassGrad.addColorStop(0, CFG.COLORS.grass);
        grassGrad.addColorStop(1, CFG.COLORS.grassLight);
        ctx.fillStyle = grassGrad;
        ctx.fillRect(screenX, CFG.FLOOR_Y - 10, CFG.WORLD_W, 90);
        // Field lines
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 10]);
        for (let ly = CFG.FLOOR_Y; ly < CFG.FLOOR_Y + 70; ly += 35) {
          ctx.beginPath();
          ctx.moveTo(0, ly);
          ctx.lineTo(CFG.WORLD_W, ly);
          ctx.stroke();
        }
        ctx.setLineDash([]);
        // Crowd silhouettes in stands
        ctx.fillStyle = CFG.COLORS.crowd;
        for (let cx = 0; cx < CFG.WORLD_W; cx += 8) {
          const ch = 20 + Math.sin(Date.now() * 0.003 + cx * 0.1) * 5;
          ctx.fillRect(cx, CFG.FLOOR_Y - 100 - ch, 6, ch);
        }
        break;
    }
  }

  drawGround(cam) {
    const ctx = this.ctx;
    const screenX = -cam.x;
    // Main ground
    ctx.fillStyle = CFG.COLORS.groundDark;
    ctx.fillRect(screenX, CFG.FLOOR_Y, CFG.WORLD_W, CFG.WORLD_H - CFG.FLOOR_Y);
    // Ground surface detail
    ctx.fillStyle = CFG.COLORS.ground;
    ctx.fillRect(screenX, CFG.FLOOR_Y, CFG.WORLD_W, 8);
  }

  drawPlatform(p, cam) {
    const ctx = this.ctx;
    const s = cam.worldToScreen(p.x, p.y);
    if (s.x + p.w < -50 || s.x > CFG.CANVAS_W + 50) return;
    ctx.fillStyle = p.color || CFG.COLORS.ground;
    ctx.fillRect(Math.floor(s.x), Math.floor(s.y), p.w, p.h);
    // Top highlight
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(Math.floor(s.x), Math.floor(s.y), p.w, 3);
  }

  drawMovingPlatform(p, cam) {
    this.drawPlatform(p, cam);
    // Movement indicator
    const ctx = this.ctx;
    const s = cam.worldToScreen(p.x, p.y);
    ctx.fillStyle = 'rgba(255,255,0,0.3)';
    ctx.fillRect(Math.floor(s.x), Math.floor(s.y) - 2, p.w, 2);
  }

  drawPlayer(player, cam) {
    const ctx = this.ctx;
    const s = cam.worldToScreen(player.x, player.y);
    const px = Math.floor(s.x);
    const py = Math.floor(s.y);
    const w = player.w;
    const h = player.h;

    // Invulnerability flash
    if (player.invuln > 0 && Math.floor(player.invuln / 4) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    ctx.save();
    if (player.facing === -1) {
      ctx.translate(px + w, 0);
      ctx.scale(-1, 1);
      ctx.translate(-px, 0);
    }

    // Body
    if (player.inBicycle) {
      // Bicycle kick animation
      const rot = player.bicyclePhase * 3;
      ctx.save();
      ctx.translate(px + w / 2, py + h / 2);
      ctx.rotate(rot);
      // Shirt
      ctx.fillStyle = CFG.COLORS.playerShirt;
      ctx.fillRect(-w / 2, -h / 3, w, h / 2);
      // Shorts
      ctx.fillStyle = CFG.COLORS.playerShorts;
      ctx.fillRect(-w / 2, h / 6, w, h / 4);
      // Head
      ctx.fillStyle = '#ffcc88';
      ctx.fillRect(-w / 4, -h / 2, w / 2, h / 4);
      // Ball near foot
      ctx.fillStyle = '#fff';
      ctx.fillRect(w / 2, -h / 4, 10, 10);
      ctx.restore();
    } else if (player.sliding) {
      // Sliding pose
      ctx.fillStyle = CFG.COLORS.playerShirt;
      ctx.fillRect(px, py + h - 15, w + 10, 15);
      ctx.fillStyle = CFG.COLORS.playerShorts;
      ctx.fillRect(px + w, py + h - 20, 15, 10);
      ctx.fillStyle = '#ffcc88';
      ctx.fillRect(px - 5, py + h - 25, 12, 10);
    } else {
      // Normal body
      // Head
      ctx.fillStyle = '#ffcc88';
      ctx.fillRect(px + 8, py, 12, 14);
      // Hair
      ctx.fillStyle = '#442200';
      ctx.fillRect(px + 7, py - 2, 14, 6);
      // Shirt
      ctx.fillStyle = CFG.COLORS.playerShirt;
      ctx.fillRect(px + 4, py + 14, 20, 18);
      // Shorts
      ctx.fillStyle = CFG.COLORS.playerShorts;
      ctx.fillRect(px + 4, py + 32, 20, 10);
      // Legs
      ctx.fillStyle = '#ffcc88';
      if (player.state === 'run') {
        const legOffset = Math.sin(player.animTimer * 0.3) * 4;
        ctx.fillRect(px + 6, py + 42, 6, 6 + Math.abs(legOffset));
        ctx.fillRect(px + 16, py + 42, 6, 6 + Math.abs(-legOffset));
      } else {
        ctx.fillRect(px + 6, py + 42, 6, 6);
        ctx.fillRect(px + 16, py + 42, 6, 6);
      }
      // Arms
      ctx.fillStyle = '#ffcc88';
      ctx.fillRect(px, py + 16, 5, 14);
      ctx.fillRect(px + 23, py + 16, 5, 14);
    }

    // Kick animation indicator
    if (player.state === 'kick') {
      ctx.fillStyle = '#ffffff';
      const kickX = px + (player.facing > 0 ? w + 5 : -15);
      ctx.fillRect(kickX, py + 30, 10, 8);
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  drawEnemy(enemy, cam) {
    const ctx = this.ctx;
    const s = cam.worldToScreen(enemy.x, enemy.y);
    if (s.x + enemy.w < -50 || s.x > CFG.CANVAS_W + 50) return;
    const px = Math.floor(s.x);
    const py = Math.floor(s.y);

    // Invulnerability flash
    if (enemy.invuln > 0 && Math.floor(enemy.invuln / 3) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }

    if (enemy instanceof RivalSupporter) {
      // Rival Supporter - red shirt
      ctx.fillStyle = CFG.COLORS.enemySupporter;
      ctx.fillRect(px + 4, py + 12, 20, 16);
      ctx.fillStyle = '#ffcc88';
      ctx.fillRect(px + 8, py, 12, 12);
      ctx.fillStyle = '#222';
      ctx.fillRect(px + 4, py + 28, 20, 12);
      ctx.fillStyle = '#333';
      ctx.fillRect(px + 6, py + 40, 6, 4);
      ctx.fillRect(px + 16, py + 40, 6, 4);
    } else if (enemy instanceof RefereeEnemy) {
      // Referee - black/white stripes
      ctx.fillStyle = CFG.COLORS.enemyReferee;
      ctx.fillRect(px + 4, py + 12, 20, 18);
      // White stripes
      ctx.fillStyle = '#fff';
      ctx.fillRect(px + 4, py + 16, 20, 3);
      ctx.fillRect(px + 4, py + 24, 20, 3);
      ctx.fillStyle = '#ffcc88';
      ctx.fillRect(px + 8, py, 12, 12);
      ctx.fillStyle = '#222';
      ctx.fillRect(px + 4, py + 30, 20, 14);
      ctx.fillRect(px + 6, py + 44, 6, 4);
      ctx.fillRect(px + 16, py + 44, 6, 4);
    }

    // Health bar for enemies
    if (enemy.health < enemy.maxHealth) {
      const barW = 28;
      const barH = 4;
      ctx.fillStyle = '#333';
      ctx.fillRect(px, py - 8, barW, barH);
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(px, py - 8, barW * (enemy.health / enemy.maxHealth), barH);
    }

    ctx.globalAlpha = 1;
  }

  drawBoss(boss, cam) {
    const ctx = this.ctx;
    const s = cam.worldToScreen(boss.x, boss.y);
    if (s.x + boss.w < -50 || s.x > CFG.CANVAS_W + 50) return;
    const px = Math.floor(s.x);
    const py = Math.floor(s.y);

    // Invulnerability flash
    if (boss.hitInvuln > 0 && Math.floor(boss.hitInvuln / 3) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }

    // Giant boss coach
    // Suit jacket
    ctx.fillStyle = CFG.COLORS.bossCoach;
    ctx.fillRect(px + 10, py + 20, 44, 40);
    // Tie
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(px + 28, py + 22, 8, 30);
    // Head
    ctx.fillStyle = '#ffcc88';
    ctx.fillRect(px + 16, py, 32, 22);
    // Hair
    ctx.fillStyle = '#666';
    ctx.fillRect(px + 14, py - 4, 36, 8);
    // Eyes (angry)
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(px + 20, py + 8, 6, 4);
    ctx.fillRect(px + 38, py + 8, 6, 4);
    // Legs
    ctx.fillStyle = '#333';
    ctx.fillRect(px + 14, py + 60, 14, 36);
    ctx.fillRect(px + 36, py + 60, 14, 36);
    // Arms
    ctx.fillStyle = CFG.COLORS.bossCoach;
    ctx.fillRect(px, py + 24, 12, 30);
    ctx.fillRect(px + 52, py + 24, 12, 30);

    // Enraged effect
    if (boss.enraged) {
      ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
      ctx.fillRect(px - 5, py - 5, boss.w + 10, boss.h + 10);
    }

    ctx.globalAlpha = 1;
  }

  drawProjectile(proj, cam) {
    const ctx = this.ctx;
    const s = cam.worldToScreen(proj.x, proj.y);
    if (s.x + proj.w < -50 || s.x > CFG.CANVAS_W + 50) return;
    const px = Math.floor(s.x);
    const py = Math.floor(s.y);

    if (proj.type === 'fireball') {
      ctx.fillStyle = CFG.COLORS.fireball;
      ctx.beginPath();
      ctx.arc(px + proj.w / 2, py + proj.h / 2, proj.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.arc(px + proj.w / 2, py + proj.h / 2, proj.radius * 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (proj.owner === 'enemy' || proj.owner === 'boss') {
      // Enemy/boss flaming ball
      ctx.fillStyle = '#ff4400';
      ctx.beginPath();
      ctx.arc(px + proj.w / 2, py + proj.h / 2, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.arc(px + proj.w / 2, py + proj.h / 2, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Regular football
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px + proj.w / 2, py + proj.h / 2, 6, 0, Math.PI * 2);
      ctx.fill();
      // Pentagon pattern
      ctx.fillStyle = '#222';
      ctx.fillRect(px + 4, py + 4, 4, 4);
    }
  }

  drawCollectible(c, cam) {
    const ctx = this.ctx;
    if (c.collected) return;
    const s = cam.worldToScreen(c.x, c.y);
    if (s.x + c.w < -50 || s.x > CFG.CANVAS_W + 50) return;
    const bobY = Math.sin(c.bobPhase) * 3;
    const px = Math.floor(s.x);
    const py = Math.floor(s.y + bobY);

    if (c.type === 'coin') {
      ctx.fillStyle = CFG.COLORS.coin;
      ctx.beginPath();
      ctx.arc(px + 8, py + 8, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = CFG.COLORS.coinDark;
      ctx.beginPath();
      ctx.arc(px + 8, py + 8, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (c.type === 'fireball') {
      ctx.fillStyle = CFG.COLORS.fireball;
      ctx.beginPath();
      ctx.arc(px + 8, py + 8, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.arc(px + 8, py + 8, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawCheckpoint(cp, cam) {
    const ctx = this.ctx;
    const s = cam.worldToScreen(cp.x, cp.y);
    if (s.x + cp.w < -50 || s.x > CFG.CANVAS_W + 50) return;
    const px = Math.floor(s.x);
    const py = Math.floor(s.y);

    // Pole
    ctx.fillStyle = '#888';
    ctx.fillRect(px + 14, py, 4, 64);
    // Flag
    const flagWave = Math.sin(cp.flagPhase) * 3;
    ctx.fillStyle = cp.activated ? CFG.COLORS.checkpoint : '#888';
    ctx.beginPath();
    ctx.moveTo(px + 18, py);
    ctx.lineTo(px + 38 + flagWave, py + 8);
    ctx.lineTo(px + 18, py + 16);
    ctx.closePath();
    ctx.fill();

    // Glow if activated
    if (cp.activated) {
      ctx.globalAlpha = 0.3 + Math.sin(cp.flagPhase * 2) * 0.15;
      ctx.fillStyle = CFG.COLORS.checkpoint;
      ctx.beginPath();
      ctx.arc(px + 16, py + 32, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  drawHazard(h, cam) {
    const ctx = this.ctx;
    const s = cam.worldToScreen(h.x, h.y);
    ctx.fillStyle = 'rgba(255, 68, 0, 0.6)';
    ctx.fillRect(Math.floor(s.x), Math.floor(s.y), h.w, h.h);
    // Sparkle
    ctx.fillStyle = '#ffcc00';
    for (let i = 0; i < 3; i++) {
      const sparkX = Math.floor(s.x) + ((i * 47 + Date.now() * 0.01) % h.w);
      const sparkY = Math.floor(s.y) + ((i * 31 + Date.now() * 0.008) % h.h);
      ctx.fillRect(sparkX, sparkY, 3, 3);
    }
  }

  drawTrophy(x, y, cam) {
    const ctx = this.ctx;
    const s = cam.worldToScreen(x, y);
    const px = Math.floor(s.x);
    const py = Math.floor(s.y);

    // Original golden trophy
    // Base
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(px - 15, py + 50, 30, 10);
    ctx.fillRect(px - 10, py + 40, 20, 10);
    // Cup body
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.moveTo(px - 20, py + 10);
    ctx.lineTo(px + 20, py + 10);
    ctx.lineTo(px + 15, py + 40);
    ctx.lineTo(px - 15, py + 40);
    ctx.closePath();
    ctx.fill();
    // Handles
    ctx.fillStyle = '#DAA520';
    ctx.fillRect(px - 28, py + 12, 8, 15);
    ctx.fillRect(px + 20, py + 12, 8, 15);
    // Shine
    ctx.fillStyle = '#FFF8DC';
    ctx.fillRect(px - 5, py + 15, 4, 20);
    // Star on top
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fill();

    // Sparkle effect
    const sparkle = Math.sin(Date.now() * 0.005) * 0.3 + 0.7;
    ctx.globalAlpha = sparkle;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px + 5, py + 20, 3, 3);
    ctx.globalAlpha = 1;
  }

  render(game, cam) {
    this.clear();
    this.drawSky(cam);

    // Determine current zone
    let zone = 'STREET';
    if (game.player.x >= CFG.ZONES.TRAINING.xStart) zone = 'TRAINING';
    if (game.player.x >= CFG.ZONES.STADIUM_ENTRANCE.xStart) zone = 'STADIUM_ENTRANCE';
    if (game.player.x >= CFG.ZONES.FIELD.xStart) zone = 'FIELD';

    this.drawZoneBackground(cam, zone);
    this.drawGround(cam);

    // Platforms
    for (const p of game.level.platforms) {
      this.drawPlatform(p, cam);
    }
    for (const p of game.level.movingPlatforms) {
      this.drawMovingPlatform(p, cam);
    }

    // Hazards
    for (const h of game.level.hazards) {
      this.drawHazard(h, cam);
    }

    // Checkpoints
    for (const cp of game.level.checkpoints) {
      this.drawCheckpoint(cp, cam);
    }

    // Collectibles
    for (const c of game.level.collectibles) {
      this.drawCollectible(c, cam);
    }

    // Enemies
    for (const e of game.level.enemies) {
      if (e.alive) this.drawEnemy(e, cam);
    }

    // Boss
    if (game.boss && game.boss.alive && !game.boss.defeated) {
      this.drawBoss(game.boss, cam);
    }

    // Projectiles
    for (const p of game.projectiles) {
      if (p.alive) this.drawProjectile(p, cam);
    }

    // Player
    if (game.player) {
      this.drawPlayer(game.player, cam);
    }

    // Trophy
    if (game.trophyVisible) {
      this.drawTrophy(game.trophyX, game.trophyY, cam);
    }

    // Particles
    game.particles.render(ctx, cam);

    // Debug hitboxes
    if (CFG.DEBUG) {
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
      ctx.lineWidth = 1;
      if (game.player) {
        const s = cam.worldToScreen(game.player.x, game.player.y);
        ctx.strokeRect(Math.floor(s.x), Math.floor(s.y), game.player.w, game.player.h);
      }
      for (const e of game.level.enemies) {
        if (!e.alive) continue;
        const s = cam.worldToScreen(e.x, e.y);
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.strokeRect(Math.floor(s.x), Math.floor(s.y), e.w, e.h);
      }
    }
  }
}

/* ============================================================
   LEVEL BUILDER
   ============================================================ */
class Level {
  constructor() {
    this.platforms = [];
    this.movingPlatforms = [];
    this.enemies = [];
    this.collectibles = [];
    this.checkpoints = [];
    this.hazards = [];
    this.playerStart = { x: 100, y: CFG.FLOOR_Y - CFG.PLAYER_H };
  }

  build() {
    // ---- ZONE 1: STREET ----
    // Ground platforms with gaps
    this.platforms.push(new Platform(0, CFG.FLOOR_Y, 800, 100));
    this.platforms.push(new Platform(900, CFG.FLOOR_Y, 600, 100));
    this.platforms.push(new Platform(1600, CFG.FLOOR_Y, 500, 100));
    this.platforms.push(new Platform(2200, CFG.FLOOR_Y, 800, 100));
    this.platforms.push(new Platform(3100, CFG.FLOOR_Y, 400, 100));

    // Elevated platforms (crates, walls)
    this.platforms.push(new Platform(300, CFG.FLOOR_Y - 60, 80, 20));
    this.platforms.push(new Platform(500, CFG.FLOOR_Y - 100, 80, 20));
    this.platforms.push(new Platform(700, CFG.FLOOR_Y - 50, 100, 20));
    this.platforms.push(new Platform(1100, CFG.FLOOR_Y - 80, 80, 20));
    this.platforms.push(new Platform(1800, CFG.FLOOR_Y - 60, 120, 20));
    this.platforms.push(new Platform(2400, CFG.FLOOR_Y - 100, 80, 20));
    this.platforms.push(new Platform(2700, CFG.FLOOR_Y - 70, 80, 20));

    // Small ramps
    this.platforms.push(new Platform(400, CFG.FLOOR_Y - 30, 60, 30));
    this.platforms.push(new Platform(1400, CFG.FLOOR_Y - 25, 80, 25));

    // Coins in Zone 1
    const zone1Coins = [150, 350, 550, 750, 950, 1150, 1350, 1550, 1800, 2100, 2500, 2800, 3000];
    for (let i = 0; i < zone1Coins.length; i++) {
      this.collectibles.push(new Collectible(zone1Coins[i], CFG.FLOOR_Y - 40, 'coin'));
    }

    // Enemies in Zone 1
    this.enemies.push(new RivalSupporter(600, CFG.FLOOR_Y - 44));
    this.enemies.push(new RivalSupporter(1300, CFG.FLOOR_Y - 44));
    this.enemies.push(new RivalSupporter(2000, CFG.FLOOR_Y - 44));
    this.enemies.push(new RivalSupporter(2600, CFG.FLOOR_Y - 44));

    // Checkpoint 1
    this.checkpoints.push(new Checkpoint(3200, CFG.FLOOR_Y - 64, 0));

    // ---- ZONE 2: TRAINING CENTRE ----
    this.platforms.push(new Platform(3500, CFG.FLOOR_Y, 600, 100));
    this.platforms.push(new Platform(4200, CFG.FLOOR_Y, 500, 100));
    this.platforms.push(new Platform(4800, CFG.FLOOR_Y, 600, 100));
    this.platforms.push(new Platform(5500, CFG.FLOOR_Y, 500, 100));
    this.platforms.push(new Platform(6100, CFG.FLOOR_Y, 800, 100));
    this.platforms.push(new Platform(7000, CFG.FLOOR_Y, 500, 100));

    // Training obstacles
    this.platforms.push(new Platform(3700, CFG.FLOOR_Y - 50, 60, 50));
    this.platforms.push(new Platform(3900, CFG.FLOOR_Y - 70, 60, 70));
    this.platforms.push(new Platform(4400, CFG.FLOOR_Y - 60, 80, 60));
    this.platforms.push(new Platform(5000, CFG.FLOOR_Y - 80, 60, 80));
    this.platforms.push(new Platform(5300, CFG.FLOOR_Y - 50, 100, 50));
    this.platforms.push(new Platform(5800, CFG.FLOOR_Y - 60, 80, 60));
    this.platforms.push(new Platform(6400, CFG.FLOOR_Y - 70, 80, 70));

    // Moving platforms
    this.movingPlatforms.push(new MovingPlatform(4100, CFG.FLOOR_Y - 100, 80, 16, 120, 0, 1));
    this.movingPlatforms.push(new MovingPlatform(5700, CFG.FLOOR_Y - 120, 80, 16, 0, 60, 0.8));
    this.movingPlatforms.push(new MovingPlatform(6700, CFG.FLOOR_Y - 80, 100, 16, 80, 0, 1.2));

    // Coins in Zone 2
    const zone2Coins = [3600, 3850, 4300, 4600, 4900, 5200, 5600, 6000, 6500, 6900];
    for (let i = 0; i < zone2Coins.length; i++) {
      this.collectibles.push(new Collectible(zone2Coins[i], CFG.FLOOR_Y - 40, 'coin'));
    }

    // Fire Ball power-up 1
    this.collectibles.push(new Collectible(4500, CFG.FLOOR_Y - 80, 'fireball'));

    // Enemies in Zone 2
    this.enemies.push(new RivalSupporter(3800, CFG.FLOOR_Y - 44));
    this.enemies.push(new RefereeEnemy(4500, CFG.FLOOR_Y - 48));
    this.enemies.push(new RivalSupporter(5200, CFG.FLOOR_Y - 44));
    this.enemies.push(new RefereeEnemy(5900, CFG.FLOOR_Y - 48));
    this.enemies.push(new RivalSupporter(6500, CFG.FLOOR_Y - 44));

    // Checkpoint 2
    this.checkpoints.push(new Checkpoint(7200, CFG.FLOOR_Y - 64, 1));

    // ---- ZONE 3: STADIUM ENTRANCE ----
    this.platforms.push(new Platform(7500, CFG.FLOOR_Y, 500, 100));
    this.platforms.push(new Platform(8100, CFG.FLOOR_Y, 400, 100));
    this.platforms.push(new Platform(8600, CFG.FLOOR_Y, 500, 100));
    this.platforms.push(new Platform(9200, CFG.FLOOR_Y, 600, 100));
    this.platforms.push(new Platform(9900, CFG.FLOOR_Y, 500, 100));
    this.platforms.push(new Platform(10500, CFG.FLOOR_Y, 500, 100));
    this.platforms.push(new Platform(11100, CFG.FLOOR_Y, 400, 100));

    // Stadium architecture
    this.platforms.push(new Platform(7700, CFG.FLOOR_Y - 80, 80, 80));
    this.platforms.push(new Platform(8000, CFG.FLOOR_Y - 100, 80, 100));
    this.platforms.push(new Platform(8400, CFG.FLOOR_Y - 60, 100, 60));
    this.platforms.push(new Platform(8900, CFG.FLOOR_Y - 80, 80, 80));
    this.platforms.push(new Platform(9400, CFG.FLOOR_Y - 100, 80, 100));
    this.platforms.push(new Platform(9700, CFG.FLOOR_Y - 60, 120, 60));
    this.platforms.push(new Platform(10200, CFG.FLOOR_Y - 80, 80, 80));
    this.platforms.push(new Platform(10700, CFG.FLOOR_Y - 90, 80, 90));

    // Moving platforms
    this.movingPlatforms.push(new MovingPlatform(8300, CFG.FLOOR_Y - 120, 80, 16, 0, 80, 0.7));
    this.movingPlatforms.push(new MovingPlatform(9500, CFG.FLOOR_Y - 140, 100, 16, 100, 0, 1));
    this.movingPlatforms.push(new MovingPlatform(10900, CFG.FLOOR_Y - 100, 80, 16, 0, 50, 0.9));

    // Coins in Zone 3
    const zone3Coins = [7600, 7900, 8200, 8500, 8800, 9100, 9500, 9800, 10100, 10400, 10800, 11000];
    for (let i = 0; i < zone3Coins.length; i++) {
      this.collectibles.push(new Collectible(zone3Coins[i], CFG.FLOOR_Y - 40, 'coin'));
    }

    // Fire Ball power-up 2
    this.collectibles.push(new Collectible(9300, CFG.FLOOR_Y - 100, 'fireball'));

    // Enemies in Zone 3 (more aggressive)
    this.enemies.push(new RivalSupporter(7700, CFG.FLOOR_Y - 44));
    this.enemies.push(new RefereeEnemy(8300, CFG.FLOOR_Y - 48));
    this.enemies.push(new RivalSupporter(8800, CFG.FLOOR_Y - 44));
    this.enemies.push(new RivalSupporter(9200, CFG.FLOOR_Y - 44));
    this.enemies.push(new RefereeEnemy(9800, CFG.FLOOR_Y - 48));
    this.enemies.push(new RivalSupporter(10300, CFG.FLOOR_Y - 44));
    this.enemies.push(new RefereeEnemy(10800, CFG.FLOOR_Y - 48));

    // Checkpoint 3
    this.checkpoints.push(new Checkpoint(11300, CFG.FLOOR_Y - 64, 2));

    // ---- ZONE 4: FIELD ----
    this.platforms.push(new Platform(11500, CFG.FLOOR_Y, 600, 100));
    this.platforms.push(new Platform(12200, CFG.FLOOR_Y, 500, 100));
    this.platforms.push(new Platform(12800, CFG.FLOOR_Y, 400, 100));
    this.platforms.push(new Platform(13300, CFG.FLOOR_Y, 500, 100));

    // Coins in Zone 4
    const zone4Coins = [11700, 12000, 12400, 12700, 13100];
    for (let i = 0; i < zone4Coins.length; i++) {
      this.collectibles.push(new Collectible(zone4Coins[i], CFG.FLOOR_Y - 40, 'coin'));
    }

    // Enemies in Zone 4
    this.enemies.push(new RivalSupporter(11800, CFG.FLOOR_Y - 44));
    this.enemies.push(new RefereeEnemy(12400, CFG.FLOOR_Y - 48));
    this.enemies.push(new RivalSupporter(13000, CFG.FLOOR_Y - 44));

    // Checkpoint 4 (before boss)
    this.checkpoints.push(new Checkpoint(13400, CFG.FLOOR_Y - 64, 3));

    // Boss arena
    this.bossArenaLeft = 13700;
    this.bossArenaRight = 14400;
    this.platforms.push(new Platform(13700, CFG.FLOOR_Y, 700, 100));

    // Boss
    this.boss = new BossCoach(14000, CFG.FLOOR_Y - 96);

    // Fall hazard zone (below world)
    this.fallY = CFG.WORLD_H;

    // Ensure exactly 30 coins
    let totalCoins = this.collectibles.filter(c => c.type === 'coin').length;
    while (totalCoins < CFG.TOTAL_COINS) {
      const x = 500 + totalCoins * 400;
      this.collectibles.push(new Collectible(x, CFG.FLOOR_Y - 40, 'coin'));
      totalCoins++;
    }
    // Trim excess
    let coinCount = 0;
    for (let i = this.collectibles.length - 1; i >= 0; i--) {
      if (this.collectibles[i].type === 'coin') {
        coinCount++;
        if (coinCount > CFG.TOTAL_COINS) {
          this.collectibles.splice(i, 1);
        }
      }
    }

    // Ensure exactly 2 fireballs
    let fbCount = this.collectibles.filter(c => c.type === 'fireball').length;
    while (fbCount < CFG.TOTAL_FIREBALLS) {
      this.collectibles.push(new Collectible(1000 + fbCount * 5000, CFG.FLOOR_Y - 80, 'fireball'));
      fbCount++;
    }

    // Scale enemies to difficulty
    const diffCfg = CFG.DIFFICULTY[game.difficulty] || CFG.DIFFICULTY.MEDIO;
    for (const e of this.enemies) {
      e.scaleDifficulty(diffCfg);
    }
    if (this.boss) {
      this.boss.scaleDifficulty(diffCfg);
    }
  }
}

/* ============================================================
   UI MANAGER
   ============================================================ */
class UIManager {
  constructor() {
    this.toastTimer = null;
  }

  showScreen(id) {
    // Hide all screens
    const screens = document.querySelectorAll('.screen-overlay');
    screens.forEach(s => {
      s.classList.remove('is-active');
      s.classList.add('is-hidden');
    });
    // Show target
    const target = document.getElementById(id);
    if (target) {
      target.classList.remove('is-hidden');
      target.classList.add('is-active');
    }
  }

  hideAllScreens() {
    const screens = document.querySelectorAll('.screen-overlay');
    screens.forEach(s => {
      s.classList.remove('is-active');
      s.classList.add('is-hidden');
    });
  }

  updateHUD(game) {
    const p = game.player;
    if (!p) return;

    // Hearts
    const heartsEl = document.getElementById('hud-hearts');
    if (heartsEl) {
      heartsEl.innerHTML = '';
      for (let i = 0; i < CFG.MAX_HEARTS; i++) {
        const heart = document.createElement('span');
        heart.className = 'heart' + (i >= p.health ? ' is-empty' : '');
        heartsEl.appendChild(heart);
      }
    }

    // Score
    const scoreEl = document.getElementById('hud-score');
    if (scoreEl) scoreEl.textContent = p.score;

    // Coins
    const coinsEl = document.getElementById('hud-coins');
    if (coinsEl) coinsEl.textContent = p.coinsCollected + '/' + CFG.TOTAL_COINS;

    // Continues
    const contEl = document.getElementById('hud-continues');
    if (contEl) contEl.textContent = game.continuesLeft;

    // Fireballs
    const fbEl = document.getElementById('hud-fireballs');
    if (fbEl) fbEl.textContent = p.fireballAmmo;

    // Difficulty
    const diffEl = document.getElementById('hud-difficulty');
    if (diffEl) diffEl.textContent = CFG.DIFFICULTY[game.difficulty].label;

    // Progress
    const progEl = document.getElementById('hud-progress');
    if (progEl) {
      const fill = progEl.querySelector('.progress-bar-fill');
      if (fill) {
        const progress = (p.x / CFG.WORLD_W) * 100;
        fill.style.width = clamp(progress, 0, 100) + '%';
      }
    }

    // Boss health
    const bossHealthEl = document.getElementById('hud-boss-health');
    if (game.boss && !game.boss.defeated && game.bossState) {
      bossHealthEl.classList.add('is-active');
      const fill = bossHealthEl.querySelector('.boss-health-fill');
      const text = bossHealthEl.querySelector('.boss-health-text');
      if (fill) fill.style.width = (game.boss.getHealthPercent() * 100) + '%';
      if (text) text.textContent = Math.ceil(game.boss.health) + ' / ' + game.boss.maxHealth;
    } else {
      bossHealthEl.classList.remove('is-active');
    }

    // Zone label
    const zoneLabel = document.getElementById('hud-zone-label');
    if (zoneLabel && game.zoneChanged) {
      let zoneName = CFG.ZONES.STREET.name;
      if (p.x >= CFG.ZONES.TRAINING.xStart) zoneName = CFG.ZONES.TRAINING.name;
      if (p.x >= CFG.ZONES.STADIUM_ENTRANCE.xStart) zoneName = CFG.ZONES.STADIUM_ENTRANCE.name;
      if (p.x >= CFG.ZONES.FIELD.xStart) zoneName = CFG.ZONES.FIELD.name;
      zoneLabel.textContent = zoneName;
      zoneLabel.classList.add('is-visible');
      setTimeout(() => zoneLabel.classList.remove('is-visible'), 2000);
      game.zoneChanged = false;
    }
  }

  showToast(msg) {
    const el = document.getElementById('damage-status');
    if (el) {
      el.textContent = msg;
      el.classList.add('is-visible');
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => el.classList.remove('is-visible'), 1500);
    }
  }

  showCheckpointNotification(index) {
    const el = document.getElementById('screen-checkpoint-notify');
    const msg = document.getElementById('checkpoint-message');
    if (el && msg) {
      msg.textContent = 'Checkpoint ' + index + ' ativado!';
      el.classList.remove('is-hidden');
      el.classList.add('is-active');
      setTimeout(() => {
        el.classList.remove('is-active');
        el.classList.add('is-hidden');
      }, 2000);
    }
  }

  showDamageFlash() {
    const el = document.getElementById('overlay-damage-flash');
    if (el) {
      el.classList.add('is-active');
      setTimeout(() => el.classList.remove('is-active'), 200);
    }
  }

  setBossIntro(name) {
    const el = document.getElementById('boss-name-label');
    if (el) el.textContent = name;
  }

  showVictoryStats(game) {
    const el = document.getElementById('victory-stats');
    if (el && game.player) {
      const p = game.player;
      const timeStr = p.completionTime > 0 ? Math.floor(p.completionTime / 1000) + 's' : '--';
      el.innerHTML =
        '<div class="stat-row"><span class="stat-label">Pontuação</span><span class="stat-value">' + p.score + '</span></div>' +
        '<div class="stat-row"><span class="stat-label">Moedas</span><span class="stat-value">' + p.coinsCollected + ' / ' + CFG.TOTAL_COINS + '</span></div>' +
        '<div class="stat-row"><span class="stat-label">Inimigos derrotados</span><span class="stat-value">' + p.enemiesDefeated + '</span></div>' +
        '<div class="stat-row"><span class="stat-label">Dificuldade</span><span class="stat-value">' + CFG.DIFFICULTY[game.difficulty].label + '</span></div>' +
        '<div class="stat-row"><span class="stat-label">Continues usados</span><span class="stat-value">' + (CFG.STARTING_CONTINUES - game.continuesLeft) + '</span></div>' +
        '<div class="stat-row"><span class="stat-label">Continues restantes</span><span class="stat-value">' + game.continuesLeft + '</span></div>' +
        '<div class="stat-row"><span class="stat-label">Tempo</span><span class="stat-value">' + timeStr + '</span></div>';
    }
  }

  setGameOverMessage(msg) {
    const el = document.getElementById('gameover-message');
    if (el) el.textContent = msg;
  }

  setGameOverContinues(left) {
    const el = document.getElementById('gameover-continues-left');
    if (el) el.textContent = 'Continues restantes: ' + left;
  }

  announce(text) {
    const el = document.getElementById('aria-live-region');
    if (el) el.textContent = text;
  }

  setAudioStatus(muted, volume) {
    const statusEl = document.querySelector('.audio-status');
    if (statusEl) {
      statusEl.textContent = muted ? 'Som desligado' : 'Volume: ' + Math.round(volume * 100) + '%';
    }
  }
}

/* ============================================================
   GAME STATE MANAGER
   ============================================================ */
const STATES = {
  BOOT: 'boot',
  MENU: 'menu',
  CONTROLS: 'controls',
  DIFFICULTY: 'difficulty',
  AUDIO_SETTINGS: 'audio',
  CREDITS: 'credits',
  PLAYING: 'playing',
  PAUSED: 'paused',
  CHECKPOINT_NOTIFY: 'checkpoint',
  BOSS_INTRO: 'boss_intro',
  BOSS_BATTLE: 'boss_battle',
  VICTORY_SEQ: 'victory_seq',
  VICTORY_STATS: 'victory_stats',
  GAMEOVER: 'gameover',
  FATAL_ERROR: 'fatal_error'
};

/* ============================================================
   MAIN GAME CLASS
   ============================================================ */
class Game {
  constructor() {
    this.state = STATES.BOOT;
    this.difficulty = 'MEDIO';
    this.player = null;
    this.level = null;
    this.boss = null;
    this.bossState = false;
    this.trophyVisible = false;
    this.trophyX = 0;
    this.trophyY = 0;
    this.projectiles = [];
    this.continuesLeft = CFG.STARTING_CONTINUES;
    this.zoneChanged = true;
    this.lastZone = '';
    this.particles = new ParticleSystem();
    this.camera = new Camera();
    this.renderer = null;
    this.input = new InputManager();
    this.audio = new AudioManager();
    this.ui = new UIManager();
    this.gameTime = 0;
    this.prevPlayerX = 0;
  }

  init() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    if (!canvas || !ctx) {
      this.showFatalError('Canvas não disponível.');
      return;
    }

    canvas.width = CFG.CANVAS_W;
    canvas.height = CFG.CANVAS_H;

    this.renderer = new Renderer(ctx);
    this.input.init();

    // Cache DOM refs
    DOM.startBtn = document.getElementById('btn-start');
    DOM.controlsBtn = document.getElementById('btn-controls');
    DOM.difficultyBtn = document.getElementById('btn-difficulty');
    DOM.audioBtn = document.getElementById('btn-audio');
    DOM.creditsBtn = document.getElementById('btn-credits');
    DOM.easyBtn = document.getElementById('btn-easy');
    DOM.mediumBtn = document.getElementById('btn-medium');
    DOM.hardBtn = document.getElementById('btn-hard');
    DOM.backMenuBtn = document.getElementById('btn-back-menu');
    DOM.backControlsBtn = document.getElementById('btn-back-controls');
    DOM.backDifficultyBtn = document.getElementById('btn-back-difficulty');
    DOM.backAudioBtn = document.getElementById('btn-back-audio');
    DOM.backCreditsBtn = document.getElementById('btn-back-credits');
    DOM.pauseBtn = document.getElementById('btn-pause');
    DOM.resumeBtn = document.getElementById('btn-resume');
    DOM.retryBtn = document.getElementById('btn-retry');
    DOM.menuFromGameoverBtn = document.getElementById('btn-menu-from-gameover');
    DOM.menuFromVictoryBtn = document.getElementById('btn-menu-from-victory');
    DOM.replayBtn = document.getElementById('btn-replay');
    DOM.muteBtn = document.getElementById('btn-mute');
    DOM.volumeSlider = document.getElementById('volume-slider');
    DOM.difficultyLabel = document.getElementById('difficulty-label');

    // Bind button events
    this.bindButtons();

    // Show menu
    this.setState(STATES.MENU);
    this.audio.startMusic('menu');

    // Start loop
    running = true;
    lastTime = performance.now();
    animFrameId = requestAnimationFrame(this.loop.bind(this));

    // Self-validation
    this.selfCheck();
  }

  bindButtons() {
    // Menu buttons
    this.bindClick('btn-start', () => {
      this.audio.init();
      this.audio.resume();
      this.startGame();
    });
    this.bindClick('btn-controls', () => this.setState(STATES.CONTROLS));
    this.bindClick('btn-difficulty', () => this.setState(STATES.DIFFICULTY));
    this.bindClick('btn-audio', () => this.setState(STATES.AUDIO_SETTINGS));
    this.bindClick('btn-credits', () => this.setState(STATES.CREDITS));

    // Difficulty
    this.bindClick('btn-easy', () => this.selectDifficulty('FACIL'));
    this.bindClick('btn-medium', () => this.selectDifficulty('MEDIO'));
    this.bindClick('btn-hard', () => this.selectDifficulty('DIFICIL'));
    this.bindClick('btn-back-difficulty', () => this.setState(STATES.MENU));

    // Navigation
    this.bindClick('btn-back-menu', () => this.setState(STATES.MENU));
    this.bindClick('btn-back-controls', () => this.setState(STATES.MENU));
    this.bindClick('btn-back-audio', () => this.setState(STATES.MENU));
    this.bindClick('btn-back-credits', () => this.setState(STATES.MENU));

    // Pause
    this.bindClick('btn-resume', () => this.resumeGame());
    this.bindClick('btn-retry', () => this.retryFromBoss());

    // Game Over
    this.bindClick('btn-menu-from-gameover', () => this.returnToMenu());

    // Victory
    this.bindClick('btn-menu-from-victory', () => this.returnToMenu());
    this.bindClick('btn-replay', () => this.startGame());

    // Audio
    this.bindClick('btn-mute', () => {
      this.audio.setMuted(!this.audio.muted);
      this.updateAudioUI();
    });

    // Volume slider
    if (DOM.volumeSlider) {
      DOM.volumeSlider.addEventListener('input', (e) => {
        this.audio.setVolume(parseFloat(e.target.value));
        this.updateAudioUI();
      });
    }

    // Pause key
    document.addEventListener('keydown', (e) => {
      if (e.code === CFG.KEYS.PAUSE || e.code === CFG.KEYS.ESCAPE) {
        if (this.state === STATES.PLAYING || this.state === STATES.BOSS_BATTLE) {
          this.pauseGame();
        } else if (this.state === STATES.PAUSED) {
          this.resumeGame();
        }
      }
      if (e.code === CFG.KEYS.ESCAPE) {
        if (this.state === STATES.CONTROLS || this.state === STATES.DIFFICULTY ||
            this.state === STATES.AUDIO_SETTINGS || this.state === STATES.CREDITS) {
          this.setState(STATES.MENU);
        }
      }
    });
  }

  bindClick(id, fn) {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        fn();
      });
    }
  }

  selectDifficulty(diff) {
    this.difficulty = diff;
    // Update UI
    ['btn-easy', 'btn-medium', 'btn-hard'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.classList.remove('is-selected');
    });
    const selectedMap = { FACIL: 'btn-easy', MEDIO: 'btn-medium', DIFICIL: 'btn-hard' };
    const selBtn = document.getElementById(selectedMap[diff]);
    if (selBtn) selBtn.classList.add('is-selected');
    if (DOM.difficultyLabel) DOM.difficultyLabel.textContent = CFG.DIFFICULTY[diff].label;
  }

  startGame() {
    this.player = new Player(100, CFG.FLOOR_Y - CFG.PLAYER_H);
    this.player.startTime = performance.now();
    this.level = new Level();
    this.level.build();
    this.boss = this.level.boss;
    this.bossState = false;
    this.trophyVisible = false;
    this.projectiles = [];
    this.continuesLeft = CFG.STARTING_CONTINUES;
    this.zoneChanged = true;
    this.lastZone = '';
    this.gameTime = 0;
    this.particles.clear();
    this.camera = new Camera();

    // Show game, hide menus
    this.ui.hideAllScreens();
    this.state = STATES.PLAYING;
    this.audio.startMusic('street');

    // Enable pause button visibility
    const pauseBtn = document.getElementById('btn-pause');
    if (pauseBtn) pauseBtn.style.display = 'inline-flex';
  }

  pauseGame() {
    if (this.state !== STATES.PLAYING && this.state !== STATES.BOSS_BATTLE) return;
    this.prevState = this.state;
    this.state = STATES.PAUSED;
    this.ui.showScreen('screen-pause');
    this.audio.stopMusic();
  }

  resumeGame() {
    this.state = this.prevState || STATES.PLAYING;
    this.ui.hideAllScreens();
    const musicZone = this.getCurrentMusicZone();
    this.audio.startMusic(musicZone);
  }

  retryFromBoss() {
    // Respawn at checkpoint 4
    if (this.level && this.level.checkpoints[3]) {
      const cp = this.level.checkpoints[3];
      this.player.respawn(cp.x - 50, CFG.FLOOR_Y);
      this.projectiles = [];
      this.bossState = false;
      this.boss.alive = true;
      this.boss.defeated = false;
      this.boss.health = this.boss.maxHealth;
      this.boss.phase = 1;
      this.boss.state = 'idle';
      this.boss.introTimer = 120;
      this.trophyVisible = false;
      this.state = STATES.PLAYING;
      this.ui.hideAllScreens();
      this.audio.startMusic('field');
    }
  }

  returnToMenu() {
    this.state = STATES.MENU;
    this.ui.showScreen('screen-main-menu');
    this.audio.stopMusic();
    this.audio.startMusic('menu');
    if (canvas) canvas.style.display = 'block';
    const pauseBtn = document.getElementById('btn-pause');
    if (pauseBtn) pauseBtn.style.display = 'none';
  }

  onPlayerHit() {
    this.audio.playHurt();
    this.particles.emitHit(this.player.x + this.player.w / 2, this.player.y);
    this.ui.showDamageFlash();
    this.ui.showToast('Dano!');
    this.ui.announce('Jogador sofreu dano. Vidas restantes: ' + this.player.health);

    if (this.player.health <= 0) {
      this.onPlayerDefeat();
    }
  }

  onPlayerDefeat() {
    this.continuesLeft--;
    if (this.continuesLeft < 0) this.continuesLeft = 0;

    if (this.continuesLeft > 0) {
      // Respawn at last checkpoint
      this.state = STATES.CHECKPOINT_NOTIFY;
      const cp = this.level.checkpoints[this.player.checkpointIndex];
      if (cp) {
        this.player.respawn(cp.x - 50, CFG.FLOOR_Y);
        this.projectiles = [];
        this.ui.showCheckpointNotification(this.player.checkpointIndex + 1);
        this.ui.announce('Respawn no checkpoint ' + (this.player.checkpointIndex + 1));
        setTimeout(() => {
          this.state = STATES.PLAYING;
          this.ui.hideAllScreens();
        }, 2000);
      }
    } else {
      // Game Over
      this.state = STATES.GAMEOVER;
      this.audio.playGameOver();
      this.audio.stopMusic();
      this.ui.setGameOverMessage('Fim de jogo!');
      this.ui.setGameOverContinues(0);
      this.ui.showScreen('screen-gameover');
      this.ui.announce('Fim de jogo.');
    }
  }

  onBossDefeated() {
    this.audio.playExplosion();
    this.particles.emitExplosion(this.boss.x + this.boss.w / 2, this.boss.y + this.boss.h / 2);
    this.boss.defeated = true;
    this.boss.alive = false;
    this.projectiles = [];

    // Show trophy after delay
    setTimeout(() => {
      this.trophyVisible = true;
      this.trophyX = this.boss.x + this.boss.w / 2;
      this.trophyY = CFG.FLOOR_Y - 70;
      this.audio.playVictory();
      this.particles.emitVictory(this.trophyX, this.trophyY);
      this.ui.showToast('Troféu conquistado!');

      setTimeout(() => {
        this.state = STATES.VICTORY_STATS;
        this.player.completionTime = performance.now() - this.player.startTime;
        this.player.score += 5000;
        this.ui.showVictoryStats(this);
        this.ui.showScreen('screen-victory');
        this.ui.announce('Vitória! Parabéns!');
      }, 4000);
    }, 1500);
  }

  addProjectile(proj) {
    if (this.projectiles.length >= CFG.MAX_PROJECTILES) return;
    this.projectiles.push(proj);
  }

  addHazard(h) {
    if (this.level) this.level.hazards.push(h);
  }

  removeHazard(h) {
    if (this.level) {
      const idx = this.level.hazards.indexOf(h);
      if (idx >= 0) this.level.hazards.splice(idx, 1);
    }
  }

  playerHasAttackHitbox() {
    if (!this.player) return false;
    const p = this.player;
    return p.state === 'kick' || p.state === 'slide' || p.inBicycle;
  }

  getCurrentMusicZone() {
    if (!this.player) return 'street';
    if (this.bossState) return 'boss';
    if (this.player.x >= CFG.ZONES.FIELD.xStart) return 'field';
    if (this.player.x >= CFG.ZONES.STADIUM_ENTRANCE.xStart) return 'stadium';
    if (this.player.x >= CFG.ZONES.TRAINING.xStart) return 'training';
    return 'street';
  }

  update(dt) {
    if (this.state !== STATES.PLAYING && this.state !== STATES.BOSS_BATTLE) return;

    this.gameTime += dt;

    // Player input -> shooting
    if (this.player.shootCooldown <= 0) {
      if (this.input.wasPressed(CFG.KEYS.SHOOT) && this.player.kickCooldown <= 0) {
        this.handlePlayerShoot();
      }
    }

    // Update player
    this.player.update(this.input);

    // Update moving platforms
    for (const mp of this.level.movingPlatforms) {
      mp.update();
    }

    // Resolve player-platform collision
    CollisionSystem.resolvePlayerPlatforms(this.player, this.level.platforms, this.level.movingPlatforms);

    // Update enemies
    for (const e of this.level.enemies) {
      if (e.alive) e.update(this.player, this);
    }

    // Update boss
    if (this.boss && this.boss.alive && !this.boss.defeated) {
      this.boss.update(this.player, this);
    }

    // Boss activation trigger
    if (!this.bossState && this.player.x >= (this.level.bossArenaLeft || 13700)) {
      this.bossState = true;
      this.state = STATES.BOSS_INTRO;
      this.boss.state = 'intro';
      this.boss.introTimer = 120;
      this.camera.lock(this.player.x);
      this.ui.setBossIntro('Técnico Rival');
      this.ui.showScreen('screen-boss-intro');
      this.audio.startMusic('boss');
      this.ui.announce('Chefe: Técnico Rival');
      setTimeout(() => {
        this.state = STATES.BOSS_BATTLE;
        this.ui.hideAllScreens();
        this.camera.unlock();
      }, 2500);
    }

    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.update(this.level.platforms);
      if (!p.alive) {
        this.projectiles.splice(i, 1);
      }
    }

    // Update checkpoints
    for (const cp of this.level.checkpoints) {
      cp.update();
    }

    // Update collectibles
    for (const c of this.level.collectibles) {
      c.update();
    }

    // Update particles
    this.particles.update();

    // Collision checks
    CollisionSystem.checkPlayerEnemies(this.player, this.level.enemies, this);
    CollisionSystem.checkProjectilesEnemies(this.projectiles, this.level.enemies, this.player, this);
    if (this.boss && !this.boss.defeated) {
      CollisionSystem.checkProjectilesBoss(this.projectiles, this.boss, this.player, this);
    }
    CollisionSystem.checkEnemyProjectilesPlayer(this.projectiles, this.player, this);
    CollisionSystem.checkCollectibles(this.player, this.level.collectibles, this);
    CollisionSystem.checkCheckpoints(this.player, this.level.checkpoints, this);
    CollisionSystem.checkHazards(this.player, this.level.hazards, this);

    // Remove dead enemies
    for (let i = this.level.enemies.length - 1; i >= 0; i--) {
      if (!this.level.enemies[i].alive) {
        this.level.enemies.splice(i, 1);
      }
    }

    // Fall detection
    if (this.player.y > CFG.WORLD_H) {
      this.onPlayerDefeat();
    }

    // Zone tracking
    let currentZone = '';
    if (this.player.x < CFG.ZONES.TRAINING.xStart) currentZone = 'STREET';
    else if (this.player.x < CFG.ZONES.STADIUM_ENTRANCE.xStart) currentZone = 'TRAINING';
    else if (this.player.x < CFG.ZONES.FIELD.xStart) currentZone = 'STADIUM_ENTRANCE';
    else currentZone = 'FIELD';

    if (currentZone !== this.lastZone) {
      this.zoneChanged = true;
      this.lastZone = currentZone;
      this.audio.startMusic(this.getCurrentMusicZone());
    }

    // Camera
    this.camera.update(this.player.x, this.player.y);

    // HUD update (only when values change)
    this.ui.updateHUD(this);
  }

  handlePlayerShoot() {
    const p = this.player;
    const dir = p.facing;
    const kickX = p.x + (dir > 0 ? p.w : 0);
    const kickY = p.y + p.h / 2;

    if (p.inBicycle) {
      // Bicycle kick - strong diagonal shot
      const proj = new Projectile(kickX, kickY, dir * 7, -4, 'high', 'player');
      proj.damage = 2;
      proj.radius = 8;
      this.addProjectile(proj);
      this.audio.playShoot();
      return;
    }

    if (this.input.isDown(CFG.KEYS.UP) && this.input.isDown(CFG.KEYS.DOWN)) {
      // This shouldn't happen, default to standard
    }

    if (this.input.isDown(CFG.KEYS.UP) && !this.input.isDown(CFG.KEYS.DOWN)) {
      // High shot
      const proj = new Projectile(kickX, kickY, dir * 4, -7, 'high', 'player');
      proj.damage = 1;
      this.addProjectile(proj);
      this.audio.playShoot();
      p.kickCooldown = 30;
      p.highShootCooldown = 40;
      return;
    }

    if (this.input.isDown(CFG.KEYS.DOWN)) {
      // Low shot
      const proj = new Projectile(kickX, kickY, dir * 5, -1, 'low', 'player');
      proj.damage = 1;
      proj.bounce = 2;
      proj.gravity = 0.2;
      this.addProjectile(proj);
      this.audio.playShoot();
      p.kickCooldown = 25;
      p.lowShootCooldown = 35;
      return;
    }

    // Check for balãozinho (Up pressed alone)
    if (this.input.wasPressed(CFG.KEYS.UP) && this.input.balaozinhoCooldown <= 0) {
      const proj = new Projectile(kickX, kickY, dir * 1, -8, 'ball', 'player');
      proj.damage = 1;
      proj.gravity = 0.3;
      this.addProjectile(proj);
      this.audio.playShoot();
      p.kickCooldown = 35;
      p.balaozinhoCooldown = 50;
      return;
    }

    // Standard shot
    if (p.fireballAmmo > 0) {
      const proj = new Projectile(kickX, kickY, dir * 6, 0, 'fireball', 'player');
      proj.damage = 3;
      proj.radius = 24;
      p.fireballAmmo--;
      this.addProjectile(proj);
      this.audio.playShoot();
    } else {
      const proj = new Projectile(kickX, kickY, dir * 5, -1, 'ball', 'player');
      proj.damage = 1;
      this.addProjectile(proj);
      this.audio.playShoot();
    }
    p.kickCooldown = 20;
    p.shootCooldown = 25;
  }

  render() {
    if (this.state === STATES.PLAYING || this.state === STATES.BOSS_BATTLE ||
        this.state === STATES.PAUSED || this.state === STATES.BOSS_INTRO) {
      this.renderer.render(this, this.camera);
    }
  }

  loop(timestamp) {
    if (!running) return;

    const rawDt = (timestamp - lastTime) / 1000;
    const dt = Math.min(rawDt, CFG.DT_CLAMP);
    lastTime = timestamp;

    this.update(dt);
    this.render();
    this.input.endFrame();

    animFrameId = requestAnimationFrame(this.loop.bind(this));
  }

  showFatalError(msg) {
    this.state = STATES.FATAL_ERROR;
    const el = document.getElementById('overlay-fatal-error');
    if (el) {
      el.classList.add('is-active');
      el.innerHTML = '<p>Erro fatal</p><p>' + msg + '</p>';
    }
  }

  selfCheck() {
    if (!CFG.DEBUG) return;
    console.log('=== ROMÁRIO Self-Check ===');
    console.log('Canvas exists:', !!canvas);
    console.log('Context exists:', !!ctx);

    if (this.level) {
      const coins = this.level.collectibles.filter(c => c.type === 'coin').length;
      const fireballs = this.level.collectibles.filter(c => c.type === 'fireball').length;
      const checkpoints = this.level.checkpoints.length;
      const enemies = this.level.enemies.length;
      const zones = Object.keys(CFG.ZONES).length;

      console.log('Zones:', zones);
      console.log('Coins:', coins, '(expected:', CFG.TOTAL_COINS + ')');
      console.log('Fire Balls:', fireballs, '(expected:', CFG.TOTAL_FIREBALLS + ')');
      console.log('Checkpoints:', checkpoints, '(expected:', CFG.TOTAL_CHECKPOINTS + ')');
      console.log('Enemies:', enemies);
      console.log('Player max health:', this.player ? this.player.maxHealth : 'N/A');
      console.log('Starting continues:', CFG.STARTING_CONTINUES);
      console.log('Fire Ball shots per pickup:', CFG.FIREBALL_SHOTS);
      console.log('Difficulty configs:', Object.keys(CFG.DIFFICULTY).join(', '));
      console.log('=== Check Complete ===');
    }
  }

  destroy() {
    running = false;
    if (animFrameId) cancelAnimationFrame(animFrameId);
    this.input.destroy();
    this.audio.destroy();
  }
}

/* ============================================================
   INITIALIZATION
   ============================================================ */
function init() {
  game = new Game();

  // Check Canvas support
  if (!document.createElement('canvas').getContext) {
    const fallback = document.getElementById('canvas-fallback');
    if (fallback) fallback.classList.add('is-visible');
    return;
  }

  game.init();
}

// Boot when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Expose for diagnostics
window.__romario = { game: () => game, CFG, STATES };

})();
