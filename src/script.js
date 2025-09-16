// =======================
// Imports & Global Setup
// =======================
import * as THREE from "three";
import gsap from "gsap";
import GUI from "lil-gui";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import { Howl, Howler } from "howler";

const canvas = document.querySelector("canvas.webgl");
const gameOverDiv = document.querySelector(".game-over");

// =======================
// Scene & Camera
// =======================
const scene = new THREE.Scene();
scene.background = new THREE.Color("#e6e6e6");

const sizes = { width: window.innerWidth, height: window.innerHeight };
const cursor = { x: 0, y: 0 };

// =======================
// Lighting
// =======================
const ambientLight = new THREE.HemisphereLight(0xffffff, 0.3);
const directionalLight = new THREE.DirectionalLight(0xffffff, 2);

// =======================
// Loaders & Controls
// =======================
const loader = new GLTFLoader();
let gui;
let camera = new Set();
let renderer = new Set();
let controls = new Set();

// =======================
// Game Objects
// =======================
let playerMesh;
let floorMesh;
let enemies = [];

// =======================
// Game State
// =======================
let enemySpawnTimer = 0;
let enemySpawnInterval = 2;
let enemySpawnTimerOnPlayer = 0;
let enemySpawnIntervalOnPlayer = 1;
let isAlive = true;
let score = 0;
let scoreInterval;
let enemyFallSpeedMultiplier = 1;
const pressedKeys = new Set();

// =======================
// Audio
// =======================
var backgroundMusic,
  lobbyBackgroundMusic,
  dieSound,
  UIHoverSound,
  gameStartSound,
  turnSound;
let musicVolume = 0.05;
let sfxVolume = 0.05;

// =======================
// Configurable Values
// =======================
const values = {
  enemyFallSpeedIncrementor: 0.0001,
  playerVelocity: 0,
  acceleration: 0.06,
  maxSpeed: 2,
  damping: 0.7,
};

// =======================
// GUI Setup
// =======================
function setupGUI() {
  if (gui) gui.destroy();
  gui = new GUI();
  gui
    .add(values, "enemyFallSpeedIncrementor")
    .min(0.00001)
    .max(0.0002)
    .step(0.00001)
    .name("enemy speed up");
  gui
    .add(values, "acceleration")
    .min(0.01)
    .max(0.1)
    .step(0.01)
    .name("acceleration");
  gui.add(values, "maxSpeed").min(1).max(2).step(0.01).name("max speed");
  gui.add(values, "damping").min(0.7).max(0.99).step(0.01).name("damping");
}

// =======================
// Lighting Setup
// =======================
function createLights() {
  directionalLight.position.set(-3, 2, 1);
  scene.add(directionalLight);
  scene.add(ambientLight);
  directionalLight.castShadow = true;
}

// =======================
// Player & Floor Creation
// =======================
function loadPlayerModel() {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      "/models/playerModel.glb",
      (gltf) => {
        const model = gltf.scene;
        model.scale.set(0, 0, 0);
        model.position.set(0, -2.6, 0);
        model.castShadow = true;
        model.receiveShadow = true;

        const material = new THREE.MeshStandardMaterial({ color: 0xff5555 });
        model.traverse((child) => {
          if (child.isMesh) {
            child.material = material;
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        scene.add(model);
        resolve(model);
      },
      undefined,
      reject
    );
  });
}

function createMesh2() {
  const material = new THREE.MeshBasicMaterial({ color: "white" });
  const widthParams = { width: 10 };
  const mesh2 = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 1.3), material);
  mesh2.position.y = -3.6;
  scene.add(mesh2);

  gui
    .add(widthParams, "width")
    .min(1)
    .max(20)
    .step(0.01)
    .name("floor width")
    .onChange((value) => {
      mesh2.geometry.dispose();
      mesh2.geometry = new THREE.BoxGeometry(value, 1, 1.3);
    });
  mesh2.geometry.parameters = widthParams;

  mesh2.castShadow = true;
  mesh2.receiveShadow = true;
  return mesh2;
}

// =======================
// Enemy Creation
// =======================
function random(min, max) {
  return Math.random() * (max - min) + min;
}

function createEnemy() {
  const enemySize = random(0.6, 1.2);
  const geometry = new THREE.BoxGeometry(enemySize, enemySize, enemySize);
  const material = new THREE.MeshToonMaterial({ color: "gray" });
  const enemy = new THREE.Mesh(geometry, material);
  enemy.position.set(
    floorMesh.geometry.parameters.width / 2 -
      floorMesh.geometry.parameters.width +
      Math.random() * floorMesh.geometry.parameters.width,
    window.innerHeight / 100,
    0
  );

  enemy.fallSpeed = random(0.04, 0.08);
  enemy.castShadow = true;

  scene.add(enemy);
  enemies.push(enemy);
}

function createEnemyOnPlayer() {
  const enemySize = random(0.6, 1.2);
  const geometry = new THREE.BoxGeometry(enemySize, enemySize, enemySize);
  const material = new THREE.MeshToonMaterial({ color: "gray" });
  const enemy = new THREE.Mesh(geometry, material);
  enemy.position.set(playerMesh.position.x, window.innerHeight / 100, 0);

  enemy.fallSpeed = random(0.06, 0.08);

  scene.add(enemy);
  enemies.push(enemy);
}

function setRandomTimeInterval() {
  enemySpawnInterval = Math.random() * 1.5 + 0.2;
}

// =======================
// Scene Initialization
// =======================
function createObjects() {
  init();
  floorMesh = createMesh2();
}

function createCamera() {
  const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height);
  camera.position.z = 7;
  scene.add(camera);
  return camera;
}

function createRenderer() {
  const renderer = new THREE.WebGLRenderer({ canvas: canvas });
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);
  return renderer;
}

function createControls(camera) {
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enableZoom = false;
  controls.enablePan = false;
  return controls;
}

function handleResize(camera, renderer) {
  window.addEventListener("resize", () => {
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;
    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  });
}

function handleMovementInput() {
  window.addEventListener("keydown", (e) => {
    pressedKeys.add(e.key);
  });
  window.addEventListener("keyup", (e) => {
    pressedKeys.delete(e.key);
  });
}

function handleCursor() {
  window.addEventListener("mousemove", (e) => {
    cursor.x = e.clientX / sizes.width - 0.5;
    cursor.y = e.clientY / sizes.height - 0.5;
  });
}

function initializeScene() {
  createLights();
  setupGUI();
  createObjects();
  camera = createCamera();
  renderer = createRenderer();
  handleResize(camera, renderer);
  handleCursor();
  handleSounds();

  gsap.to(".start-screen", {
    opacity: 1,
    duration: 1,
    ease: "power2.inOut",
  });

  gsap.to(".start-screen", {
    scale: 1.05,
    duration: 1,
    yoyo: true,
    repeat: -1,
    ease: "power1.inOut",
  });

  gsap.to(".start-screen button", {
    scale: 1.1,
    duration: 1,
    yoyo: true,
    repeat: -1,
    ease: "power1.inOut",
  });
}

// =======================
// Game Start/Restart
// =======================
function resetScene() {
  gsap.to(camera.position, { z: 7, duration: 1, ease: "power2.inOut" });
}

async function init() {
  const player = await loadPlayerModel();
  playerMesh = player;

  playerMesh.scale.set(0, 0, 0);

  gsap.to(playerMesh.scale, {
    x: 0.5,
    y: 0.5,
    z: 0.5,
    duration: 0.5,
    delay: 1,
    ease: "power2.inOut",
  });

  gui.add(player.position, "y").min(-2).max(2).step(0.01).name("elevation");
}

function startGame() {
  score = 0;
  const scoreDisplay = document.querySelector(".score-value");
  scoreDisplay.textContent = score;

  gameStartSound.play();
  controls = createControls(camera);
  handleMovementInput();
  loadScoreboard();
  resetScene();
  tick();
}

function restartGame() {
  gameStartSound.play();
  resetScene();
  gsap.to(lobbyBackgroundMusic, {
    volume: 0,
    duration: 1,
    onComplete: () => {
      lobbyBackgroundMusic.stop();
    },
  });
  enemies.forEach((enemy) => scene.remove(enemy));
  enemies = [];

  if (playerMesh) scene.remove(playerMesh);
  if (floorMesh) scene.remove(floorMesh);

  enemyFallSpeedMultiplier = 1;

  isAlive = true;
  enemySpawnTimer = 0;
  enemySpawnInterval = 2;
  enemySpawnTimerOnPlayer = 0;
  enemySpawnIntervalOnPlayer = 1;
  values.playerVelocity = 0;

  score = 0;
  clearInterval(scoreInterval);
  setupGUI();
  createObjects();
  scoreInterval = setInterval(() => {
    if (isAlive) {
      score++;
      const scoreDisplay = document.querySelector(".score-value");
      if (scoreDisplay) scoreDisplay.textContent = score;
    }
  }, 1000);
  backgroundMusic.stop();
  backgroundMusic.play();
  gsap.to(backgroundMusic, { volume: 1 * musicVolume, duration: 1 });

  const scoreDisplay = document.querySelector(".score-value");
  if (scoreDisplay) scoreDisplay.textContent = score;
  gsap.to(".scoreboard", {
    opacity: 1,
    scale: 1,
    transformOrigin: "center center",
    duration: 1,
    ease: "power2.inOut",
  });

  const gameOverDiv = document.querySelector(".game-over");
  gameOverDiv.style.opacity = 0;
  gameOverDiv.style.pointerEvents = "none";

  if (playerMesh) playerMesh.scale.set(1, 1, 1);

  enemies.forEach((enemy) => enemy.scale.set(1, 1, 1));
}

// =======================
// Audio Setup
// =======================
function handleSounds() {
  backgroundMusic = new Howl({
    volume: 1 * musicVolume,
    src: ["sfx/backgroundSound.mp3"],
    loop: true,
  });

  dieSound = new Howl({
    volume: 1 * sfxVolume,
    src: ["sfx/dieSfx.mp3"],
    loop: false,
  });

  UIHoverSound = new Howl({
    volume: 1 * sfxVolume * 3,
    src: ["sfx/UIHover.mp3"],
    loop: false,
  });
  gameStartSound = new Howl({
    volume: 1 * sfxVolume * 3,
    src: ["sfx/GameStartSound.mp3"],
    loop: false,
  });
  lobbyBackgroundMusic = new Howl({
    volume: 0,
    src: ["sfx/lobbySound.mp3"],
    loop: false,
  });

  turnSound = new Howl({
    volume: 1 * sfxVolume * 2,
    src: ["sfx/turnSound.mp3"],
    loop: false,
  });

  backgroundMusic.play();
}

// =======================
// Game Loop & Mechanics
// =======================
function removeEnemies() {
  const toRemove = enemies.filter(
    (enemy) => enemy.position.y < floorMesh.position.y
  );
  toRemove.forEach((enemy) => {
    scene.remove(enemy);
  });
  enemies = enemies.filter((enemy) => enemy.position.y >= floorMesh.position.y);
}

function makeEnemiesFall(delta) {
  if (!isAlive) return;
  const moveMultiplier = 60;
  enemies.forEach((enemy) => {
    enemy.position.y -= enemy.fallSpeed * enemyFallSpeedMultiplier;
    if (enemyFallSpeedMultiplier < 3) {
      enemyFallSpeedMultiplier +=
        values.enemyFallSpeedIncrementor * delta * moveMultiplier;
    }
  });
}

function movePlayer(delta) {
  let previousDirection = movePlayer.lastDirection || 0;
  let currentDirection = 0;
  const moveMultiplier = 60;

  if (pressedKeys.has("ArrowLeft") || pressedKeys.has("a")) {
    if (playerMesh != null)
      values.playerVelocity -= values.acceleration * delta * moveMultiplier;
    currentDirection = -1;
  }
  if (pressedKeys.has("ArrowRight") || pressedKeys.has("d")) {
    if (playerMesh != null)
      values.playerVelocity += values.acceleration * delta * moveMultiplier;
    currentDirection = 1;
  }

  if (currentDirection !== 0 && currentDirection !== previousDirection) {
    turnSound.play();
  }
  movePlayer.lastDirection = currentDirection;

  values.playerVelocity = Math.max(
    -values.maxSpeed,
    Math.min(values.maxSpeed, values.playerVelocity)
  );

  values.playerVelocity *= Math.pow(values.damping, delta * 60);

  let nextX;
  if (playerMesh != null) {
    nextX =
      playerMesh.position.x + values.playerVelocity * delta * moveMultiplier;
  }

  const leftLimit =
    floorMesh.geometry.parameters.width / 2 -
    floorMesh.geometry.parameters.width +
    1;
  const rightLimit = floorMesh.geometry.parameters.width / 2 - 0.5;

  if (nextX < leftLimit) {
    nextX = leftLimit;
    values.playerVelocity = 0;
  }
  if (nextX > rightLimit) {
    nextX = rightLimit;
    values.playerVelocity = 0;
  }

  if (playerMesh != null) {
    playerMesh.position.x = nextX;
  }
}

function checkCollisions() {
  if (!playerMesh) return;
  const playerBox = new THREE.Box3().setFromObject(playerMesh);

  enemies.forEach((enemy) => {
    const enemyBox = new THREE.Box3().setFromObject(enemy);

    if (playerBox.intersectsBox(enemyBox) && isAlive) {
      isAlive = false;
      dieAnim();
    }
  });
}

function dieAnim() {
  dieSound.play();
  lobbyBackgroundMusic.stop();
  lobbyBackgroundMusic.play();
  gsap.to(playerMesh.scale, {
    x: 0,
    y: 0,
    z: 0,
    duration: 0.3,
    ease: "power2.in",
  });
  gsap.to(camera.position, { z: 10, duration: 1, ease: "power2.inOut" });

  enemies.forEach((enemy) => {
    gsap.to(enemy.scale, {
      x: 0,
      y: 0,
      z: 0,
      duration: 0.3,
      ease: "power2.in",
      delay: 0.2,
    });
  });

  gsap.to(lobbyBackgroundMusic, {
    volume: 1 * musicVolume,
    duration: 1,
    delay: 0.2,
  });

  gsap.to(backgroundMusic, { volume: 0, duration: 1 });

  const scoreElem = document.querySelector(".game-over-score");
  if (scoreElem) scoreElem.textContent = score;

  clearInterval(scoreInterval);

  gsap.to(".scoreboard", {
    opacity: 0,
    scale: 0,
    duration: 1,
    ease: "power2.inOut",
  });
  gsap.to(".game-over", {
    opacity: 1,
    duration: 1,
    ease: "power2.inOut",
    delay: 1,
    onStart: () => {
      gameOverDiv.style.opacity = 0;
    },
    onComplete: () => {
      gameOverDiv.style.pointerEvents = "auto";
    },
  });

  gsap.to(".game-over button", {
    scale: 1.2,
    duration: 0.5,
    onComplete: () => {
      gsap.to(".game-over button", {
        scale: 1,
        duration: 0.5,
        yoyo: true,
        repeat: -1,
        ease: "power1.inOut",
      });
    },
  });

  gsap.to(".game-over h1", {
    scale: 1.05,
    duration: 1,
    onComplete: () => {
      gsap.to(".game-over h1", {
        scale: 1,
        duration: 1,
        yoyo: true,
        repeat: -1,
        ease: "power1.inOut",
      });
    },
  });

  gsap.to(".game-over p", {
    scale: 1.05,
    duration: 1,
    onComplete: () => {
      gsap.to(".game-over p", {
        scale: 1,
        duration: 1,
        yoyo: true,
        repeat: -1,
        ease: "power1.inOut",
      });
    },
  });
}

function loadScoreboard() {
  gsap.to(".scoreboard", {
    opacity: 1,
    scale: 1,
    transformOrigin: "center center",
    duration: 1,
    ease: "power2.inOut",
  });
}

// =======================
// Main Loop
// =======================
initializeScene();
const clock = new THREE.Clock();

function tick() {
  const delta = clock.getDelta();
  movePlayer(delta);
  enemySpawnTimer += delta;

  if (enemySpawnTimer > enemySpawnInterval) {
    if (isAlive) {
      createEnemy();
      setRandomTimeInterval();
      enemySpawnTimer = 0;
    }
  }

  if (enemySpawnTimerOnPlayer > enemySpawnIntervalOnPlayer) {
    if (isAlive) {
      createEnemyOnPlayer();
      enemySpawnTimerOnPlayer = 0;
    }
  }
  enemySpawnTimerOnPlayer += delta;

  checkCollisions();

  makeEnemiesFall(delta);

  removeEnemies();

  controls.update();
  renderer.render(scene, camera);
  window.requestAnimationFrame(tick);
}

// =======================
// Score Handling
// =======================
scoreInterval = setInterval(() => {
  if (isAlive) {
    score++;
    const scoreDisplay = document.querySelector(".score-value");
    if (scoreDisplay) {
      gsap.to(".scoreboard", {
        scale: 1.05,
        duration: 0.2,
        onComplete: () => {
          gsap.to(".scoreboard", { scale: 1, duration: 0.2 });
        },
      });
      scoreDisplay.textContent = score;
    }
  }
}, 1000);

// =======================
// UI Event Listeners
// =======================
document.getElementById("restart-btn").addEventListener("click", () => {
  restartGame();
});

document.getElementById("start-btn").addEventListener("click", () => {
  gsap.to(".start-screen", {
    opacity: 0,
    duration: 1,
    ease: "power2.inOut",
    onComplete: () => {
      const startScreen = document.querySelector(".start-screen");
      startScreen.style.display = "none";
      startGame();
    },
  });
});

document.getElementById("restart-btn").addEventListener("mouseenter", () => {
  UIHoverSound.play();
});

// Slider for volume control

//I want the slider text to be set to the value of the slider on load
const slider = document.querySelector(".slider input");
const sliderValueDisplay = document.querySelector(".sliderValue");

// Set the slider text to the value of the slider on load
if (slider && sliderValueDisplay) {
  sliderValueDisplay.textContent = Math.round(parseFloat(slider.value) * 100);
  if (backgroundMusic) {
    backgroundMusic.volume(musicVolume);
  }
  if (lobbyBackgroundMusic) {
    lobbyBackgroundMusic.volume(musicVolume);
  }
}

slider.addEventListener("input", (e) => {
  const value = parseFloat(e.target.value);
  musicVolume = value;
  sliderValueDisplay.textContent = Math.round(value * 100);
  if (backgroundMusic) {
    backgroundMusic.volume(musicVolume);
  }
  if (lobbyBackgroundMusic) {
    lobbyBackgroundMusic.volume(musicVolume);
  }
});
