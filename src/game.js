// ─────────────────────────────────────────────
//  Game: controla el flujo de la partida
//  menú → edificio → plantas → pasillo y apartamentos
// ─────────────────────────────────────────────
import { W, H, WALL, DOOR_W, MAX_ALLIES, BUILDINGS, SLIDE, FADE } from './config.js';
import { rand, clamp, dist, obstacleGap } from './utils.js';
import { Player, Ally } from './entities.js';
import { makeBoss, BOSS_TYPES } from './bosses.js';
import { Zombie } from './zombies.js';
import { generateFloor, floorName } from './building.js';
import { makePlainLayout } from './rooms.js';
import { baseStats } from './upgrades.js';
import { DoorKey, Ordenador, Baul, BancoTrabajo, Armarito, BOTIQUIN_CURA, WeaponProp } from './props.js';
import { OrdenadorMethods } from './ordenador.js';
import { BancoMethods } from './banco.js';
import { ArmasCreadasMethods, armaDeCreada } from './armas-creadas.js';
import { PRECIO_PUNTO, aplicarTalentos } from './talentos.js';
import { MutacionMethods, actualizarMutaciones } from './mutaciones.js';
import { SupervivienteMethods } from './superviviente.js';
import { casillasMochila } from './objetos.js';
import { ExposicionMuebles, expoZombis } from './exposicion.js';
import { weaponSummary, WEAPONS } from './weapons.js';
import { loadSave, updateSave, buildingSave } from './save.js';
import { Camera, ZOOM, BOSS_ZOOM } from './camera.js';
import { setTextFont } from './draw.js';
import { isOpen, randomFloorPoint } from './shapes.js';
import { getMoveVector, consumeDash, consumeReload, consumeSwitch, consumeTossSwitch, clearInput } from './input.js';
import { MolotovMethods, MOLOTOV } from './molotov.js';
import { GranadaMethods, GRANADA } from './granada.js';
import { sfx, music, setMusicOn } from './sfx.js';
import { ZombieAttacks } from './game-ataques.js';
import { GameDrawing } from './game-dibujo.js';
import { GameCombat } from './game-combate.js';
import { GameEffects } from './game-efectos.js';
import { GameMap } from './game-mapa.js';

// Dónde va la mesa del ordenador en la pared de arriba de la sala de mantenimiento (la puerta está en el centro)
const ORDENADOR_X = 240;
// y el baúl, a su derecha (entre la mesa y la puerta)
const BAUL_X = 340;
// y el banco de trabajo, al otro lado (a su izquierda)
const BANCO_X = 135;

// Vida de los jefes según la planta (la portera solo sale en la azotea)
const bossHpMul = (type, floorNum) => (type === 'boss' ? 1 : 1 + (floorNum - 1) * 0.25);
// Cuánto más duros son los zombis en cada planta (provisional: se equilibra en la fase 3 del mapa nuevo)
const FLOOR_HP = 0.15;
const NOPE_EVERY = 1.6;    // cada cuánto se repite el aviso de una puerta que no se abre

const formatTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;


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
    // El mundo se dibuja en un lienzo pequeño (un píxel = BG_PIXEL unidades, el doble de detalle que los sprites) que luego se amplía
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
    this.camera.pantallaH = this.canvas.height;
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
    this.grenades = [];  // granadas en el suelo o en el aire (granada.js)
    this.aim = null;     // dónde caería el molotov mientras se apunta
    this.enemies = [];
    this.bullets = [];
    this.chorros = [];    // gotas de fuego y ácido de las armas creadas a distancia (armas-creadas.js)
    this.bumeranes = [];  // el bumerán segador en el aire
    this.chorroSfxT = 0; this.acidoT = 0;
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
    this.ui.showMenu(loadSave(), { play: () => this.showBuildings() });
  }

  // Selector de edificios
  showBuildings() {
    this.ui.showBuildings(loadSave(), BUILDINGS, { pick: (id) => this.newRun(id), back: () => this.goMenu() });
  }

  newRun(buildingId = this.building?.id || 'apartamentos') {
    this.building = BUILDINGS[buildingId];
    const save = updateSave((s) => { s.runs++; buildingSave(s, buildingId).runs++; });
    this.stats = aplicarTalentos(baseStats(), save.talentos);
    this.mutaciones = [];      // mutaciones de esta partida (mutaciones.js): se pierden al acabarla
    this.mutOpen = false;
    this.player = new Player(this.stats);
    this.allies = [];
    this.kills = 0;
    this.runKeys = 0;          // dólares recogidos en esta partida: solo se guardan si completas el edificio
    this.molotovs = MOLOTOV.start + this.stats.extraThrow; // cócteles molotov en la mochila
    this.granadas = GRANADA.start + this.stats.extraThrow; // granadas en la mochila
    this.mochila = [];         // objetos para crear armas recogidos en esta partida (objetos.js): al baúl si ganas
    this.armasGuardadas = [];  // armas que lleva en el inventario sin usar (la fregona, al coger otra cuerpo a cuerpo)
    this.ammoGuardada = new Map(); // munición de las armas de fuego guardadas en el inventario
    this.armasCreadas = [];    // armas creadas en el banco de trabajo (recetas.js): duran esta partida
    this.reviveUsed = false;   // Desfibrilador: solo una vez por edificio
    this.tossKind = 'molotov';     // lo que se lanza con el botón de lanzar: 'molotov' o 'granada'
    this.savedKeys = save.keys; // dólares ahorrados de antes (en el guardado se siguen llamando "keys")
    this.wallet = save.keys;   // lo que sale en el HUD: lo ahorrado más lo de esta partida
    this.runTime = 0;
    this.floorNum = 1;
    this.fade = null;
    // el superviviente de esta partida y la planta donde se esconde (superviviente.js)
    this.elegirSuperviviente();
    this.horda = null;
    this.items = [];            // objetos conseguidos
    this.itemsSeen = new Set(); // objetos que ya han salido (para no repetir)
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
    // Modo de pruebas (añade ?pruebas a la dirección): las teclas 1-6 invocan zombis (ver main.js), todas
    // las armas están abiertas y a los lados de mantenimiento hay dos salas de exposición (muebles y zombis)
    this.testMode = new URLSearchParams(location.search).has('pruebas');
    this.floor = generateFloor(this.floorNum, this.building.floors, { pruebas: this.testMode });
    this.player.shield = this.stats.shield + this.stats.mutShield; // Acero y Endurecimiento: escudo nuevo en cada planta
    this.transition = null;
    this.room = null;
    this.horda = null;

    // La llave del mini jefe, en su habitación; y el superviviente, si esta partida le toca esta planta (superviviente.js)
    const { key } = this.floor;
    if (key) key.room.props.push(new DoorKey(key.name, key.x, key.y));
    this.colocarSuperviviente();
    for (const a of this.floor.armaritos || []) a.room.props.push(new Armarito(a.x, a.y, a.reach));

    // Sala de mantenimiento: la mesa con el ordenador, donde se cambian dólares por puntos de talento (ordenador.js)
    if (this.floorNum === 1) this.floor.start.props.push(new Ordenador(ORDENADOR_X));
    // y a su lado el baúl, donde se ven los objetos guardados de otras partidas
    if (this.floorNum === 1) this.floor.start.props.push(new Baul(BAUL_X));
    // y al otro lado, el banco de trabajo, donde se crean armas con los objetos (banco.js)
    if (this.floorNum === 1) this.floor.start.props.push(new BancoTrabajo(BANCO_X));
    // En el modo pruebas, todas las armas en el suelo de la sala de mantenimiento, en fila (abajo)
    if (this.testMode && this.floorNum === 1) {
      const lay = this.floor.start.layout;
      const armas = Object.keys(WEAPONS).filter((id) => id !== 'fregona');
      armas.forEach((id, i) => this.floor.start.props.push(new WeaponProp(WEAPONS[id], lay.w / 2 + (i - (armas.length - 1) / 2) * 80, lay.h - WALL - 70)));
    }
    // Salas de exposición del modo pruebas: todos los muebles a la izquierda y todos los zombis a la derecha
    const { expo } = this.floor;
    if (expo) {
      expo.muebles.props.push(new ExposicionMuebles());
      expo.zombis.props.push(...expoZombis(this.spriteIds || []));
    }
    this.enterRoom(this.floor.start, this.floor.startExit);
    if (this.floorNum > 1) return; // en las demás plantas el cartel lo pone el propio mapa al entrar
    // primera partida: recordatorio de los controles
    const firstTime = loadSave().runs <= 1;
    this.banner = {
      icon: this.building.id,
      title: this.building.name,
      sub: this.testMode ? 'Modo pruebas · teclas 1-6: zombis · 7-8: jefes · a los lados: exposiciones'
        : firstTime ? 'Muévete con WASD o flechas · Espacio para esquivar'
        : this.savedKeys >= PRECIO_PUNTO ? 'Cambia tus dólares por puntos en el ordenador' : this.floorLabel,
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

  // Inventario (Tab, I, Select del mando o tocar la mochila del HUD): las dos armas y la mochila
  openInventario() {
    if (this.state !== 'playing' || this.paused || this.player.dead) return;
    this.paused = true;
    this.pauseOpen = true;
    clearInput();
    this.invSel = null;
    this.drawInventario();
  }

  // Vuelve a pintar el inventario. Al tocar una casilla se elige (`invSel`: 'm2' = la 3.ª de la mochila,
  // 'g0' = la 1.ª arma guardada, 'c0' = la 1.ª creada) y salen los botones de tirarla al suelo o ponérsela
  drawInventario() {
    this.ui.showInventario(this, this.invSel, {
      cerrar: () => this.closePause(),
      elegir: (clave) => { sfx.click(); this.invSel = this.invSel === clave ? null : clave; this.drawInventario(); },
      tirar: () => this.tirarDelInventario(),
      poner: () => this.ponerDelInventario(),
    });
  }

  // Tira al suelo, a los pies de Johnny, lo elegido en el inventario: un objeto o un arma guardada
  tirarDelInventario() {
    const clave = this.invSel, p = this.player;
    const i = Number(clave?.slice(1));
    const id = casillasMochila(this.mochila)[i]?.[0];
    if (clave?.[0] === 'm' && id) {
      // los iguales van juntos en una casilla: se tira uno
      const pk = this.dropPickup('objeto', p.x, p.y + 30);
      pk.obj = this.mochila.splice(this.mochila.lastIndexOf(id), 1)[0];
      pk.tirado = true; // no vuelve solo a la mochila hasta que Johnny se aleje (game-combate.js)
    } else if (clave?.[0] === 'g' && this.armasGuardadas[i]) {
      const pr = new WeaponProp(this.armasGuardadas.splice(i, 1)[0], p.x, p.y + 40);
      pr.armed = false; // hay que apartarse antes de volver a cogerla
      this.room.props.push(pr);
    } else return;
    sfx.click();
    this.invSel = null;
    this.drawInventario();
  }

  // Al coger otra arma cuerpo a cuerpo, la fregona y las armas creadas no se quedan en el suelo: van al
  // inventario. Recibe lo que devuelve `equip` (la que había en ese hueco) y devuelve lo que hay que dejar en el
  // suelo (o null)
  guardarFregona(old) {
    if (old?.weapon.id !== 'fregona' && !old?.weapon.creada) return old;
    this.guardarArma(old.weapon, old.ammo);
    return null;
  }

  // Guarda un arma en el inventario: las creadas vuelven a su lista (armas-creadas.js); las demás, a las guardadas
  // `ammo` es la munición que llevaba si era de fuego ({ mag, reserve }): se guarda para cuando se la vuelva a poner
  guardarArma(w, ammo = null) {
    if (!w) return;
    if (w.creada) { w.creada.ammo = ammo; this.armasCreadas.push(w.creada); }
    else { this.armasGuardadas.push(w); if (ammo) this.ammoGuardada.set(w, ammo); }
  }

  // Se pone en la mano el arma cuerpo a cuerpo elegida en el inventario ('g0' guardada, 'c0' creada) y la que
  // llevaba pasa al inventario
  ponerDelInventario() {
    const clave = this.invSel, p = this.player;
    const i = Number(clave?.slice(1));
    let w = null, ammo = null;
    if (clave?.[0] === 'g' && this.armasGuardadas[i]) {
      w = this.armasGuardadas.splice(i, 1)[0];
      ammo = this.ammoGuardada.get(w) || null;
      this.ammoGuardada.delete(w);
    } else if (clave?.[0] === 'c' && ['melee', 'ranged'].includes(this.armasCreadas[i]?.hueco)) {
      const a = this.armasCreadas.splice(i, 1)[0];
      ammo = a.ammo || null;
      w = armaDeCreada(a);
    }
    if (!w) return;
    const old = p.equip(w, ammo);
    this.guardarArma(old?.weapon, old?.ammo);
    sfx.click();
    this.invSel = null;
    this.drawInventario();
  }

  // Baúl de la sala de mantenimiento: enseña los objetos guardados de otras partidas (save.baul) y las armas
  // creadas en el banco (save.baulArmas); las armas se pueden sacar para esta partida (banco.js, sacarDelBaul)
  openBaul() {
    if (this.state !== 'playing' || this.paused || this.player.dead) return;
    this.paused = true;
    this.pauseOpen = true;
    clearInput();
    sfx.click();
    this.baulSel = null;
    this.drawBaul();
  }

  drawBaul() {
    this.ui.showBaul(loadSave(), this.baulSel, {
      cerrar: () => this.closePause(),
      elegir: (clave) => { sfx.click(); this.baulSel = this.baulSel === clave ? null : clave; this.drawBaul(); },
      sacar: () => this.sacarDelBaul(),
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
        // los dólares de la partida solo se guardan si completas el edificio; si caes, se pierden
        s.keys += this.runKeys;
        // y los objetos de la mochila pasan al baúl (si caes, también se pierden)
        for (const id of this.mochila) s.baul[id] = (s.baul[id] || 0) + 1;
        s.totalKeys += this.runKeys;
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
      { retry: () => this.newRun(), menu: () => this.goMenu() },
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
    this.abrirBano(); // si es el piso del superviviente, se abre la puerta de su baño

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

  // Cosas del mapa: el ordenador, la llave del mini jefe, los armaritos del baño, supervivientes y armas en el suelo
  updateProps() {
    const p = this.player;
    if (p.dead) return;
    for (const pr of this.room.props) {
      if (pr.taken) continue;
      if (pr.kind === 'ordenador' || pr.kind === 'baul' || pr.kind === 'banco') {
        // Mesa del ordenador o baúl: basta con arrimarse para abrirlo. Al cerrarlo hay que apartarse un poco
        // antes de que vuelva a abrirse (si no, se abriría otra vez nada más cerrarlo).
        const gap = obstacleGap(pr, p);
        if (gap > p.r + 30) pr.armed = true;
        else if (pr.armed && gap < p.r + 6) {
          pr.armed = false;
          if (pr.kind === 'baul') this.openBaul();
          else if (pr.kind === 'banco') this.openBanco();
          else this.openOrdenador();
        }
        continue;
      }
      if (pr.kind === 'armarito') {
        // Armarito colgado en la pared: se coge plantándose delante (o delante del mueble que tenga debajo).
        // El botiquín cura al cogerlo; con la vida llena se deja para luego
        const delante = Math.abs(p.x - pr.x) < 46 && p.y > pr.y - 10 && p.y - pr.y < pr.reach;
        if (!delante) { pr.armed = true; continue; }
        if (!pr.armed) continue;
        pr.armed = false; // hay que apartarse antes de volver a intentarlo
        if (p.hp >= p.vidaTope()) {
          this.floatText(pr.x, pr.y - 90, 'Tienes la vida al máximo', '#dfe7f2', 18);
          continue;
        }
        pr.taken = true;
        this.healPlayer(BOTIQUIN_CURA + this.stats.medkitBonus); // Sanitario: curan más
        this.burst(pr.x, pr.y - 50, '#80ed99', 12, 14);
        sfx.gem();
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
        this.superviventeRescatado();
        this.banner = { icon: pr.def.id, title: `¡${pr.def.name} se une!`, sub: pr.def.desc, t: 0 };
        this.burst(pr.x, pr.y, pr.def.color, 14, 16);
        sfx.clear();
      } else if (pr.kind === 'weapon' && pr.armed) {
        // Cogemos el arma: va a su hueco, y la que hubiera en ese hueco se queda en el suelo (con sus balas).
        // La fregona no: va al inventario. Si no queda nada que dejar, el arma desaparece del suelo
        const old = this.guardarFregona(p.equip(pr.weapon, pr.ammo));
        if (old) { pr.weapon = old.weapon; pr.ammo = old.ammo; } else pr.taken = true;
        pr.armed = false; // hay que alejarse antes de poder volver a cogerla
        // la primera vez que encuentras un arma se apunta en el guardado
        this.unlockWeapon(this.player.weapon.id);
        this.banner = {
          title: `${this.player.weapon.icon} ${this.player.weapon.name}`,
          sub: weaponSummary(this.player.weapon),
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
    p.hp = Math.min(p.vidaTope(), p.hp + n); // los tercios perdidos no se curan
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
    if (!p.dead) {
      if (consumeSwitch()) p.switchHand(this);
      if (consumeReload()) p.startReload(this);
      p.update(dt, this, getMoveVector(), consumeDash());
      actualizarMutaciones(this, p, dt); // las mutaciones que actúan solas cada pocos segundos
    }
    this.actualizarArmasCreadas(dt); // sangrar, veneno y el detalle del arma creada (armas-creadas.js)
    this.camera.update(dt, p);
    if (consumeTossSwitch()) this.switchToss();
    this.updateToss();
    for (const a of this.allies) a.update(dt, this);

    this.updateWaves(dt);
    this.updateFog(dt);

    for (const e of this.enemies) {
      e.update(dt, this);
      if (e.active && e.dmg > 0 && !e.mareado && !p.dead && dist(e, p) < e.r + p.r - 4) p.hurt(e.dmg, this);
    }
    this.separateEnemies();
    this.enemies = this.enemies.filter((e) => !e.dead);

    this.updateBullets(dt);
    this.updateHazards(dt);
    this.updateGrenades(dt);
    this.updatePickups(dt);
    this.updateParticles(dt);
    this.updateDoors(dt);
    this.updateProps();
    this.actualizarSocorro(dt); // el superviviente encerrado grita (superviviente.js)
    this.actualizarHorda(dt);   // y, ya rescatado, la horda mientras fuerza la puerta

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
    if (this.room.cleared || this.horda) return; // en la horda del superviviente manda superviviente.js
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

  onPlayerDeath() {
    const p = this.player;
    // Desfibrilador: la primera vez que caes en el edificio, vuelves con toda la vida
    if (this.stats.revive && !this.reviveUsed) {
      this.reviveUsed = true;
      p.hp = this.stats.maxHp;
      p.tercios = 3;
      p.invuln = 2;
      this.hurtFlash = 0;
      this.burst(p.x, p.y, '#80ed99', 24, p.r);
      this.banner = { icon: 'medico', title: '¡Desfibrilador!', sub: 'Vuelves con toda la vida (solo una vez por edificio)', t: 0 };
      sfx.clear();
      return;
    }
    p.dead = true;
    this.burst(p.x, p.y, '#ffd23f', 30, p.r);
    this.shake(18);
    this.later(1.4, () => this.endRun(false));
  }

}

// Añade a Game los métodos de otra clase (así game.js se reparte en varios archivos)
function addMethods(target, source) {
  for (const name of Object.getOwnPropertyNames(source.prototype)) {
    if (name !== 'constructor') Object.defineProperty(target.prototype, name, Object.getOwnPropertyDescriptor(source.prototype, name));
  }
}
addMethods(Game, GameCombat);    // balas, golpes, muertes y botín (game-combate.js)
addMethods(Game, GameEffects);   // partículas, manchas, textos y temblor (game-efectos.js)
addMethods(Game, GameMap);       // choques, niebla y lo que ven y oyen los zombis (game-mapa.js)
addMethods(Game, ZombieAttacks); // ataques especiales de los zombis (game-ataques.js)
addMethods(Game, GameDrawing);   // dibujo (game-dibujo.js)
addMethods(Game, GranadaMethods); // la granada de Johnny (granada.js)
addMethods(Game, MolotovMethods); // el cóctel molotov de Johnny (molotov.js)
addMethods(Game, BancoMethods);    // el banco de trabajo: crear armas con objetos (banco.js)
addMethods(Game, ArmasCreadasMethods); // lo que hacen las armas creadas al golpear (armas-creadas.js)
addMethods(Game, OrdenadorMethods); // el ordenador de mantenimiento: compra de puntos de talento (ordenador.js)
addMethods(Game, SupervivienteMethods); // el superviviente encerrado en el baño (superviviente.js)
addMethods(Game, MutacionMethods); // el recuadro de elegir mutación al caer un mini jefe (mutaciones.js)
