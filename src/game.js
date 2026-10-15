// ─────────────────────────────────────────────
//  Game: controla el flujo de la partida
//  menú → edificio → plantas → pasillo y apartamentos
// ─────────────────────────────────────────────
import { W, H, WALL, DOOR_W, MAX_ALLIES, BUILDINGS, SURVIVORS, SLIDE, FADE } from './config.js';
import { rand, clamp, dist, pushOut, obstacleGap } from './utils.js';
import { Player, Ally } from './entities.js';
import { makeBoss, BOSS_TYPES } from './bosses.js';
import { Zombie } from './zombies.js';
import { generateFloor, floorName } from './building.js';
import { makePlainLayout } from './rooms.js';
import { baseStats, rollItem, applyWorkshop, WORKSHOP } from './upgrades.js';
import { SurvivorNPC, DoorKey, WeaponProp, WeaponStash, Maniqui } from './props.js';
import { WEAPONS, randomWeapon, weaponSummary } from './weapons.js';
import { loadSave, updateSave, buildingSave } from './save.js';
import { Camera, ZOOM, BOSS_ZOOM } from './camera.js';
import { setTextFont } from './draw.js';
import { hasSprite } from './sprites.js';
import { CELL, isWall, isOpen, lineClear, randomFloorPoint, wayTo } from './shapes.js';
import { getMoveVector, consumeDash, clearInput } from './input.js';
import { MolotovMethods, MOLOTOV } from './molotov.js';
import { sfx, music, setMusicOn } from './sfx.js';
import { ZombieAttacks } from './game-ataques.js';
import { GameDrawing } from './game-dibujo.js';

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

const CASH_CHANCE = 0.07;  // probabilidad de que un zombi suelte un billete de dólar 💵
const HEART_CHANCE = 0.05; // ...o un corazón
const HEART_HEAL = 15;
const BULLET_LIFT = 22;    // pixel art: altura a la que se dibujan las balas de un arma dibujada (la del cuerpo de un zombi)

const formatTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

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
    this.aim = null;     // dónde caería el molotov mientras se apunta
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

  // Taller: mejoras permanentes que se compran con dólares
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
    this.runKeys = 0;          // dólares recogidos en esta partida
    this.molotovs = MOLOTOV.start; // cócteles molotov en la mochila
    this.wallet = save.keys;   // dólares ahorrados (para el HUD; en el guardado se siguen llamando "keys")
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
    this.updateToss();
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
      // Los billetes siempre vienen a ti; los corazones, solo si te falta vida
      // y los molotovs, si caben en la mochila
      const wanted = pk.kind === 'cash' || (pk.kind === 'molotov' ? this.molotovs < MOLOTOV.max : needsHp);
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
    } else if (pk.kind === 'cash') {
      // los dólares se guardan al momento: no se pierden aunque mueras
      this.runKeys++;
      this.wallet = updateSave((s) => { s.keys++; s.totalKeys++; }).keys;
      this.floatText(pk.x, pk.y - 20, '+$1', '#80ed99', 20);
      sfx.coin();
    } else if (pk.kind === 'molotov') {
      this.molotovs = Math.min(MOLOTOV.max, this.molotovs + 1);
      this.floatText(pk.x, pk.y - 20, '+1 molotov', '#ff9f1c', 20);
      sfx.buy();
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
      if (Math.random() < CASH_CHANCE) this.dropPickup('cash', e.x, e.y);
      else if (Math.random() < HEART_CHANCE) this.dropPickup('heart', e.x, e.y);
      else if (Math.random() < MOLOTOV.drop) this.dropPickup('molotov', e.x, e.y);
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
    for (let i = 0; i < (boss.type === 'boss' ? 8 : 3); i++) this.dropPickup('cash', boss.x, boss.y);
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

}

// Añade a Game los métodos de otra clase (así game.js se reparte en varios archivos)
function addMethods(target, source) {
  for (const name of Object.getOwnPropertyNames(source.prototype)) {
    if (name !== 'constructor') Object.defineProperty(target.prototype, name, Object.getOwnPropertyDescriptor(source.prototype, name));
  }
}
addMethods(Game, ZombieAttacks); // ataques especiales de los zombis (game-ataques.js)
addMethods(Game, GameDrawing);   // dibujo (game-dibujo.js)
addMethods(Game, MolotovMethods); // el cóctel molotov de Johnny (molotov.js)
