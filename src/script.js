const gameOverDiv = document.querySelector('.game-over');
import * as THREE from 'three'
import gsap from 'gsap'
import GUI from 'lil-gui'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/Addons.js'
const canvas = document.querySelector('canvas.webgl')
let gui;

const scene = new THREE.Scene()
scene.background = new THREE.Color('#e6e6e6')
const sizes = { width: window.innerWidth, height: window.innerHeight }
const cursor = { x: 0, y: 0 }
const ambientLight = new THREE.HemisphereLight(0xffffff, 0.3)
const directionalLight = new THREE.DirectionalLight(0xffffff, 2)
const loader = new GLTFLoader();
const pressedKeys = new Set()
let playerMesh
let floorMesh

let enemies = []
let enemySpawnTimer = 0
let enemySpawnInterval = 2
let enemySpawnTimerOnPlayer = 0
let enemySpawnIntervalOnPlayer = 1

let isAlive = true;
let score = 0;
let scoreInterval;

let enemyFallSpeedMultiplier = 1;

const values = {
    enemyFallSpeedIncrementor: 0.0001,
    playerVelocity : 0,
    acceleration : 0.06,
    maxSpeed : 2,
    damping : 0.7
}

function setupGUI() {
    if (gui) gui.destroy();
    gui = new GUI();
    gui.add(values, 'enemyFallSpeedIncrementor').min(0.00001).max(0.0002).step(0.00001).name('enemy speed up');
    gui.add(values, 'acceleration').min(0.01).max(0.1).step(0.01).name('acceleration');
    gui.add(values, 'maxSpeed').min(1).max(2).step(0.01).name('max speed');
    gui.add(values, 'damping').min(0.7).max(0.99).step(0.01).name('damping');
}

function createLights() {
    directionalLight.position.set(-3, 2, 1)
    scene.add(directionalLight)
    scene.add(ambientLight)
    directionalLight.castShadow = true
}

function createMesh1() {
    const material = new THREE.MeshToonMaterial({color: 'red'})
    const mesh1 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material)
    mesh1.position.y = -2.7
    mesh1.geometry.parameters = { width: 1, height: 1, depth: 1 }
    scene.add(mesh1)
    gui.add(mesh1.position, 'y').min(-2).max(2).step(0.01).name('elevation')
    gui.addColor(mesh1.material, 'color')
    mesh1.castShadow = true
    mesh1.receiveShadow = true


    loader.load('/models/playerModel.glb', (gltf) => {
    const model = gltf.scene;
    model.position.set(0, 0, 0);
    scene.add(model);
    })
        return mesh1
}

function createMesh2() {
    const material = new THREE.MeshBasicMaterial({ color: 'white' })
    const widthParams = { width: 10 }
    const mesh2 = new THREE.Mesh(new THREE.BoxGeometry( 10, 1, 1.3), material);
    mesh2.position.y = -3.6
    scene.add(mesh2)

    gui.add(widthParams, 'width').min(1).max(20).step(0.01).name('floor width')
        .onChange((value) => {
            mesh2.geometry.dispose()
            mesh2.geometry = new THREE.BoxGeometry(value, 1, 1.3)
        })
    mesh2.geometry.parameters = widthParams

    mesh2.castShadow = true
    mesh2.receiveShadow = true
    return mesh2
}
function random(min, max) {
    return Math.random() * (max - min) + min
}

function createEnemy() {
    const enemySize = random(0.6, 1.2)
    const geometry = new THREE.BoxGeometry(enemySize, enemySize, enemySize)
    const material = new THREE.MeshToonMaterial({ color: 'lightred' })
    const enemy = new THREE.Mesh(geometry, material)
    enemy.position.set(
        (floorMesh.geometry.parameters.width / 2 - floorMesh.geometry.parameters.width) + Math.random() * floorMesh.geometry.parameters.width,
        window.innerHeight / 100,
        0
    )

    enemy.fallSpeed = random(0.04, 0.08)
    enemy.castShadow = true

    scene.add(enemy)
    enemies.push(enemy)
}

function createEnemyOnPlayer() {
    const enemySize = random(0.6, 1.2)
    const geometry = new THREE.BoxGeometry(enemySize, enemySize, enemySize)
    const material = new THREE.MeshToonMaterial({ color: 'lightred' })
    const enemy = new THREE.Mesh(geometry, material)
    enemy.position.set(
        playerMesh.position.x,
        window.innerHeight / 100,
        0
    )

    enemy.fallSpeed = random(0.06, 0.08)

    scene.add(enemy)
    enemies.push(enemy)
}

function setRandomTimeInterval() {
    enemySpawnInterval = Math.random() * 1.5 + 0.2
}

function createObjects() {
    playerMesh = createMesh1()
    floorMesh = createMesh2()
}

function createCamera() {
    const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height)
    camera.position.z = 7
    scene.add(camera)
    return camera
}

function createRenderer() {
    const renderer = new THREE.WebGLRenderer({ canvas: canvas })
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true
    document.body.appendChild(renderer.domElement)
    return renderer
}

function createControls(camera) {
    const controls = new OrbitControls(camera, canvas)
    controls.enableDamping = true
    controls.enableZoom = false
    controls.enablePan = false
    return controls
}

function handleResize(camera, renderer) {
    window.addEventListener('resize', () => {
        sizes.width = window.innerWidth
        sizes.height = window.innerHeight
        camera.aspect = sizes.width / sizes.height
        camera.updateProjectionMatrix()
        renderer.setSize(sizes.width, sizes.height)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    })
}

function handleMovementInput() {
    window.addEventListener('keydown', e => {
        pressedKeys.add(e.key)
    })
    window.addEventListener('keyup', e => {
        pressedKeys.delete(e.key)
    })
}

function handleCursor() {
    window.addEventListener('mousemove', e => {
        cursor.x = e.clientX / sizes.width - 0.5
        cursor.y = e.clientY / sizes.height - 0.5
    })
}

createLights()
setupGUI()
createObjects()
const camera = createCamera()
const renderer = createRenderer()
const controls = createControls(camera)
handleResize(camera, renderer)
handleCursor()
handleMovementInput()

function removeEnemies() {
        const toRemove = enemies.filter(enemy => enemy.position.y < floorMesh.position.y)
    toRemove.forEach(enemy => {
        scene.remove(enemy)
    })
    enemies = enemies.filter(enemy => enemy.position.y >= floorMesh.position.y)
}

function makeEnemiesFall(){
    if (!isAlive) return;
    enemies.forEach(enemy => {
        enemy.position.y -= enemy.fallSpeed * enemyFallSpeedMultiplier
        if (enemyFallSpeedMultiplier < 3){
            enemyFallSpeedMultiplier += values.enemyFallSpeedIncrementor
        }
    })
}

function movePlayer() {
        // Acceleration
    if (pressedKeys.has('ArrowLeft') || pressedKeys.has('a')) {
        values.playerVelocity -= values.acceleration
    }
    if (pressedKeys.has('ArrowRight') || pressedKeys.has('d')) {
        values.playerVelocity += values.acceleration
    }

    // Clamp velocity
    values.playerVelocity = Math.max(-values.maxSpeed, Math.min(values.maxSpeed, values.playerVelocity))

    // Damping
    values.playerVelocity *= values.damping

    // Move player
    let nextX = playerMesh.position.x + values.playerVelocity

    // Boundaries
    const leftLimit = ((floorMesh.geometry.parameters.width / 2) - floorMesh.geometry.parameters.width) + playerMesh.geometry.parameters.width / 2
    const rightLimit = (floorMesh.geometry.parameters.width / 2) - playerMesh.geometry.parameters.width / 2

    if (nextX < leftLimit) {
        nextX = leftLimit
        values.playerVelocity = 0
    }
    if (nextX > rightLimit) {
        nextX = rightLimit
        values.playerVelocity = 0
    }

    playerMesh.position.x = nextX
}

function checkCollisions() {
  const playerBox = new THREE.Box3().setFromObject(playerMesh);

  enemies.forEach((enemy) => {
    const enemyBox = new THREE.Box3().setFromObject(enemy);

    if (playerBox.intersectsBox(enemyBox) && isAlive) {
        isAlive = false;
        dieAnim();
    }
  });
}

function dieAnim(){
    gsap.to(playerMesh.scale, { x: 0, y: 0, z: 0, duration: 0.3, ease: 'power2.in' })
    gsap.to(camera.position, { z: 10, duration: 1, ease: 'power2.inOut' })

    enemies.forEach(enemy => {
        gsap.to(enemy.scale, { x: 0, y: 0, z: 0, duration: 0.3, ease: 'power2.in', delay: 0.2  })
    });

    // Update score in game-over overlay
    const scoreElem = document.querySelector('.game-over-score');
    if (scoreElem) scoreElem.textContent = score;

    clearInterval(scoreInterval);

    gsap.to('.scoreboard', {
        opacity: 0,
        scale: 0,
        duration: 1,
        ease: 'power2.inOut',
    })
    gsap.to('.game-over', {
        opacity: 1,
        duration: 1,
        ease: 'power2.inOut',
        delay: 1,
        onStart: () => {
            gameOverDiv.style.opacity = 0;
        },
        onComplete: () => {
            gameOverDiv.style.pointerEvents = 'auto';
        }
    });
}
    gsap.to('.scoreboard', {
        opacity: 1,
        scale: 1,
        transformOrigin: "center center",
        duration: 1,
        ease: 'power2.inOut',
    })

const clock = new THREE.Clock()

function tick() {
    const delta = clock.getDelta()
    movePlayer()
    enemySpawnTimer += delta

    if (enemySpawnTimer > enemySpawnInterval) {
        if (isAlive) {
            createEnemy()
            setRandomTimeInterval()
            enemySpawnTimer = 0
        }
    }

    if (enemySpawnTimerOnPlayer > enemySpawnIntervalOnPlayer) {
        if (isAlive){
            createEnemyOnPlayer()
            enemySpawnTimerOnPlayer = 0
        }
    }
    enemySpawnTimerOnPlayer += delta

    checkCollisions()

    makeEnemiesFall()

    removeEnemies()

    controls.update()
    renderer.render(scene, camera)
    window.requestAnimationFrame(tick)
}


function restartGame() {
        enemies.forEach(enemy => scene.remove(enemy));
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
            const scoreDisplay = document.querySelector('.score-value');
            if (scoreDisplay) scoreDisplay.textContent = score;
        }
    }, 1000);

    const scoreDisplay = document.querySelector('.score-value');
    if (scoreDisplay) scoreDisplay.textContent = score;
    gsap.to('.scoreboard', {
        opacity: 1,
        scale: 1,
        transformOrigin: "center center",
        duration: 1,
        ease: 'power2.inOut',
    })

        camera.position.set(0, 0, 7);

        const gameOverDiv = document.querySelector('.game-over');
        gameOverDiv.style.opacity = 0;
        gameOverDiv.style.pointerEvents = 'none';

        if (playerMesh) playerMesh.scale.set(1, 1, 1);

        enemies.forEach(enemy => enemy.scale.set(1, 1, 1));
}

scoreInterval = setInterval(() => {
    if (isAlive) {
        score++;
        const scoreDisplay = document.querySelector('.score-value');
        if (scoreDisplay) scoreDisplay.textContent = score;
    }
}, 1000);

document.getElementById("restart-btn").addEventListener("click", () => {
    restartGame();
});

tick()
