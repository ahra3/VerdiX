import { initHeroScene } from './hero-scene.js';
import { initLiveNOC } from './live-noc.js';

// ==========================================
// BACKGROUND PARTICLE SYSTEM (green dots)
// ==========================================
function initBackgroundParticles() {
    const canvas = document.getElementById('bg-particles');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const particles = [];
    const count = 80;

    for (let i = 0; i < count; i++) {
        particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
            r: Math.random() * 2 + 1,
            opacity: Math.random() * 0.4 + 0.1
        });
    }

    function draw() {
        ctx.clearRect(0, 0, width, height);
        
        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;

            // Wrap around edges
            if (p.x < 0) p.x = width;
            if (p.x > width) p.x = 0;
            if (p.y < 0) p.y = height;
            if (p.y > height) p.y = 0;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(16, 185, 129, ${p.opacity})`;
            ctx.fill();
        });

        // Draw faint connecting lines between nearby particles
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 150) {
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(16, 185, 129, ${0.08 * (1 - dist / 150)})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }

        requestAnimationFrame(draw);
    }

    draw();

    window.addEventListener('resize', () => {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
    });
}

// ==========================================
// MAIN INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('NOC Dashboard initialized');
        
        // Start background particles
        initBackgroundParticles();

        // Initialize 3D Hero Scene
        const heroContainer = document.getElementById('hero-canvas-container');
        let heroAPI = null;
        if (heroContainer) {
            heroAPI = initHeroScene(heroContainer);
        }

        // Initialize WebSockets and Live UI logic
        initLiveNOC(heroAPI);

    } catch (error) {
        document.body.innerHTML += `<div style="position:fixed; top:0; left:0; background:red; color:white; z-index:9999; padding:20px;"><h2>JS Error:</h2><pre>${error.stack || error}</pre></div>`;
    }
});
