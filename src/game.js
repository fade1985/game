// ─────────────────────────────────────────────
//  Game: controla el flujo de la partida
//  menú → edificio → plantas → pasillo y apartamentos
// ─────────────────────────────────────────────
import { W, H, WALL, DOOR_W, OUTLINE, MAX_ALLIES, DIRS, BUILDINGS, SURVIVORS, PIXEL } from './config.js';
import { rand, clamp, dist, pushOut, obstacleGap } from './utils.js';
import { Player, Ally } from './entities.js';
import { makeBoss, BOSS_TYPES, BLEACH, drawBottle } from './bosses.js';
import { Zombie, POISON, TENTACLE } from './zombies.js';
import { generateFloor, floorName } from './building.js';
import { makePlainLayout, ROOM_TYPES } from './rooms.js';
import { baseStats, rollItem, applyWorkshop, WORKSHOP } from './upgrades.js';
import { SurvivorNPC, DoorKey, WeaponProp, WeaponStash, Maniqui } from './props.js';
import { WEAPONS, randomWeapon, weaponSummary } from './weapons.js';
import { loadSave, updateSave, buildingSave } from './save.js';
import { drawRoom, sceneryOf, drawDoors, drawDoorLabels, drawFog, drawPickup, drawBullet, drawMinimap, drawEmoji as drawEmojiAt, minimapRect } from './render.js';
import { Camera, ZOOM, BOSS_ZOOM } from './camera.js';
import { outlinedText, roundBox, setTextFont } from './draw.js';
import { setGridSnap, drawSprite, hasSprite } from './sprites.js';
import { CELL, isWall, isOpen, lineClear, randomFloorPoint, wayTo } from './shapes.js';
import { getMoveVector, consumeDash, clearInput } from './input.js';
import { sfx, music, setMusicOn } from './sfx.js';

// Rastro de sangre del zombi lento: cada cuánto deja una mancha, cuánto dura y cuánto tarda en borrarse al final
const TRAIL = { step: 9, life: 8, fade: 2.5, max: 400, color: '#680c06', dark: '#4a0804' };

// Charcos que dejan los proyectiles en parábola: moco venenoso y lejía
const HAZARDS = {
  poison: { ...POISON, fill: '#8fd13f', stroke: '#4f772d', bubble: '#c7f27a', drop: '#9be33b' },
  bleach: { ...BLEACH, fill: '#e9f8ff', stroke: '#2f86c4', bubble: '#ffffff', drop: '#4cb4f0' },
};

// Dónde va el mueble de cada arma en la pared de arriba de la sala de mantenimiento, en el orden de
// WEAPONS. Hay sitio para seis; si algún día hay más armas, harán falta más huecos.
const STASH_X = [140, 240, 342, 640, 760, 850];

// Vida de los jefes según la planta (la portera solo sale en la azotea)
const bossHpMul = (type, floorNum) => (type === 'boss' ? 1 : 1 + (floorNum - 1) * 0.25);
// Cuánto más duros son los zombis en cada planta (provisional: se equilibra en la fase 3 del mapa nuevo)
const FLOOR_HP = 0.15;
const NOPE_EVERY = 1.6;    // cada cuánto se repite el aviso de una puerta que no se abre
const NOTICE = 330;        // a qué distancia nota un zombi dormido al conserje, si lo ve
const ALERT = 170;         // un zombi que despierta despierta a los que tiene así de cerca
const NOISE = 430;         // hasta dónde se oye un disparo (despierta aunque haya tabiques)

// Iconos pixel art de los objetos (los mismos del CSS); 'zapatillas' reutiliza el del dash
const ITEM_ICONS = {};
function itemIcon(id) {
  if (!ITEM_ICONS[id]) {
    ITEM_ICONS[id] = new Image();
    ITEM_ICONS[id].src = `assets/ui/iconos/${id === 'zapatillas' ? 'dash' : id}.png`;
  }
  return ITEM_ICONS[id];
}

const KEY_CHANCE = 0.07;   // probabilidad de que un zombi suelte una llave 🔑
const HEART_CHANCE = 0.05; // ...o un corazón
const HEART_HEAL = 15;
const BULLET_LIFT = 22;    // pixel art: altura a la que se dibujan las balas de un arma dibujada (la del cuerpo de un zombi)

const formatTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

const SLIDE = 0.4; // duración del deslizamiento de cámara al cruzar una puerta
const FADE = 0.6;  // duración de cada mitad del fundido al cambiar de planta

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export class Game {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ui = ui;
    this.state = 'menu'; // 'menu' | 'playing' | 'over'
    this.paused = false;
    this.time = 0;
    this.shakeAmt = 0;
    this.camera = new Camera();
    // El mundo se dibuja en un lienzo pequeño (un píxel de dibujo = PIXEL unidades) que luego se amplía
    // sin suavizado. Su tamaño se ajusta en cada fotograma a lo que enseña la cámara.
    this.low = document.createElement('canvas');
    this.lowCtx = this.low.getContext('2d');
    setTextFont('"ZS UI", "Pixelify Sans"');
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
    this.setupMenuScene();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(r.width * dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * dpr));
    // El juego ocupa toda la ventana: la interfaz mide H de alto y lo que haga falta de ancho
    this.scale = this.canvas.height / H;
    this.ow = this.canvas.width / this.scale;
    this.camera.aspect = this.canvas.width / this.canvas.height;
    this.camera.clampToRoom();
  }

  // Medidas del mapa en el que estamos (el pasillo, un apartamento...)
  get rw() { return this.room.layout.w; }
  get rh() { return this.room.layout.h; }

  // ═════════════ Pantallas ═════════════

  resetRoomState() {
    this.hazards = [];   // charcos de veneno en el suelo
    this.trail = [];     // rastro de sangre del zombi lento
    this.lobs = [];      // mocos volando
    this.enemies = [];
    this.bullets = [];
    this.particles = [];
    this.texts = [];
    this.timers = [];
  }

  setupMenuScene() {
    this.resetRoomState();
    this.pickups = [];
    this.banner = null;
    this.transition = null;
    this.floor = null;
    this.fade = null;
    this.room = { type: 'menu', exits: [], props: [], layout: makePlainLayout('menu') };
    this.camera.setRoom(this.rw, this.rh);
    this.doorOpen = 1;
    this.stats = baseStats();
    this.player = new Player(this.stats);
    this.player.x = W / 2; this.player.y = H / 2 + 60;
    this.allies = [];
    this.menuTarget = { x: W / 2, y: H / 2, t: 0 };
    this.camera.targetZoom = ZOOM;
    this.camera.snap(this.player);
  }

  goMenu() {
    this.state = 'menu';
    this.paused = false;
    this.setupMenuScene();
    this.ui.showHud(false);
    music.play('menu');
    this.ui.showMenu(loadSave(), { play: () => this.showBuildings(), workshop: () => this.showWorkshop() });
  }

  // Selector de edificios
  showBuildings() {
    this.ui.showBuildings(loadSave(), BUILDINGS, { pick: (id) => this.newRun(id), back: () => this.goMenu() });
  }

  // Taller: mejoras permanentes que se compran con llaves
  showWorkshop() {
    this.ui.showWorkshop(loadSave(), WORKSHOP, {
      buy: (id) => {
        const up = WORKSHOP.find((u) => u.id === id);
        let bought = false;
        updateSave((s) => {
          const lvl = s.workshop[id] || 0;
          const price = up.cost[lvl];
          if (lvl >= up.max || s.keys < price) return;
          s.keys -= price;
          s.workshop[id] = lvl + 1;
          bought = true;
        });
        if (bought) sfx.buy(); else sfx.nope();
        this.showWorkshop();
        return bought;
      },
      back: () => this.goMenu(),
    });
  }

  newRun(buildingId = this.building?.id || 'apartamentos') {
    this.building = BUILDINGS[buildingId];
    const save = updateSave((s) => { s.runs++; buildingSave(s, buildingId).runs++; });
    this.stats = applyWorkshop(baseStats(), save.workshop);
    this.player = new Player(this.stats);
    this.allies = [];
    this.kills = 0;
    this.runKeys = 0;          // llaves recogidas en esta partida
    this.wallet = save.keys;   // llaves totales (para el HUD)
    this.runTime = 0;
    this.floorNum = 1;
    this.fade = null;
    // orden en que aparecerán los supervivientes en este edificio
    this.survivorOrder = shuffle(Object.values(SURVIVORS));
    this.items = [];            // objetos conseguidos
    this.itemsSeen = new Set(); // objetos que ya han salido (para no repetir)
    // Mejora "Mochila" del Taller: empiezas con un objeto al azar
    if (save.workshop.mochila) {
      const it = rollItem(this.itemsSeen);
      it.apply(this);
      this.items.push(it);
    }
    this.state = 'playing';
    this.paused = false;
    clearInput();
    this.ui.hide();
    this.ui.showHud(true);
    this.startFloor();
  }

  // Nombre de la planta en la que estamos: "Planta baja", "2ª planta", "Azotea"
  get floorLabel() { return floorName(this.floorNum, this.building.floors); }

  // Genera una planta nueva y coloca al conserje donde empieza: en la sala de mantenimiento en la
  // planta baja y, en las demás, al principio del pasillo (o de la azotea)
  startFloor() {
    this.floor = generateFloor(this.floorNum, this.building.floors);
    this.transition = null;
    this.room = null;

    // La llave del mini jefe y el superviviente de esta planta, cada uno en su habitación
    const { key, survivor } = this.floor;
    if (key) key.room.props.push(new DoorKey(key.name, key.x, key.y));
    if (survivor) {
      const npc = new SurvivorNPC(this.survivorOrder[(this.floorNum - 1) % this.survivorOrder.length]);
      npc.x = survivor.x; npc.y = survivor.y;
      survivor.room.props.push(npc);
    }

    // Modo de pruebas (añade ?pruebas a la dirección): las teclas 1-6 invocan zombis (ver main.js)
    const params = new URLSearchParams(location.search);
    this.testMode = params.has('pruebas');
    // Sala de mantenimiento: cada arma espera en su mueble (taquilla, cajón...) para elegir con cuál
    // empezar. Solo se abren las que ya has encontrado en alguna partida; con ?armas (o ?pruebas)
    // se ven todas abiertas, sin tocar el guardado.
    const unlocked = loadSave().weapons;
    const showAll = this.testMode || params.has('armas');
    if (this.floorNum === 1) {
      Object.values(WEAPONS).slice(0, STASH_X.length).forEach((w, i) => {
        const locked = !showAll && w.id !== 'fregona' && !unlocked.includes(w.id);
        this.floor.start.props.push(new WeaponStash(w, STASH_X[i], locked));
      });
    }
    // Sala de exposición (añade ?sala=venenoso): ese zombi posa quieto en la sala de mantenimiento,
    // al lado del conserje, para ver cómo queda su sprite
    const pose = params.get('sala');
    if (this.floorNum === 1 && pose) this.floor.start.props.push(new Maniqui(`zombi-${pose}`, W / 2 + 80, H / 2 + 40));
    this.enterRoom(this.floor.start, this.floor.startExit);
    if (this.floorNum > 1) return; // en las demás plantas el cartel lo pone el propio mapa al entrar
    // primera partida: recordatorio de los controles
    const firstTime = loadSave().runs <= 1;
    this.banner = {
      icon: this.building.id,
      title: this.building.name,
      sub: this.testMode ? 'Modo pruebas · teclas 1-6: zombis · 7-8: jefes'
        : firstTime ? 'Muévete con WASD o flechas · Espacio para esquivar'
        : showAll || unlocked.length ? 'Elige tu arma antes de salir' : this.floorLabel,
      t: 0,
    };
  }

  openPause() {
    if (this.state !== 'playing' || this.paused || this.player.dead) return;
    this.paused = true;
    this.pauseOpen = true;
    clearInput();
    this.ui.showPause(this, {
      resume: () => this.closePause(),
      music: () => {
        const on = !loadSave().settings.music;
        updateSave((s) => { s.settings.music = on; });
        setMusicOn(on);
        this.paused = false; this.pauseOpen = false;
        this.openPause(); // vuelve a dibujar la pausa con el botón actualizado
      },
      quit: () => { this.pauseOpen = false; this.endRun(false, true); },
    });
  }

  closePause() {
    if (!this.pauseOpen) return;
    this.pauseOpen = false;
    this.paused = false;
    this.ui.hide();
  }

  endRun(win, quit = false) {
    this.state = 'over';
    this.paused = false;
    const id = this.building.id;
    const save = updateSave((s) => {
      s.bestFloor = Math.max(s.bestFloor || 0, this.floorNum);
      s.kills += this.kills;
      const b = buildingSave(s, id);
      b.bestFloor = Math.max(b.bestFloor, win ? this.building.floors : this.floorNum);
      if (win) {
        s.wins++;
        b.wins++;
        b.completed = true;
        b.bestTime = b.bestTime ? Math.min(b.bestTime, this.runTime) : this.runTime;
      }
    });
    const record = win && save.buildings[id].bestTime === this.runTime;
    this.ui.showHud(false);
    if (!quit) music.jingle(win ? 'win' : 'lose');
    if (quit) { this.goMenu(); return; }
    const rooms = this.floor.apartments;
    this.ui.showEnd(
      {
        win,
        title: win ? '¡Edificio completado!' : '¡Derrota!',
        sub: win
          ? `Has limpiado los ${this.building.name} de arriba abajo`
          : `Caíste en la ${this.floorLabel.toLowerCase()} de los ${this.building.name}`,
        kills: this.kills,
        explored: `${rooms.filter((r) => r.visited).length} / ${rooms.length}`,
        floors: `${win ? this.building.floors : this.floorNum - 1} / ${this.building.floors}`,
        team: this.allies.map((a) => a.def.icon).join(' ') || '—',
        keys: this.runKeys,
        wallet: save.keys,
        time: win ? `${formatTime(this.runTime)}${record ? ' · ¡récord!' : ''}` : null,
      },
      { retry: () => this.newRun(), workshop: () => this.showWorkshop(), menu: () => this.goMenu() },
    );
  }

  // ═════════════ Mapas y puertas ═════════════

  // Entra en un mapa (el pasillo, un apartamento, la azotea...). `via` es la puerta de ese mapa por la
  // que aparece el conserje (null: en el centro, al empezar la partida).
  enterRoom(room, via = null) {
    if (this.room && this.room.pickups) this.room.pickups = this.pickups; // cada mapa recuerda lo que quedó en su suelo
    this.resetRoomState();
    this.room = room;
    this.pickups = room.pickups;
    const firstVisit = !room.visited;
    room.visited = true;
    const isBoss = room.type === 'miniboss' || room.type === 'boss';
    if (firstVisit && isBoss) {
      const boss = BOSS_TYPES[room.type];
      this.banner = { icon: boss.icon === '👑' ? 'corona' : 'jefe', title: boss.name, sub: room.type === 'boss' ? 'Azotea · ¡El último combate del edificio!' : `${room.name} · ¡Derrótalo para seguir subiendo!`, t: 0 };
    } else if (firstVisit && room.type === 'corridor') {
      // al pisar el pasillo por primera vez: en qué planta estamos y qué hay que buscar
      this.banner = { title: this.floor.name, sub: `Busca la llave del ${this.floor.boss.name} en los apartamentos`, t: 0 };
    }

    // Colocamos al conserje justo delante de la puerta por la que entra
    const p = this.player;
    const IN = p.r + 34;
    const RW = this.rw, RH = this.rh;
    if (!via) { p.x = RW / 2; p.y = RH / 2 + 40; }
    else if (via.dir === 'down') { p.x = via.at; p.y = RH - WALL - IN; }
    else if (via.dir === 'up') { p.x = via.at; p.y = WALL + IN; }
    else if (via.dir === 'right') { p.x = RW - WALL - IN; p.y = via.at; }
    else { p.x = WALL + IN; p.y = via.at; }
    if (via) { p.vx *= 0.3; p.vy *= 0.3; }
    this.allies.forEach((a) => { a.x = p.x + rand(-20, 20); a.y = p.y + rand(-20, 20); });

    this.waveIdx = 0;
    this.waveDelay = room.cleared ? 0 : 0.6;
    // Los zombis de un apartamento ya están dentro, dormidos, cada uno en su habitación
    if (!room.cleared) {
      for (const s of room.horde) {
        const z = new Zombie(s.type, s.x, s.y, 1 + (room.dist - 1) * 0.12 + (this.floorNum - 1) * FLOOR_HP);
        z.spawnT = 0;
        z.asleep = true;
        z.zone = s.zone;
        this.enemies.push(z);
      }
    }
    this.updateFog(0);
    // cámara: con un jefe delante se aleja un poco para ver sus ataques
    this.camera.targetZoom = !room.cleared && isBoss ? BOSS_ZOOM : ZOOM;
    this.camera.setRoom(RW, RH);
    this.camera.snap(this.player);
    music.play(!room.cleared && isBoss ? 'boss' : 'explore');
    // Las puertas entran abiertas y se cierran de golpe si hay enemigos:
    // de un apartamento no se sale hasta haberlo limpiado
    this.doorOpen = 1;
  }

  // Cruza una puerta: el mapa de este lado sale deslizándose y entra el de detrás
  goThroughExit(ex) {
    this.transition = { dir: ex.dir, t: 0, from: this.room, cam: { left: this.camera.left, top: this.camera.top } };
    this.enterRoom(ex.to, ex.back);
    sfx.door();
  }

  // Aviso de una puerta que no se abre (sin repetirlo sin parar mientras se la empuja)
  nope(ex) {
    if (this.nopeT > 0 || !ex.msg) return;
    this.nopeT = NOPE_EVERY;
    sfx.nope();
    this.floatText(this.player.x, this.player.y - 54, ex.msg, '#ffd23f', 17);
  }

  spawnWave(types) {
    const mul = 1 + (this.room.dist - 1) * 0.12 + (this.floorNum - 1) * FLOOR_HP;
    for (const t of types) {
      if (t === 'miniboss' || t === 'boss') {
        // el jefe aparece en el lado contrario al jugador
        const p = this.player;
        const x = clamp(this.rw / 2 + (this.rw / 2 - p.x) * 0.6, WALL + 120, this.rw - WALL - 120);
        const y = clamp(this.rh / 2 + (this.rh / 2 - p.y) * 0.6, WALL + 110, this.rh - WALL - 110);
        this.enemies.push(makeBoss(t, x, y, bossHpMul(t, this.floorNum)));
        sfx.boss();
        this.shake(10);
        continue;
      }
      const pos = this.findSpawnPoint();
      this.enemies.push(new Zombie(t, pos.x, pos.y, mul));
    }
  }

  spawnEnemy(type, x, y) {
    const mul = 1 + (this.floorNum - 1) * FLOOR_HP;
    x = clamp(x, WALL + 30, this.rw - WALL - 30);
    y = clamp(y, WALL + 30, this.rh - WALL - 30);
    const e = BOSS_TYPES[type] ? makeBoss(type, x, y, bossHpMul(type, this.floorNum)) : new Zombie(type, x, y, mul);
    this.enemies.push(e);
    return e;
  }

  findSpawnPoint() {
    const layout = this.room.layout;
    for (let i = 0; i < 60; i++) {
      const pt = { x: rand(WALL + 50, this.rw - WALL - 50), y: rand(WALL + 50, this.rh - WALL - 50) };
      if (dist(pt, this.player) < 260) continue;
      if (!isOpen(layout, pt.x, pt.y, 30)) continue; // dentro de un muro o pegado a él
      if (layout.obstacles.some((o) => obstacleGap(o, pt) < 40)) continue;
      return pt;
    }
    const far = { x: this.rw - this.player.x, y: this.rh - this.player.y };
    return isOpen(layout, far.x, far.y, 30) ? far : randomFloorPoint(layout, 30);
  }

  roomCleared() {
    this.room.cleared = true;
    this.camera.targetZoom = ZOOM;
    for (const a of this.allies) if (a.onRoomCleared) a.onRoomCleared(this);
    sfx.clear();
    this.floatText(this.player.x, this.player.y - 50, '¡Despejado!', '#80ed99', 24);
    this.later(0.25, () => sfx.door());

    const type = this.room.type;
    if (type === 'miniboss') {
      // se abren las escaleras de emergencia, al fondo del pasillo
      music.play('explore');
      this.floor.stairs.locked = null;
      const next = floorName(this.floorNum + 1, this.building.floors).toLowerCase();
      this.banner = { title: '¡Mini jefe derrotado!', sub: `Las escaleras de emergencia están abiertas: sube a la ${next}`, t: 0 };
    } else if (type === 'boss') {
      this.banner = { title: '¡EDIFICIO COMPLETADO!', sub: `Los ${this.building.name} están a salvo`, t: 0 };
      this.later(2.8, () => this.endRun(true));
    } else if (this.room.props.some((pr) => pr.kind === 'survivor' && !pr.taken)) {
      this.later(0.9, () => this.floatText(this.player.x, this.player.y - 50, '¡Ve a por el superviviente!', '#ffd23f', 20));
    }
  }

  // Cosas del mapa: muebles con arma, la llave del mini jefe, supervivientes y armas en el suelo
  updateProps() {
    const p = this.player;
    if (p.dead) return;
    for (const pr of this.room.props) {
      if (pr.taken) continue;
      if (pr.kind === 'stash') {
        // Mueble con arma: basta con arrimarse. La que llevabas vuelve sola a su mueble.
        if (!pr.locked && p.weapon.id !== pr.weapon.id && obstacleGap(pr, p) < p.r + 6) {
          p.weapon = pr.weapon;
          p.swing = null;
          this.banner = { icon: p.weapon.id, title: p.weapon.name, sub: weaponSummary(p.weapon), t: 0 };
          this.burst(pr.x, pr.y, '#ffd23f', 10, 16);
          sfx.buy();
        }
        continue;
      }
      if (dist(pr, p) > pr.r + p.r + 4) { pr.armed = true; continue; } // hay que salir y volver a pisarlo
      if (pr.kind === 'doorkey') {
        pr.taken = true;
        this.floor.hasKey = true;
        this.banner = { icon: 'llave', title: pr.name, sub: 'Ya puedes abrir su puerta, en el pasillo', t: 0 };
        this.burst(pr.x, pr.y, '#dfe7f2', 14, 18);
        sfx.buy();
      } else if (pr.kind === 'survivor' && this.room.cleared) {
        pr.taken = true;
        this.addAlly(pr.def, pr.x, pr.y);
        this.banner = { icon: pr.def.id, title: `¡${pr.def.name} se une!`, sub: pr.def.desc, t: 0 };
        this.burst(pr.x, pr.y, pr.def.color, 14, 16);
        sfx.clear();
      } else if (pr.kind === 'weapon' && pr.armed) {
        // Cambiamos de arma: la que llevabas se queda en el suelo
        const old = this.player.weapon;
        this.player.weapon = pr.weapon;
        this.player.swing = null;
        pr.weapon = old;
        pr.armed = false; // hay que alejarse antes de poder volver a cogerla
        // la primera vez que encuentras un arma queda desbloqueada para elegirla al empezar
        const isNew = this.unlockWeapon(this.player.weapon.id);
        this.banner = {
          title: `${this.player.weapon.icon} ${this.player.weapon.name}`,
          sub: isNew ? '¡Desbloqueada! Ya puedes elegirla al empezar' : weaponSummary(this.player.weapon),
          t: 0,
        };
        this.burst(pr.x, pr.y, '#ffd23f', 10, 16);
        sfx.buy();
      }
    }
  }

  // Apunta en el guardado un arma recién encontrada. Devuelve true si era nueva.
  unlockWeapon(id) {
    if (id === 'fregona' || loadSave().weapons.includes(id)) return false;
    updateSave((s) => { s.weapons.push(id); });
    return true;
  }

  goNextFloor() {
    sfx.door();
    clearInput();
    this.fade = {
      t: 0,
      phase: 'out',
      action: () => {
        this.floorNum++;
        this.startFloor();
      },
    };
  }

  addAlly(def, x = this.player.x, y = this.player.y + 30) {
    if (this.allies.length >= MAX_ALLIES) return false;
    const a = new Ally(def, x, y);
    this.allies.push(a);
    this.allies.forEach((al, i) => { al.idx = i; });
    return true;
  }

  healPlayer(n) {
    const p = this.player;
    const before = p.hp;
    p.hp = Math.min(this.stats.maxHp, p.hp + n);
    const healed = Math.round(p.hp - before);
    if (healed > 0) this.floatText(p.x, p.y - 44, `+${healed}`, '#80ed99', 20);
  }

  // ═════════════ Bucle principal ═════════════

  later(seconds, fn) {
    this.timers.push({ t: seconds, fn });
  }

  update(dt) {
    this.time += dt;
    if (this.state === 'menu') { this.updateMenu(dt); return; }
    if (this.state !== 'playing' || this.paused) return;

    // Pausa de impacto al golpear (unas centésimas de segundo)
    if (this.hitStop > 0) { this.hitStop -= dt; return; }

    // Fundido a negro al cambiar de planta
    if (this.fade) {
      const f = this.fade;
      f.t += dt;
      if (f.phase === 'out' && f.t >= FADE) { f.action(); f.phase = 'in'; f.t = 0; }
      else if (f.phase === 'in' && f.t >= FADE) this.fade = null;
      if (this.fade && this.fade.phase === 'out') return;
    }

    // Mientras la cámara se desliza al cruzar una puerta, el juego se congela
    if (this.transition) {
      this.transition.t += dt;
      if (this.transition.t >= SLIDE) this.transition = null;
      return;
    }
    this.updatePlay(dt);
  }

  updateMenu(dt) {
    // En el menú el conserje pasea solo por la habitación
    const m = this.menuTarget;
    m.t -= dt;
    if (m.t <= 0) {
      m.x = rand(W * 0.25, W * 0.75); m.y = rand(H * 0.45, H * 0.75); m.t = rand(1.5, 3);
    }
    const dx = m.x - this.player.x, dy = m.y - this.player.y;
    const d = Math.hypot(dx, dy);
    const mv = d > 20 ? { x: (dx / d) * 0.6, y: (dy / d) * 0.6 } : { x: 0, y: 0 };
    this.player.update(dt, this, mv, false);
    this.camera.update(dt, this.player);
    this.updateParticles(dt);
  }

  updatePlay(dt) {
    const p = this.player;

    // temporizadores programados con later()
    for (const t of this.timers) t.t -= dt;
    const due = this.timers.filter((t) => t.t <= 0);
    this.timers = this.timers.filter((t) => t.t > 0);
    due.forEach((t) => t.fn());
    if (this.state !== 'playing' || this.paused) return;

    this.runTime += dt;
    if (!p.dead) p.update(dt, this, getMoveVector(), consumeDash());
    this.camera.update(dt, p);
    for (const a of this.allies) a.update(dt, this);

    this.updateWaves(dt);
    this.updateFog(dt);

    for (const e of this.enemies) {
      e.update(dt, this);
      if (e.active && e.dmg > 0 && !p.dead && dist(e, p) < e.r + p.r - 4) p.hurt(e.dmg, this);
    }
    this.separateEnemies();
    this.enemies = this.enemies.filter((e) => !e.dead);

    this.updateBullets(dt);
    this.updateHazards(dt);
    this.updatePickups(dt);
    this.updateParticles(dt);
    this.updateDoors(dt);
    this.updateProps();

    this.shakeAmt *= Math.exp(-dt * 10);
    this.hurtFlash = Math.max(0, (this.hurtFlash || 0) - dt);
    // latido con poca vida
    if (!p.dead && p.hp < this.stats.maxHp * 0.3) {
      this.beatT = (this.beatT || 0) - dt;
      if (this.beatT <= 0) { this.beatT = 0.9; sfx.heartbeat(); }
    }
    if (this.banner) this.banner.t += dt;
    this.ui.updateHud(this);
  }

  // Los jefes aparecen al entrar; los zombis de un apartamento ya estaban dentro. En los dos casos
  // el mapa queda limpio cuando no queda ninguno.
  updateWaves(dt) {
    const waves = this.room.waves;
    if (this.room.cleared) return;
    if (!waves.length) {
      if (this.enemies.length === 0) this.roomCleared();
      return;
    }
    if (this.waveDelay > 0) {
      this.waveDelay -= dt;
      if (this.waveDelay <= 0) this.spawnWave(waves[this.waveIdx]);
      return;
    }
    if (this.enemies.length === 0) {
      if (this.waveIdx < waves.length - 1) {
        this.waveIdx++;
        this.waveDelay = 0.7;
      } else {
        this.roomCleared();
      }
    }
  }

  // Abre o cierra las puertas y mira si el conserje empuja alguna
  updateDoors(dt) {
    const target = this.room.cleared ? 1 : 0;
    const before = this.doorOpen;
    this.doorOpen = clamp(this.doorOpen + Math.sign(target - this.doorOpen) * dt * (target ? 2.5 : 6), 0, 1);
    if (before === 1 && this.doorOpen < 1) { sfx.slam(); this.shake(4); } // ¡portazo!
    this.nopeT = Math.max(0, (this.nopeT || 0) - dt);

    const p = this.player;
    if (this.doorOpen < 1 || p.dead) return;
    const half = DOOR_W / 2 - 8;
    for (const ex of this.room.exits) {
      // ¿está pegado al muro, delante del hueco de esta puerta?
      const touching = ex.dir === 'up' ? p.y - p.r <= WALL + 2 && Math.abs(p.x - ex.at) < half
        : ex.dir === 'down' ? p.y + p.r >= this.rh - WALL - 2 && Math.abs(p.x - ex.at) < half
        : ex.dir === 'left' ? p.x - p.r <= WALL + 2 && Math.abs(p.y - ex.at) < half
        : p.x + p.r >= this.rw - WALL - 2 && Math.abs(p.y - ex.at) < half;
      if (!touching) continue;
      if (ex.locked === 'key' && this.floor.hasKey) {
        // la llave del mini jefe se gasta al abrir su puerta
        ex.locked = null;
        this.floor.hasKey = false;
        this.floor.keyUsed = true;
        this.floatText(p.x, p.y - 54, '¡Abierta!', '#80ed99', 20);
        sfx.buy();
        this.nopeT = 0.5; // un momento para ver cómo se abre antes de cruzar
        return;
      }
      if (ex.locked) { this.nope(ex); return; }
      if (this.nopeT > 0 && ex.to && ex.to.type === 'miniboss' && !ex.to.visited) return;
      if (ex.kind === 'stairs') { this.goNextFloor(); return; }
      if (ex.to) { this.goThroughExit(ex); return; }
    }
  }

  separateEnemies() {
    const es = this.enemies;
    for (let i = 0; i < es.length; i++) {
      for (let j = i + 1; j < es.length; j++) {
        const a = es[i], b = es[j];
        if (!a.active || !b.active) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const overlap = a.r + b.r - d;
        if (overlap > 0) {
          const wa = a.isBoss ? 0 : b.isBoss ? 1 : 0.5;
          a.x -= (dx / d) * overlap * wa; a.y -= (dy / d) * overlap * wa;
          b.x += (dx / d) * overlap * (1 - wa); b.y += (dy / d) * overlap * (1 - wa);
        }
      }
    }
  }

  updateBullets(dt) {
    const p = this.player;
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      // pixel art: la bala sale a la altura del cañón y baja enseguida a la del cuerpo (solo el dibujo)
      if (b.lift > BULLET_LIFT) b.lift += (BULLET_LIFT - b.lift) * (1 - Math.exp(-dt * 14));
      const outside = isWall(this.room.layout, b.x, b.y);
      if (outside || this.room.layout.obstacles.some((o) => obstacleGap(o, b) < b.r * 0.5)) {
        b.dead = true;
        if (b.friendly) this.bulletImpact(b, true); else this.puff(b.x, b.y, b.color);
        continue;
      }
      if (b.friendly) {
        for (const e of this.enemies) {
          if (!e.active || b.hit.has(e)) continue;
          if (dist(e, b) < e.r + b.r) {
            b.hit.add(e);
            const l = Math.hypot(b.vx, b.vy) || 1;
            e.hurt(b.dmg, b.crit, b.vx / l, b.vy / l, this, b.knock ?? 1);
            this.bulletImpact(b, false);
            if (b.pierce-- <= 0) { b.dead = true; break; }
          }
        }
      } else if (!p.dead && p.invuln <= 0 && dist(p, b) < p.r + b.r - 2) {
        p.hurt(b.dmg, this);
        b.dead = true;
      }
    }
    this.bullets = this.bullets.filter((b) => !b.dead && b.life > 0);
  }

  updatePickups(dt) {
    const p = this.player;
    const needsHp = p.hp < this.stats.maxHp;
    for (const pk of this.pickups) {
      pk.t += dt;
      const fr = Math.exp(-dt * 5);
      pk.vx *= fr; pk.vy *= fr;
      const dx = p.x - pk.x, dy = p.y - pk.y;
      const d = Math.hypot(dx, dy) || 1;
      // Las llaves siempre vienen a ti; los corazones, solo si te falta vida
      const wanted = pk.kind === 'key' || needsHp;
      if (!p.dead && wanted && pk.t > 0.4 && d < this.stats.magnet) {
        pk.vx += (dx / d) * 2200 * dt;
        pk.vy += (dy / d) * 2200 * dt;
        const sp = Math.hypot(pk.vx, pk.vy);
        if (sp > 650) { pk.vx *= 650 / sp; pk.vy *= 650 / sp; }
      }
      pk.x = clamp(pk.x + pk.vx * dt, WALL + 14, this.rw - WALL - 14);
      pk.y = clamp(pk.y + pk.vy * dt, WALL + 14, this.rh - WALL - 14);
      for (const b of this.room.layout.blocks) pushOut(pk, b);
      for (const o of this.room.layout.obstacles) pushOut(pk, o); // que nada se quede debajo de un mueble
      if (!p.dead && wanted && pk.t > 0.25 && d < p.r + 12) this.collect(pk);
    }
    this.pickups = this.pickups.filter((pk) => !pk.dead);
    this.room.pickups = this.pickups;
  }

  collect(pk) {
    pk.dead = true;
    if (pk.kind === 'heart') {
      this.healPlayer(HEART_HEAL);
      sfx.gem();
    } else if (pk.kind === 'key') {
      // las llaves se guardan al momento: no se pierden aunque mueras
      this.runKeys++;
      this.wallet = updateSave((s) => { s.keys++; s.totalKeys++; }).keys;
      this.floatText(pk.x, pk.y - 20, '+1 llave', '#ffd23f', 20);
      sfx.coin();
    }
  }

  updateParticles(dt) {
    for (const pt of this.particles) {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      const fr = Math.exp(-dt * 4);
      pt.vx *= fr; pt.vy *= fr;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
    for (const t of this.texts) {
      t.t += dt;
      t.y += t.vy * dt;
      t.vy *= Math.exp(-dt * 3);
    }
    this.texts = this.texts.filter((t) => t.t < t.life);
  }

  // ═════════════ Combate ═════════════

  collideWorld(ent) {
    ent.x = clamp(ent.x, WALL + ent.r, this.rw - WALL - ent.r);
    ent.y = clamp(ent.y, WALL + ent.r, this.rh - WALL - ent.r);
    for (const b of this.room.layout.blocks) pushOut(ent, b); // tabiques de los apartamentos
    for (const o of this.room.layout.obstacles) pushOut(ent, o);
    for (const pr of this.room.props) if (pr.solid) pushOut(ent, pr);
  }

  // Hacia dónde tiene que andar un enemigo para llegar al jugador rodeando muros y muebles
  // (null si puede ir en línea recta, que es lo normal)
  wayTo(ent) {
    return wayTo(this.room.layout, ent, this.player);
  }

  // ¿Ve este enemigo al conserje, o hay un tabique en medio?
  sees(ent) {
    return lineClear(this.room.layout, ent.x, ent.y, this.player.x, this.player.y);
  }

  // ═════════════ Habitaciones de un apartamento ═════════════

  // En qué habitación del apartamento cae un punto (null en un tabique, en el hueco de una puerta
  // o en un mapa sin habitaciones)
  zoneAt(x, y) {
    const l = this.room.layout;
    if (!l.zones) return null;
    return l.zones[l.owner[Math.floor(y / CELL) * l.cols + Math.floor(x / CELL)]] || null;
  }

  // ¿Está esto en una habitación que aún no se ha pisado? (entonces ni se dibuja ni se le apunta)
  hidden(ent) {
    const z = this.zoneAt(ent.x, ent.y);
    return !!z && z.fog > 0.5;
  }

  // Descubre la habitación en la que está el conserje y, si está en una puerta o pegado a ella,
  // las dos que comunica; y va aclarando las descubiertas
  updateFog(dt) {
    const l = this.room && this.room.layout;
    if (!l || !l.zones) return;
    const p = this.player;
    const c = Math.floor(p.x / CELL), r = Math.floor(p.y / CELL);
    const here = l.zones[l.owner[r * l.cols + c]];
    if (here) here.seen = true;
    for (const d of l.inner) {
      if (c >= d.c - 1 && c <= d.c + d.w && r >= d.r - 1 && r <= d.r + d.h) l.zones[d.a].seen = l.zones[d.b].seen = true;
    }
    for (const z of l.zones) if (z.seen && z.fog > 0) z.fog = Math.max(0, z.fog - dt * 3.5);
  }

  // ¿Nota este zombi dormido al conserje? Si entra en su habitación, o si lo ve de cerca
  notices(z) {
    const p = this.player;
    if (p.dead) return false;
    const zone = this.zoneAt(p.x, p.y);
    if (zone && zone.id === z.zone) return true;
    return dist(z, p) < NOTICE && this.sees(z);
  }

  // Un zombi que despierta arrastra a los dormidos que tiene cerca y a la vista (con un pequeño retraso)
  wakeNear(z) {
    for (const e of this.enemies) {
      if (e !== z && e.asleep && dist(e, z) < ALERT && lineClear(this.room.layout, e.x, e.y, z.x, z.y)) this.later(rand(0.15, 0.4), () => e.wake(this));
    }
  }

  // Un ruido fuerte (un disparo) despierta a los dormidos que haya cerca, aunque no vean nada
  noise(x, y, radius = NOISE) {
    for (const e of this.enemies) if (e.asleep && Math.hypot(e.x - x, e.y - y) < radius) this.later(rand(0.1, 0.5), () => e.wake(this));
  }

  nearestEnemy(x, y, range) {
    let best = null, bd = range;
    for (const e of this.enemies) {
      if (!e.active) continue;
      // con la cámara cerca solo se apunta a lo que se ve en pantalla
      if (!this.camera.inView(e, 30)) continue;
      // ni a lo que queda detrás de un muro o en una habitación a oscuras
      if (!lineClear(this.room.layout, x, y, e.x, e.y) || this.hidden(e)) continue;
      const d = Math.hypot(e.x - x, e.y - y) - e.r;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // Dispara una o varias balas aliadas. `o` admite: dmg, count, spread, jitter,
  // speed, life, pierce, knock, color, r, x, y (punto de salida) y lift (altura a la que se dibuja al salir)
  fireVolley(src, angle, o) {
    if (src === this.player) this.noise(src.x, src.y);
    const n = o.count || 1;
    const spread = o.spread ?? 0.16;
    for (let i = 0; i < n; i++) {
      const off = n > 1 ? (i / (n - 1) - 0.5) * spread * (n > 2 ? 1 : 0.6) : 0;
      const a = angle + off + (Math.random() - 0.5) * (o.jitter || 0);
      const crit = Math.random() < this.stats.crit;
      const speed = (o.speed || 560) * (o.jitter ? 0.9 + Math.random() * 0.2 : 1);
      const r = o.r || 7;
      this.bullets.push({
        x: o.x ?? src.x + Math.cos(a) * src.r,
        y: o.y ?? src.y + Math.sin(a) * src.r,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        r: crit ? r + 3 : r,
        dmg: crit ? o.dmg * 2 : o.dmg,
        crit,
        pierce: o.pierce || 0,
        knock: o.knock ?? 1,
        friendly: true,
        color: crit ? '#ffd23f' : (o.color || '#fff6d5'),
        life: o.life || 1.2,
        hit: new Set(),
        lift: o.lift || 0,
      });
    }
  }

  // Golpe cuerpo a cuerpo: daña a todo lo que esté dentro del abanico
  // y además rompe los proyectiles enemigos (¡se pueden "barrer"!)
  meleeHit(src, angle, half, reach, dmg, w) {
    const inArc = (x, y, r) => {
      const dx = x - src.x, dy = y - src.y;
      const d = Math.hypot(dx, dy);
      if (d - r > reach) return false;
      const diff = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - angle), Math.cos(Math.atan2(dy, dx) - angle)));
      return diff <= half + 0.2 || d < r + 12;
    };
    let hits = 0;
    for (const e of this.enemies) {
      if (!e.active || !inArc(e.x, e.y, e.r)) continue;
      const crit = Math.random() < this.stats.crit;
      const l = Math.hypot(e.x - src.x, e.y - src.y) || 1;
      e.hurt(crit ? dmg * 2 : dmg, crit, (e.x - src.x) / l, (e.y - src.y) / l, this, w.knock);
      this.hitSpark(e.x - ((e.x - src.x) / l) * e.r * 0.6, e.y - ((e.y - src.y) / l) * e.r * 0.6 - 10, crit);
      hits++;
      // salpicaduras (de agua, si es la fregona)
      for (let i = 0; i < 5; i++) {
        const a = angle + (Math.random() - 0.5) * 1.6, sp = rand(120, 260);
        this.particles.push({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rand(3, 5), color: w.trail, life: 0.35, max: 0.35, outline: true });
      }
    }
    for (const b of this.bullets) {
      if (!b.friendly && inArc(b.x, b.y, b.r)) { b.dead = true; this.puff(b.x, b.y, '#ffffff'); }
    }
    if (hits) {
      this.hitStop = Math.max(this.hitStop || 0, 0.05); // pequeña pausa de impacto: da sensación de golpe
      this.shake(3 + hits);
      sfx.thud();
    }
  }

  // Casquillo que sale despedido al disparar
  casing(x, y, angle) {
    const side = Math.cos(angle) >= 0 ? -1 : 1;
    const a = angle + side * Math.PI / 2 + rand(-0.4, 0.4);
    this.particles.push({ x, y, vx: Math.cos(a) * rand(90, 150), vy: Math.sin(a) * rand(90, 150) - 60, r: 2.6, color: '#ffd23f', life: 0.5, max: 0.5, outline: true });
  }

  // Proyectil enemigo. `o` admite: color, r, sound (false para no sonar)
  enemyShoot(x, y, angle, speed, dmg, o = {}) {
    this.bullets.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: o.r || 8, dmg, friendly: false, color: o.color || '#ff4d6d', life: 6,
    });
    if (o.sound !== false) sfx.enemyShot();
  }

  killEnemy(e) {
    if (e.dead) return;
    e.dead = true;
    this.kills++;
    if (e.onDeath) e.onDeath(this);
    if (!e.isBoss) sfx.splat();
    this.addDecal(e);
    this.burst(e.x, e.y, e.color, 12, e.r);
    this.shake(3);
    sfx.kill();
    if (!e.isBoss) {
      if (Math.random() < KEY_CHANCE) this.dropPickup('key', e.x, e.y);
      else if (Math.random() < HEART_CHANCE) this.dropPickup('heart', e.x, e.y);
    }
    if (this.stats.lifesteal && !this.player.dead) this.healPlayer(this.stats.lifesteal);
    if (e.isBoss) this.bossDefeated(e);
  }

  // Al caer un jefe desaparecen sus esbirros y sus proyectiles
  bossDefeated(boss) {
    for (const e of this.enemies) {
      if (!e.dead) { e.dead = true; this.burst(e.x, e.y, e.color, 8, e.r); }
    }
    this.bullets = this.bullets.filter((b) => b.friendly);
    this.hazards = [];
    this.trail = [];
    this.lobs = [];
    this.burst(boss.x, boss.y, '#ffd23f', 30, boss.r);
    this.burst(boss.x, boss.y - 40, boss.color, 20, boss.r);
    this.fx('objeto-fx-chispa', boss.x, boss.y - 20);
    this.shake(20);
    this.hitStop = 0.35; // cámara lenta un instante: ¡golpe final!
    sfx.boom();
    this.dropPickup('heart', boss.x, boss.y);
    this.dropPickup('heart', boss.x, boss.y);
    for (let i = 0; i < (boss.type === 'boss' ? 8 : 3); i++) this.dropPickup('key', boss.x, boss.y);
    // el mini jefe siempre suelta un arma (lejos de donde saldrán las escaleras)
    if (boss.type === 'miniboss') {
      this.room.props.push(new WeaponProp(randomWeapon(this.player.weapon.id), this.rw / 2, this.rh / 2 + 130));
    }
  }

  onPlayerDeath() {
    const p = this.player;
    p.dead = true;
    this.burst(p.x, p.y, '#ffd23f', 30, p.r);
    this.shake(18);
    this.later(1.4, () => this.endRun(false));
  }

  dropPickup(kind, x, y) {
    const a = rand(0, Math.PI * 2), s = rand(80, 220);
    this.pickups.push({ kind, x, y, r: 14, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, seed: rand(0, 6) });
  }

  // ═════════════ Ataques especiales de los zombis ═════════════

  // Explosión: daña al jugador y TAMBIÉN a los demás zombis (¡reacciones en cadena!)
  explode(x, y, radius, dmg, source) {
    sfx.boom();
    this.shake(14);
    const sprite = this.fx('objeto-fx-explosion', x, y);
    for (let i = 0; i < (sprite ? 10 : 26); i++) {
      const a = rand(0, Math.PI * 2), sp = rand(60, 320);
      const c = ['#ffd23f', '#ff9f1c', '#ff5d3c', '#5d5873'][i % 4];
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: sprite ? rand(3, 6) : rand(6, 14), color: c, life: rand(0.35, 0.7), max: 0.7, outline: true });
    }
    if (!sprite) this.particles.push({ x, y, vx: 0, vy: 0, r: radius * 0.6, ring: true, color: '#ffd23f', life: 0.35, max: 0.35 });
    const p = this.player;
    if (!p.dead && dist(p, { x, y }) <= radius + p.r) p.hurt(dmg, this);
    for (const e of this.enemies) {
      if (e === source || !e.active) continue;
      const d = dist(e, { x, y });
      if (d <= radius + e.r) e.hurt(dmg, false, (e.x - x) / (d || 1), (e.y - y) / (d || 1), this, 2.2);
    }
  }

  // Latigazo de tentáculo: golpea todo lo que haya en la línea marcada
  tentacleHit(src, angle) {
    const p = this.player;
    if (p.dead) return;
    const ex = Math.cos(angle), ey = Math.sin(angle);
    const rx = p.x - src.x, ry = p.y - src.y;
    const along = clamp(rx * ex + ry * ey, 0, TENTACLE.range);
    const off = Math.hypot(rx - ex * along, ry - ey * along);
    if (off <= TENTACLE.width + p.r) p.hurt(TENTACLE.dmg, this);
    this.shake(5);
  }

  // Onda expansiva (pisotón): daña y empuja al jugador si está dentro del radio
  shockwave(x, y, radius, dmg, push) {
    this.shake(16);
    this.fx('objeto-fx-humo', x, y);
    this.particles.push({ x, y, vx: 0, vy: 0, r: radius * 0.5, ring: true, color: '#ffffff', life: 0.35, max: 0.35 });
    for (let i = 0; i < 18; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(150, 320);
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, r: rand(4, 9), color: '#d8cbb0', life: rand(0.3, 0.6), max: 0.6, outline: true });
    }
    const p = this.player;
    const d = dist(p, { x, y });
    if (p.dead || d > radius + p.r) return;
    p.hurt(dmg, this);
    if (push) { p.vx += ((p.x - x) / (d || 1)) * push; p.vy += ((p.y - y) / (d || 1)) * push; }
  }

  // La portera pasa a la fase 2: borra las balas y te aparta de un grito
  bossRage(boss) {
    this.bullets = this.bullets.filter((b) => b.friendly);
    this.banner = { title: '¡QUE ACABO DE FREGAR!', sub: 'La portera se ha enfadado de verdad', t: 0 };
    sfx.roar();
    const p = this.player;
    const d = dist(p, boss);
    if (!p.dead && d < 260) { p.vx += ((p.x - boss.x) / (d || 1)) * 900; p.vy += ((p.y - boss.y) / (d || 1)) * 900; }
    this.shake(18);
    this.particles.push({ x: boss.x, y: boss.y, vx: 0, vy: 0, r: 120, ring: true, color: '#ffd23f', life: 0.45, max: 0.45 });
  }

  // Proyectil en parábola hacia donde estaba el jugador (moco o botella de lejía)
  lob(x, y, tx, ty, kind = 'poison') {
    tx = clamp(tx, WALL + 30, this.rw - WALL - 30);
    ty = clamp(ty, WALL + 30, this.rh - WALL - 30);
    this.lobs.push({ x0: x, y0: y, tx, ty, t: 0, kind });
  }

  updateHazards(dt) {
    const p = this.player;
    for (const lb of this.lobs) {
      lb.t += dt;
      const hd = HAZARDS[lb.kind];
      if (lb.t >= hd.flight) {
        // ¡splash! deja un charco
        lb.done = true;
        this.hazards.push({ x: lb.tx, y: lb.ty, r: hd.radius, life: hd.life, seed: rand(0, 6), kind: lb.kind });
        for (let i = 0; i < 8; i++) {
          const a = rand(0, Math.PI * 2), sp = rand(60, 160);
          this.particles.push({ x: lb.tx, y: lb.ty, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rand(3, 6), color: hd.drop, life: 0.4, max: 0.4, outline: true });
        }
        if (lb.kind === 'bleach') sfx.glass(); else sfx.splat();
        if (!p.dead && dist(p, { x: lb.tx, y: lb.ty }) < hd.radius + p.r * 0.5) p.hurt(hd.hit, this);
      }
    }
    this.lobs = this.lobs.filter((lb) => !lb.done);
    for (const hz of this.hazards) {
      hz.life -= dt;
      // pisar el charco quema poco a poco (la esquiva te deja cruzarlo)
      const hd = HAZARDS[hz.kind];
      if (!p.dead && p.dashT <= 0 && dist(p, hz) < hz.r + p.r * 0.3) p.poison(hd.dps * dt, this, hd.drop);
    }
    this.hazards = this.hazards.filter((hz) => hz.life > 0);
    for (const t of this.trail) t.life -= dt;
    if (this.trail.length && this.trail[0].life <= 0) this.trail = this.trail.filter((t) => t.life > 0);
  }

  // El zombi lento deja un rastro de sangre al arrastrarse: una mancha cada pocos pasos, que se va secando
  dropTrail(e) {
    if (e.trailX === undefined) { e.trailX = e.x; e.trailY = e.y; return; }
    if (Math.hypot(e.x - e.trailX, e.y - e.trailY) < TRAIL.step) return;
    e.trailX = e.x; e.trailY = e.y;
    this.trail.push({ x: e.x + rand(-3, 3), y: e.y + 6 + rand(-2, 2), life: TRAIL.life, seed: Math.floor(rand(0, 4)) });
    if (this.trail.length > TRAIL.max) this.trail.shift();
  }

  drawTrail(ctx) {
    for (const t of this.trail) {
      if (this.hidden(t)) continue;
      // en píxeles enteros del dibujo, como el resto del suelo
      const x = Math.round(t.x / PIXEL) * PIXEL, y = Math.round(t.y / PIXEL) * PIXEL, u = PIXEL;
      ctx.globalAlpha = 0.75 * Math.min(1, t.life / TRAIL.fade);
      ctx.fillStyle = TRAIL.dark;
      ctx.fillRect(x - 3 * u, y - u, 6 * u, 3 * u);
      ctx.fillStyle = TRAIL.color;
      ctx.fillRect(x - 2 * u, y, 4 * u, u);
      // una gota suelta, a un lado u otro
      ctx.fillStyle = TRAIL.dark;
      ctx.fillRect(x + (t.seed % 2 ? 4 : -5) * u, y + (t.seed > 1 ? 2 * u : -2 * u), u, u);
    }
    ctx.globalAlpha = 1;
  }

  drawHazards(ctx) {
    for (const hz of this.hazards) {
      const hd = HAZARDS[hz.kind];
      const fade = Math.min(1, hz.life / 0.6) * Math.min(1, (hd.life - hz.life) / 0.15 + 0.3);
      ctx.save();
      ctx.globalAlpha = 0.8 * fade;
      const sprite = hz.kind === 'bleach' ? 'objeto-charco-lejia' : 'objeto-charco-veneno';
      // el sprite se dibuja entero; cada charco sale a veces espejado para que no se repitan todos igual
      if (hasSprite(sprite)) {
        if (hz.seed > 3) { ctx.translate(hz.x * 2, 0); ctx.scale(-1, 1); }
        ctx.globalAlpha = Math.min(1, fade * 1.1);
        drawSprite(ctx, sprite, 'idle', 'south', 0, hz.x, hz.y, { scale: 1 });
        ctx.restore();
        continue;
      }
      ctx.fillStyle = hd.fill;
      ctx.strokeStyle = hd.stroke;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const r = hz.r * (0.85 + Math.sin(a * 3 + hz.seed) * 0.12);
        ctx.lineTo(hz.x + Math.cos(a) * r, hz.y + Math.sin(a) * r * 0.6);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // burbujas
      ctx.fillStyle = hd.bubble;
      for (let i = 0; i < 3; i++) {
        const b = (this.time * 1.5 + i / 3 + hz.seed) % 1;
        ctx.beginPath();
        ctx.arc(hz.x + Math.cos(i * 2.1 + hz.seed) * hz.r * 0.45, hz.y + Math.sin(i * 2.1 + hz.seed) * hz.r * 0.25, 2 + b * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawLobs(ctx) {
    for (const lb of this.lobs) {
      const hd = HAZARDS[lb.kind];
      const k = lb.t / hd.flight;
      const gx = lb.x0 + (lb.tx - lb.x0) * k, gy = lb.y0 + (lb.ty - lb.y0) * k;
      const h = Math.sin(k * Math.PI) * (lb.kind === 'bleach' ? 130 : 90);
      // aviso de dónde caerá
      ctx.beginPath();
      ctx.ellipse(lb.tx, lb.ty, hd.radius * k, hd.radius * 0.6 * k, 0, 0, Math.PI * 2);
      ctx.fillStyle = lb.kind === 'bleach' ? 'rgba(90, 169, 214, 0.3)' : 'rgba(155, 227, 59, 0.25)';
      ctx.fill();
      if (lb.kind === 'bleach') {
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255, 60, 90, 0.9)';
        ctx.beginPath(); ctx.ellipse(lb.tx, lb.ty, hd.radius, hd.radius * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = 'rgba(20,16,40,0.25)';
      ctx.beginPath(); ctx.ellipse(gx, gy, 8, 3.5, 0, 0, Math.PI * 2); ctx.fill();
      if (lb.kind === 'bleach') { drawBottle(ctx, gx, gy - h, lb.t * 10); continue; }
      if (drawSprite(ctx, 'objeto-moco', 'idle', 'south', 0, gx, gy - h)) continue;
      ctx.beginPath();
      ctx.arc(gx, gy - h, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#9be33b';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
    }
  }

  // ═════════════ Efectos ═════════════

  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); }

  puff(x, y, color) {
    this.particles.push({ x, y, vx: rand(-30, 30), vy: rand(-30, 10), r: rand(3, 6), color, life: 0.3, max: 0.3 });
  }

  burst(x, y, color, n, r) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(80, 260);
      this.particles.push({
        x: x + Math.cos(a) * r * 0.5, y: y + Math.sin(a) * r * 0.5,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        r: rand(4, 9), color, life: rand(0.35, 0.7), max: 0.7, outline: true,
      });
    }
    this.particles.push({ x, y, vx: 0, vy: 0, r, ring: true, color: '#ffffff', life: 0.3, max: 0.3 });
  }

  // Impacto de una bala del conserje o de un compañero, en pixel art: un destello cuadrado y unas chispas
  // (cuadraditos del color de la bala) que rebotan hacia atrás. Contra un muro salta además algo de polvo.
  // Se pinta a la altura a la que se ve la bala, no a la del suelo.
  bulletImpact(b, wall) {
    const x = b.x, y = b.y - (b.lift || 0);
    const back = Math.atan2(-b.vy, -b.vx);
    const colors = b.crit ? ['#ffffff', '#ffe9a8', '#ff9a3c', '#ff4d2e'] : ['#fffbe0', '#ffe066', '#ffb020', '#f0701a'];
    this.particles.push({ x, y, vx: 0, vy: 0, px: true, size: b.crit ? 5 : 4, color: colors[0], life: 0.07, max: 0.07 });
    const n = (b.crit ? 7 : 5) - (b.r < 6 ? 2 : 0); // los perdigones sueltan menos chispas
    for (let i = 0; i < n; i++) {
      const a = back + rand(-1.1, 1.1), sp = rand(110, 300);
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, px: true, size: i < 2 ? 2 : 1,
        color: colors[1 + (i % 3)], life: rand(0.14, 0.28), max: 0.28,
      });
    }
    if (wall) {
      for (let i = 0; i < 3; i++) {
        const a = back + rand(-0.8, 0.8), sp = rand(30, 90);
        this.particles.push({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, px: true, size: 2,
          color: i ? '#b9bec9' : '#e3e6ec', life: rand(0.25, 0.4), max: 0.4,
        });
      }
    }
  }

  // Efecto animado de pixel art (explosión, chispa, humo): se reproduce una vez en su sitio
  fx(id, x, y) {
    const dur = { 'objeto-fx-explosion': 12 / 14, 'objeto-fx-chispa': 7 / 16, 'objeto-fx-humo': 10 / 12 }[id];
    if (!hasSprite(id)) return false;
    this.particles.push({ fx: id, x, y, vx: 0, vy: 0, life: dur, max: dur });
    return true;
  }

  // Chispas en forma de estrella donde se golpea
  hitSpark(x, y, crit) {
    const n = crit ? 6 : 4;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(160, 300);
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: crit ? 7 : 5, color: crit ? '#ffd23f' : '#ffffff', life: 0.16, max: 0.16, star: true });
    }
  }

  // Mancha que se queda en el suelo al morir un enemigo
  addDecal(e) {
    const decals = this.room && this.room.decals;
    if (!decals) return;
    const colors = { explosivo: '#2b2633', venenoso: '#8fd13f', tentaculos: '#7b4fa0' };
    const base = e.isBoss ? 1.8 : 1;
    decals.push({ x: e.x, y: e.y + 10, r: rand(14, 20) * base, color: colors[e.type] || '#5b7d3a', seed: rand(0, 6) });
    if (decals.length > 60) decals.shift();
  }

  floatText(x, y, text, color, size = 18) {
    this.texts.push({ x, y, text, color, size, t: 0, life: 0.9, vy: -70 });
  }

  // ═════════════ Dibujo ═════════════

  slideEase(tr) {
    const k = clamp(tr.t / SLIDE, 0, 1);
    return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  }

  // Cómo se dibuja cada fotograma:
  //  1) el fondo (el mapa guardado como imagen + puertas, charcos, objetos del suelo) se dibuja en un
  //     lienzo pequeño alineado a la cuadrícula de píxeles y se amplía con un desplazamiento exacto,
  //     así se mueve con suavidad aunque cada píxel del dibujo ocupe varios de pantalla;
  //  2) los personajes, balas y partículas se dibujan a resolución de pantalla en su posición exacta.
  render() {
    const out = this.ctx, cam = this.camera;
    const vw = cam.vw, vh = cam.vh;
    const k = out.canvas.height / vh; // píxeles de pantalla por unidad del juego

    // temblor y paso de un mapa a otro
    let offX = 0, offY = 0;
    const tr = this.transition;
    if (tr) {
      const e = this.slideEase(tr);
      const [dx, dy] = DIRS[tr.dir];
      offX = dx * vw * (1 - e); offY = dy * vh * (1 - e);
      tr.e = e;
    } else if (this.shakeAmt > 0.3) {
      offX = rand(-1, 1) * this.shakeAmt; offY = rand(-1, 1) * this.shakeAmt;
    }
    const camX = cam.left - offX, camY = cam.top - offY; // esquina exacta de lo que se ve

    // 1) fondo en el lienzo pequeño
    const sx = Math.floor(camX / PIXEL) * PIXEL, sy = Math.floor(camY / PIXEL) * PIXEL;
    const bw = Math.ceil(vw / PIXEL) + 2, bh = Math.ceil(vh / PIXEL) + 2;
    if (this.low.width !== bw || this.low.height !== bh) { this.low.width = bw; this.low.height = bh; }
    const ctx = this.lowCtx;
    ctx.setTransform(1 / PIXEL, 0, 0, 1 / PIXEL, -sx / PIXEL, -sy / PIXEL);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(sx, sy, bw * PIXEL, bh * PIXEL);
    if (tr) {
      // el mapa que se deja sale con su propia cámara
      const [dx, dy] = DIRS[tr.dir];
      const prev = tr.cam || { left: 0, top: 0 };
      const tx = Math.round((camX - prev.left - dx * vw * tr.e) / PIXEL) * PIXEL;
      const ty = Math.round((camY - prev.top - dy * vh * tr.e) / PIXEL) * PIXEL;
      ctx.save();
      ctx.translate(tx, ty);
      ctx.drawImage(this.roomImage(tr.from), 0, 0, tr.from.layout.w, tr.from.layout.h);
      drawDoors(ctx, tr.from, 1);
      for (const s of [...sceneryOf(tr.from)].sort((a, b) => a.y - b.y)) s.draw(ctx, this);
      ctx.restore();
    }
    ctx.drawImage(this.roomImage(this.room), 0, 0, this.rw, this.rh);
    this.drawBackground(ctx);

    out.setTransform(1, 0, 0, 1, 0, 0);
    out.clearRect(0, 0, out.canvas.width, out.canvas.height);
    out.imageSmoothingEnabled = false;
    out.drawImage(this.low, (sx - camX) * k, (sy - camY) * k, bw * PIXEL * k, bh * PIXEL * k);

    // 2) personajes y efectos a resolución de pantalla
    out.setTransform(k, 0, 0, k, -camX * k, -camY * k);
    out.imageSmoothingEnabled = false;
    setGridSnap(false);
    this.drawActors(out);
    setGridSnap(true);
    this.drawTexts(out);

    // 3) interfaz
    out.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    if (this.state === 'playing' && !tr) this.drawOffscreen(out);
    this.drawOverlay(out);
  }

  // Cada mapa (suelo, paredes, muebles, manchas) se dibuja una vez y se guarda como imagen
  roomImage(room) {
    const key = `${(room.decals || []).length}:${(this.spriteIds || []).length}`;
    if (!room.cache || room.cacheKey !== key) {
      const c = room.cache || document.createElement('canvas');
      c.width = room.layout.w / PIXEL; c.height = room.layout.h / PIXEL;
      const x = c.getContext('2d');
      x.setTransform(1 / PIXEL, 0, 0, 1 / PIXEL, 0, 0);
      x.imageSmoothingEnabled = false;
      drawRoom(x, room, this.time);
      room.cache = c;
      room.cacheKey = key;
    }
    return room.cache;
  }

  // ¿Está preparando un ataque? (para avisar aunque esté fuera de la pantalla)
  isWindingUp(e) {
    if (e.fuse > 0 || e.spitT > 0 || (e.tent && e.tent.phase === 'warn')) return true;
    return !!(e.state && /Warn$|^charge$|^spin$/.test(e.state.name));
  }

  // Avisos en el borde de la pantalla: enemigos que no se ven (con "!") y, con el mapa limpio,
  // lo que queda por hacer y no se ve: puertas, la llave y el superviviente
  drawOffscreen(ctx) {
    const cam = this.camera;
    const p = this.player;
    // zona donde se colocan los avisos (sin tapar el minimapa ni el HUD)
    const x0 = 26, x1 = this.ow - 26, y0 = 26, y1 = H - 64 - 22;
    const edge = (sx, sy) => {
      const cx = this.ow / 2, cy = H / 2;
      const dx = sx - cx, dy = sy - cy;
      const t = Math.min(dx ? Math.abs(((dx > 0 ? x1 : x0) - cx) / dx) : 1e9, dy ? Math.abs(((dy > 0 ? y1 : y0) - cy) / dy) : 1e9);
      const m = { x: cx + dx * t, y: cy + dy * t, a: Math.atan2(dy, dx) };
      // si cae encima del minimapa, se coloca justo debajo
      const mm = minimapRect;
      if (mm && m.x > mm.x - 20 && m.y < mm.y + mm.h + 20) m.y = mm.y + mm.h + 22;
      return m;
    };
    const marker = (m, r, fill, label, pulse) => {
      // flechita hacia el objetivo
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(m.a);
      ctx.beginPath();
      ctx.moveTo(r + 9, 0); ctx.lineTo(r - 2, -7); ctx.lineTo(r - 2, 7); ctx.closePath();
      ctx.fillStyle = fill; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE; ctx.stroke();
      ctx.restore();
      if (pulse) {
        ctx.beginPath();
        ctx.arc(m.x, m.y, r + 5 + Math.sin(this.time * 18) * 3, 0, Math.PI * 2);
        ctx.lineWidth = 4; ctx.strokeStyle = '#ff2d4b'; ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
      ctx.fillStyle = pulse && Math.floor(this.time * 8) % 2 ? '#ff2d4b' : fill;
      ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE; ctx.stroke();
      if (label === '!') outlinedText(ctx, '!', m.x, m.y + 1, r * 1.5, '#ffffff', { lw: 4 });
      else drawEmojiAt(ctx, label, m.x, m.y + 1, r * 1.1);
    };
    for (const e of this.enemies) {
      if (e.dead || e.asleep || this.hidden(e) || cam.inView(e, -4)) continue; // los dormidos no se delatan
      const s = cam.toScreen(e.x, e.y);
      const m = edge(s.x, s.y);
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      const near = clamp(1 - (d - 250) / 500, 0, 1); // crece al acercarse
      if (e.isBoss) marker(m, 18, e.color, e.icon, this.isWindingUp(e));
      else {
        ctx.globalAlpha = e.spawnT > 0 ? 0.5 : 1;
        marker(m, 9 + near * 5, e.color, '!', this.isWindingUp(e));
        ctx.globalAlpha = 1;
      }
    }
    if (!this.room.cleared || this.doorOpen < 1) return;
    const point = (x, y, fill, label) => {
      if (cam.inView({ x, y, r: 0 })) return;
      const s = cam.toScreen(x, y);
      ctx.globalAlpha = 0.85;
      marker(edge(s.x, s.y), 11, fill, label, false);
      ctx.globalAlpha = 1;
    };
    for (const ex of this.room.exits) {
      // las escaleras, cuando se abren; y las puertas tras las que queda algo: la vuelta al pasillo,
      // un apartamento con zombis o el del mini jefe
      const show = ex.kind === 'stairs' ? !ex.locked : ex.to && (ex.to.type === 'corridor' || !ex.to.cleared);
      if (show) point(ex.x, ex.y, ex.frame || '#80ed99', ex.locked ? '🔒' : ex.icon || '🚪');
    }
    for (const pr of this.room.props) {
      if (pr.taken || this.hidden(pr)) continue;
      if (pr.kind === 'doorkey') point(pr.x, pr.y, '#dfe7f2', '🗝️');
      else if (pr.kind === 'survivor') point(pr.x, pr.y, pr.def.color, pr.def.icon);
    }
  }

  // Interfaz dibujada en el lienzo: barra de objetos, minimapa, jefe, carteles y fundidos
  drawOverlay(ctx) {
    if (this.state !== 'menu' && this.floor) {
      this.drawItemBar(ctx);
      drawMinimap(ctx, this.floor, this.room, this.floor.name.toUpperCase(), this.time, this.ow);
      // la llave del mini jefe, debajo del minimapa mientras se lleva encima
      if (this.floor.hasKey) {
        const m = minimapRect;
        roundBox(ctx, m.x, m.y + m.h + 8, m.w, 28, 10, 'rgba(29, 27, 44, 0.78)', 3);
        outlinedText(ctx, this.floor.key.name, m.x + m.w / 2 + 10, m.y + m.h + 23, 14, '#dfe7f2', { lw: 4 });
        ctx.font = '14px "ZS UI"';
        drawEmojiAt(ctx, '🗝️', m.x + m.w / 2 - ctx.measureText(this.floor.key.name).width / 2 - 2, m.y + m.h + 23, 14);
      }
    }
    this.drawVignette(ctx);
    this.drawBossBar(ctx);
    this.drawBanner(ctx);
    if (this.fade) {
      const k = clamp(this.fade.t / FADE, 0, 1);
      ctx.globalAlpha = this.fade.phase === 'out' ? k : 1 - k;
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(0, 0, this.ow, H);
      ctx.globalAlpha = 1;
    }
  }

  // Lo que va pegado al suelo: puertas, charcos y cosas para recoger
  drawBackground(ctx) {
    drawFog(ctx, this.room.layout);
    drawDoors(ctx, this.room, this.doorOpen);
    this.drawTrail(ctx);
    this.drawHazards(ctx);
    for (const pk of this.pickups) drawPickup(ctx, pk, this.time);
  }

  // Personajes, objetos con altura, balas y partículas
  drawActors(ctx) {
    drawDoorLabels(ctx, this.room);
    // el superviviente rescatado y la llave recogida ya no están en el suelo
    // ...y lo que hay en una habitación a oscuras no se ve hasta entrar
    const props = this.room.props.filter((pr) => !(pr.taken && (pr.kind === 'survivor' || pr.kind === 'doorkey')) && !this.hidden(pr));
    // Ordenamos por "y" para que lo de abajo se dibuje delante (falsa profundidad)
    // (entran también los muebles y las caras de los tabiques, que tienen altura)
    const list = [...this.enemies.filter((e) => !this.hidden(e)), ...this.allies, ...props, ...sceneryOf(this.room)];
    if (!this.player.dead) list.push(this.player);
    list.sort((a, b) => a.y - b.y);
    for (const e of list) e.draw(ctx, this);

    for (const b of this.bullets) drawBullet(ctx, b);
    this.drawLobs(ctx);
    this.drawParticles(ctx);
  }

  // Números de daño y textos flotantes
  drawTexts(ctx) {
    for (const t of this.texts) {
      const pop = Math.min(1, t.t / 0.08);
      ctx.globalAlpha = t.t > t.life - 0.25 ? (t.life - t.t) / 0.25 : 1;
      outlinedText(ctx, t.text, t.x, t.y, t.size * (0.6 + 0.4 * pop), t.color, { lw: 5 });
      ctx.globalAlpha = 1;
    }
  }

  drawParticles(ctx) {
    for (const pt of this.particles) {
      const k = pt.life / pt.max;
      ctx.globalAlpha = Math.min(1, k * 1.5);
      if (pt.fx) {
        ctx.globalAlpha = 1;
        drawSprite(ctx, pt.fx, 'idle', 'south', 0, pt.x, pt.y, { frame: Math.floor((1 - k) * (pt.fx === 'objeto-fx-explosion' ? 12 : pt.fx === 'objeto-fx-chispa' ? 7 : 10)) });
        continue;
      }
      if (pt.px) {
        // pixel art: un cuadradito encajado en la cuadrícula, que encoge en vez de desvanecerse
        const side = Math.max(1, Math.ceil(pt.size * Math.min(1, k * 1.6))) * PIXEL;
        ctx.globalAlpha = 1;
        ctx.fillStyle = pt.color;
        ctx.fillRect(Math.round((pt.x - side / 2) / PIXEL) * PIXEL, Math.round((pt.y - side / 2) / PIXEL) * PIXEL, side, side);
        continue;
      }
      // todo se dibuja con cuadraditos encajados en la cuadrícula de píxeles (nada de bordes suavizados)
      const sq = (x, y, n, color) => {
        const side = Math.max(1, n) * PIXEL;
        ctx.fillStyle = color;
        ctx.fillRect(Math.round((x - side / 2) / PIXEL) * PIXEL, Math.round((y - side / 2) / PIXEL) * PIXEL, side, side);
      };
      if (pt.star) {
        // destello en cruz
        const arm = Math.max(1, Math.round(pt.r * (0.6 + k * 0.6) / PIXEL));
        for (let i = -arm; i <= arm; i++) { sq(pt.x + i * PIXEL, pt.y, 1, pt.color); if (i) sq(pt.x, pt.y + i * PIXEL, 1, pt.color); }
      } else if (pt.ring) {
        // anillo de puntitos que se abre
        const rr = pt.r * (1 + (1 - k) * 1.2);
        const n = Math.max(12, Math.round(rr * 1.4 / PIXEL) * 2);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          sq(pt.x + Math.cos(a) * rr, pt.y + Math.sin(a) * rr * 0.75, 2, pt.color);
        }
      } else {
        const n = Math.max(1, Math.round(pt.r * k * 2 / PIXEL));
        if (pt.outline) sq(pt.x, pt.y, n + 2, OUTLINE);
        sq(pt.x, pt.y, n, pt.color);
      }
    }
    ctx.globalAlpha = 1;
  }

  // Objetos conseguidos, arriba a la izquierda (sobre el muro)
  drawItemBar(ctx) {
    if (!this.items || !this.items.length) return;
    const x0 = 16, y0 = 12, size = 30;
    roundBox(ctx, x0 - 6, y0 - 4, this.items.length * (size + 4) + 8, size + 8, 10, 'rgba(29, 27, 44, 0.7)', 3);
    this.items.forEach((it, i) => {
      const img = itemIcon(it.id);
      if (img.complete && img.naturalWidth) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, x0 + i * (size + 4), y0, size, size);
      }
    });
  }

  // Borde rojo al recibir daño y latido cuando queda poca vida
  drawVignette(ctx) {
    if (this.state !== 'playing' || !this.player) return;
    const p = this.player;
    const low = !p.dead && p.hp < this.stats.maxHp * 0.3;
    const pulse = low ? 0.25 + 0.2 * Math.max(0, Math.sin(this.time * 7)) : 0;
    const a = Math.max(pulse, (this.hurtFlash || 0) * 1.4);
    if (a <= 0.01) return;
    const ow = this.ow;
    const g = ctx.createRadialGradient(ow / 2, H / 2, H * 0.35, ow / 2, H / 2, ow * 0.62);
    g.addColorStop(0, 'rgba(255, 30, 60, 0)');
    g.addColorStop(1, `rgba(255, 30, 60, ${Math.min(0.7, a)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, ow, H);
  }

  // Barra de vida de jefes y mini jefes
  drawBossBar(ctx) {
    const boss = this.enemies.find((e) => e.isBoss && e.active);
    if (!boss) return;
    const w = 420, x = this.ow / 2 - w / 2, y = H - WALL - 40;
    // se vuelve transparente si hay alguien debajo, para no tapar el combate
    const toScreen = (e) => this.camera.toScreen(e.x, e.y);
    const under = [this.player, ...this.enemies].some((e) => { const s = toScreen(e); return s.x > x - 30 && s.x < x + w + 30 && s.y > y - 60; });
    ctx.save();
    ctx.globalAlpha = under ? 0.35 : 1;
    ctx.beginPath(); ctx.roundRect(x - 4, y - 4, w + 8, 26, 13);
    ctx.fillStyle = OUTLINE; ctx.fill();
    ctx.beginPath(); ctx.roundRect(x, y, w * Math.max(0, boss.hp / boss.maxHp), 18, 9);
    ctx.fillStyle = boss.color; ctx.fill();
    if (boss.type === 'boss' && boss.phase === 1) {
      // marca de la mitad: ahí empieza la fase 2
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x + w / 2 - 2, y - 2, 4, 22);
    }
    const bossName = `${boss.name}${boss.phase === 2 ? ' · ¡FURIOSO!' : ''}`;
    outlinedText(ctx, bossName, this.ow / 2 + 16, y - 16, 22, '#ffd23f', { lw: 6 });
    ctx.font = '22px "ZS UI"';
    drawEmojiAt(ctx, boss.icon, this.ow / 2 + 16 - ctx.measureText(bossName).width / 2 - 20, y - 16, 22);
    ctx.restore();
  }

  drawBanner(ctx) {
    const b = this.banner;
    if (!b || b.t > 2.2 || this.state === 'menu') return;
    const appear = Math.min(1, b.t / 0.25);
    const fade = b.t > 1.8 ? 1 - (b.t - 1.8) / 0.4 : 1;
    ctx.save();
    ctx.globalAlpha = Math.max(0, fade);
    const s = 0.6 + 0.4 * (1 - Math.pow(1 - appear, 3));
    ctx.translate(this.ow / 2, H * 0.3);
    ctx.scale(s, s);
    const tx = b.icon ? 34 : 0;
    outlinedText(ctx, b.title, tx, 0, 56, '#ffd23f', { lw: 12 });
    if (b.icon) {
      const img = itemIcon(b.icon);
      if (img.complete && img.naturalWidth) {
        ctx.font = '56px "ZS UI"';
        const wTitle = ctx.measureText(b.title).width;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, tx - wTitle / 2 - 74, -34, 68, 68);
      }
    }
    if (b.sub) outlinedText(ctx, b.sub, 0, 46, 24, '#ffffff', { lw: 7 });
    ctx.restore();
  }
}
