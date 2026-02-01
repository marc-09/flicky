/*
 * ONE MORE STEP - Game Jam Entry
 * 
 * What this is:
 * A pig needs to reach the goal but every move costs energy!
 * Avoid the moving red hazards or you'll lose even more energy.
 * 
 * How to play:
 * - Use WASD or Arrow Keys to move
 * - Press R to restart
 * - Press M to mute/unmute
 * 
 * What I tried to implement:
 * - Moving hazards with different patterns
 * - Energy system where every move costs something
 * - Smooth animations and particle effects
 * - Sound effects using Web Audio API
 * - Complete game flow with menus
 */

// Get canvas and context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set canvas size
canvas.width = 800;
canvas.height = 600;

// Game state
let gameState = 'title'; // title, playing, won, lost
let isMuted = false;

// Player object
let player = {
    x: 50,
    y: 550,
    size: 30,
    speed: 40, // moves in grid steps
    energy: 100,
    steps: 0
};

// Goal object
let goal = {
    x: 750,
    y: 50,
    size: 40,
    pulseSize: 0 // for animation
};

// Walls array - these are the maze walls
let walls = [
    // Top wall
    {x: 0, y: 0, width: 800, height: 20},
    // Bottom wall
    {x: 0, y: 580, width: 800, height: 20},
    // Left wall
    {x: 0, y: 0, width: 20, height: 600},
    // Right wall
    {x: 780, y: 0, width: 20, height: 600},
    // Some internal walls to make it more like a maze
    {x: 200, y: 100, width: 20, height: 300},
    {x: 400, y: 200, width: 20, height: 380},
    {x: 600, y: 20, width: 20, height: 400}
];

// Hazards array - moving obstacles
let hazards = [
    // Hazard 1 - moves horizontally
    {x: 100, y: 200, width: 100, height: 20, speedX: 2, speedY: 0, direction: 1},
    // Hazard 2 - moves horizontally slower
    {x: 300, y: 400, width: 120, height: 20, speedX: 1.5, speedY: 0, direction: -1},
    // Hazard 3 - moves horizontally fast
    {x: 500, y: 300, width: 80, height: 20, speedX: 3, speedY: 0, direction: 1}
];

// Timer
let startTime = 0;
let elapsedTime = 0;

// Particle system for confetti
let particles = [];

// Screen shake
let shakeAmount = 0;

// Audio context for sounds
let audioContext;

// Initialize audio on first user interaction
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

// Play a simple tone
function playSound(frequency, duration, type = 'sine') {
    if (isMuted || !audioContext) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = type;
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
}

// Movement sound - soft click
function playMoveSound() {
    playSound(300, 0.05, 'square');
}

// Hit sound - buzz
function playHitSound() {
    playSound(100, 0.3, 'sawtooth');
}

// Win sound - pleasant rising tone
function playWinSound() {
    if (isMuted || !audioContext) return;
    playSound(400, 0.2);
    setTimeout(() => playSound(500, 0.2), 100);
    setTimeout(() => playSound(600, 0.3), 200);
}

// Lose sound - sad tone
function playLoseSound() {
    if (isMuted || !audioContext) return;
    playSound(200, 0.5);
}

// Reset game
function resetGame() {
    player.x = 50;
    player.y = 550;
    player.energy = 100;
    player.steps = 0;
    
    // Reset hazards
    hazards[0].x = 100;
    hazards[0].direction = 1;
    hazards[1].x = 300;
    hazards[1].direction = -1;
    hazards[2].x = 500;
    hazards[2].direction = 1;
    
    particles = [];
    shakeAmount = 0;
    startTime = Date.now();
    elapsedTime = 0;
}

// Check if player collides with walls
function checkWallCollision(newX, newY) {
    for (let wall of walls) {
        if (newX < wall.x + wall.width &&
            newX + player.size > wall.x &&
            newY < wall.y + wall.height &&
            newY + player.size > wall.y) {
            return true; // collision detected
        }
    }
    return false;
}

// Check if player collides with hazards
function checkHazardCollision() {
    for (let hazard of hazards) {
        if (player.x < hazard.x + hazard.width &&
            player.x + player.size > hazard.x &&
            player.y < hazard.y + hazard.height &&
            player.y + player.size > hazard.y) {
            return true; // collision detected
        }
    }
    return false;
}

// Check if player reached the goal
function checkGoalReached() {
    const dist = Math.sqrt(
        Math.pow(player.x + player.size/2 - (goal.x + goal.size/2), 2) +
        Math.pow(player.y + player.size/2 - (goal.y + goal.size/2), 2)
    );
    return dist < (player.size/2 + goal.size/2);
}

// Move player
function movePlayer(dx, dy) {
    if (gameState !== 'playing') return;
    
    const newX = player.x + dx * player.speed;
    const newY = player.y + dy * player.speed;
    
    // Check if move is valid (no wall collision)
    if (!checkWallCollision(newX, newY)) {
        player.x = newX;
        player.y = newY;
        player.steps++;
        player.energy--; // every move costs 1 energy
        
        playMoveSound();
        
        // Check if energy is gone
        if (player.energy <= 0) {
            gameState = 'lost';
            showLoseScreen();
            playLoseSound();
        }
        
        // Check if goal reached
        if (checkGoalReached()) {
            gameState = 'won';
            showWinScreen();
            playWinSound();
            createConfetti();
        }
    }
}

// Update hazards
function updateHazards() {
    for (let hazard of hazards) {
        // Move hazard
        hazard.x += hazard.speedX * hazard.direction;
        
        // Bounce off walls (with some padding)
        if (hazard.x < 30 || hazard.x + hazard.width > 770) {
            hazard.direction *= -1;
        }
    }
}

// Update timer
function updateTimer() {
    if (gameState === 'playing') {
        elapsedTime = Math.floor((Date.now() - startTime) / 1000);
        const minutes = Math.floor(elapsedTime / 60);
        const seconds = elapsedTime % 60;
        document.getElementById('timerDisplay').textContent = 
            `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

// Update HUD
function updateHUD() {
    document.getElementById('energyDisplay').textContent = player.energy;
    document.getElementById('stepsDisplay').textContent = player.steps;
}

// Create confetti particles
function createConfetti() {
    for (let i = 0; i < 50; i++) {
        particles.push({
            x: canvas.width / 2,
            y: canvas.height / 2,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10 - 5,
            color: `hsl(${Math.random() * 360}, 70%, 60%)`,
            size: Math.random() * 5 + 2,
            life: 1
        });
    }
}

// Update particles
function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.3; // gravity
        p.life -= 0.02;
        
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

// Draw player (cute pig)
function drawPlayer() {
    ctx.save();
    
    // Pig body
    ctx.fillStyle = '#ffb3d9';
    ctx.fillRect(player.x, player.y, player.size, player.size);
    
    // Pig ears
    ctx.fillStyle = '#ff99cc';
    ctx.beginPath();
    ctx.arc(player.x + 8, player.y + 5, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(player.x + player.size - 8, player.y + 5, 5, 0, Math.PI * 2);
    ctx.fill();
    
    // Pig eyes
    ctx.fillStyle = '#000';
    ctx.fillRect(player.x + 8, player.y + 12, 4, 4);
    ctx.fillRect(player.x + player.size - 12, player.y + 12, 4, 4);
    
    // Pig snout
    ctx.fillStyle = '#ff85b3';
    ctx.fillRect(player.x + 10, player.y + 20, 10, 6);
    ctx.fillStyle = '#000';
    ctx.fillRect(player.x + 12, player.y + 22, 2, 2);
    ctx.fillRect(player.x + 16, player.y + 22, 2, 2);
    
    ctx.restore();
}

// Draw goal (glowing tile)
function drawGoal() {
    ctx.save();
    
    // Pulsing animation
    goal.pulseSize = Math.sin(Date.now() / 200) * 5;
    
    // Outer glow
    ctx.fillStyle = 'rgba(102, 255, 102, 0.3)';
    ctx.fillRect(
        goal.x - goal.pulseSize,
        goal.y - goal.pulseSize,
        goal.size + goal.pulseSize * 2,
        goal.size + goal.pulseSize * 2
    );
    
    // Main goal
    ctx.fillStyle = '#66ff66';
    ctx.fillRect(goal.x, goal.y, goal.size, goal.size);
    
    // Inner highlight
    ctx.fillStyle = '#99ff99';
    ctx.fillRect(goal.x + 5, goal.y + 5, goal.size - 10, goal.size - 10);
    
    ctx.restore();
}

// Draw walls
function drawWalls() {
    ctx.fillStyle = '#2a2a4e';
    for (let wall of walls) {
        ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
    }
}

// Draw hazards
function drawHazards() {
    ctx.fillStyle = 'rgba(255, 50, 50, 0.7)';
    for (let hazard of hazards) {
        ctx.fillRect(hazard.x, hazard.y, hazard.width, hazard.height);
        
        // Add a glow effect
        ctx.fillStyle = 'rgba(255, 100, 100, 0.3)';
        ctx.fillRect(hazard.x - 2, hazard.y - 2, hazard.width + 4, hazard.height + 4);
        ctx.fillStyle = 'rgba(255, 50, 50, 0.7)';
    }
}

// Draw particles
function drawParticles() {
    for (let p of particles) {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        ctx.restore();
    }
}

// Main game loop
function gameLoop() {
    // Clear canvas with screen shake
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Apply screen shake
    if (shakeAmount > 0) {
        ctx.translate(
            Math.random() * shakeAmount - shakeAmount / 2,
            Math.random() * shakeAmount - shakeAmount / 2
        );
        shakeAmount *= 0.9;
        if (shakeAmount < 0.1) shakeAmount = 0;
    }
    
    // Draw background
    ctx.fillStyle = '#0f0f1e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw game elements
    drawWalls();
    drawGoal();
    drawHazards();
    drawPlayer();
    drawParticles();
    
    ctx.restore();
    
    // Update game
    if (gameState === 'playing') {
        updateHazards();
        updateTimer();
        updateHUD();
        updateParticles();
        
        // Check hazard collision
        if (checkHazardCollision()) {
            player.energy -= 10; // big penalty
            shakeAmount = 10; // screen shake
            playHitSound();
            
            if (player.energy <= 0) {
                player.energy = 0;
                gameState = 'lost';
                showLoseScreen();
                playLoseSound();
            }
        }
    } else if (gameState === 'won') {
        updateParticles();
    }
    
    requestAnimationFrame(gameLoop);
}

// Show/hide screens
function showTitleScreen() {
    document.getElementById('titleScreen').classList.remove('hidden');
    document.getElementById('howToPlayScreen').classList.add('hidden');
    document.getElementById('gameContainer').classList.add('hidden');
    document.getElementById('winScreen').classList.add('hidden');
    document.getElementById('loseScreen').classList.add('hidden');
    gameState = 'title';
}

function showHowToPlayScreen() {
    document.getElementById('titleScreen').classList.add('hidden');
    document.getElementById('howToPlayScreen').classList.remove('hidden');
}

function startGame() {
    initAudio(); // Initialize audio on first interaction
    document.getElementById('titleScreen').classList.add('hidden');
    document.getElementById('howToPlayScreen').classList.add('hidden');
    document.getElementById('gameContainer').classList.remove('hidden');
    document.getElementById('winScreen').classList.add('hidden');
    document.getElementById('loseScreen').classList.add('hidden');
    
    resetGame();
    gameState = 'playing';
}

function showWinScreen() {
    const minutes = Math.floor(elapsedTime / 60);
    const seconds = elapsedTime % 60;
    
    document.getElementById('finalSteps').textContent = player.steps;
    document.getElementById('finalTime').textContent = 
        `${minutes}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById('finalEnergy').textContent = player.energy;
    document.getElementById('winScreen').classList.remove('hidden');
}

function showLoseScreen() {
    const minutes = Math.floor(elapsedTime / 60);
    const seconds = elapsedTime % 60;
    
    document.getElementById('loseSteps').textContent = player.steps;
    document.getElementById('loseTime').textContent = 
        `${minutes}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById('loseScreen').classList.remove('hidden');
}

// Keyboard controls
document.addEventListener('keydown', (e) => {
    // Movement controls
    if (e.key === 'w' || e.key === 'ArrowUp') {
        movePlayer(0, -1);
    } else if (e.key === 's' || e.key === 'ArrowDown') {
        movePlayer(0, 1);
    } else if (e.key === 'a' || e.key === 'ArrowLeft') {
        movePlayer(-1, 0);
    } else if (e.key === 'd' || e.key === 'ArrowRight') {
        movePlayer(1, 0);
    }
    
    // Restart
    if (e.key === 'r' || e.key === 'R') {
        if (gameState === 'playing') {
            resetGame();
        }
    }
    
    // Mute toggle
    if (e.key === 'm' || e.key === 'M') {
        isMuted = !isMuted;
        document.getElementById('muteBtn').textContent = isMuted ? '🔇' : '🔊';
    }
});

// Button event listeners
document.getElementById('playBtn').addEventListener('click', startGame);
document.getElementById('howToPlayBtn').addEventListener('click', showHowToPlayScreen);
document.getElementById('backBtn').addEventListener('click', showTitleScreen);
document.getElementById('playAgainBtn').addEventListener('click', startGame);
document.getElementById('retryBtn').addEventListener('click', startGame);
document.getElementById('muteBtn').addEventListener('click', () => {
    isMuted = !isMuted;
    document.getElementById('muteBtn').textContent = isMuted ? '🔇' : '🔊';
});

// Start the game loop
gameLoop();
