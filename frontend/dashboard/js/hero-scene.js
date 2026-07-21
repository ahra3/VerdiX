import * as THREE from 'three';

export function initHeroScene(container) {
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0e17, 0.002);

    const width = container.clientWidth;
    const height = container.clientHeight;
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);
    } catch (e) {
        console.warn("WebGL not supported, falling back.", e);
        container.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:100%; color:#ef4444; text-align:center; padding: 1rem;">
            WebGL not supported in this environment.<br/>3D Topology disabled.
        </div>`;
        return null;
    }

    // Create HDFS Cluster representation
    const cluster = new THREE.Group();
    scene.add(cluster);

    // Center NameNode
    const nameNodeGeo = new THREE.IcosahedronGeometry(2.5, 1);
    const nameNodeMat = new THREE.MeshBasicMaterial({ 
        color: 0x06b6d4, 
        wireframe: true,
        transparent: true,
        opacity: 0.8
    });
    const nameNode = new THREE.Mesh(nameNodeGeo, nameNodeMat);
    cluster.add(nameNode);

    // Inner glowing sphere for NameNode
    const innerGeo = new THREE.SphereGeometry(1.5, 32, 32);
    const innerMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });
    const innerNode = new THREE.Mesh(innerGeo, innerMat);
    cluster.add(innerNode);

    // Orbiting DataNodes — EACH gets its own material clone to fix the all-red bug
    const dataNodes = [];
    const numDataNodes = 12;
    const radius = 10;

    const dataNodeGeo = new THREE.OctahedronGeometry(0.6, 0);

    for (let i = 0; i < numDataNodes; i++) {
        const theta = (i / numDataNodes) * Math.PI * 2;
        // Clone material per node so color changes are independent!
        const mat = new THREE.MeshBasicMaterial({ color: 0x10b981, wireframe: true });
        const dn = new THREE.Mesh(dataNodeGeo, mat);
        
        dn.position.x = Math.cos(theta) * radius;
        dn.position.z = Math.sin(theta) * radius;
        dn.position.y = (Math.random() - 0.5) * 5;
        
        dn.userData = {
            theta: theta,
            speed: 0.001 + Math.random() * 0.002,
            radius: radius + (Math.random() - 0.5) * 3,
            yOffset: dn.position.y,
            originalColor: 0x10b981
        };

        cluster.add(dn);
        dataNodes.push(dn);

        // Connection line to NameNode
        const lineMat = new THREE.LineBasicMaterial({ 
            color: 0x06b6d4, 
            transparent: true, 
            opacity: 0.15 
        });
        const points = [new THREE.Vector3(0,0,0), dn.position];
        const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(lineGeo, lineMat);
        dn.userData.line = line;
        dn.userData.lineMat = lineMat;
        cluster.add(line);
    }

    // Particles (Data flowing)
    const particlesGeo = new THREE.BufferGeometry();
    const particleCount = 300;
    const posArray = new Float32Array(particleCount * 3);
    
    for(let i = 0; i < particleCount * 3; i++) {
        posArray[i] = (Math.random() - 0.5) * 30;
    }
    
    particlesGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const particlesMat = new THREE.PointsMaterial({
        size: 0.06,
        color: 0x06b6d4,
        transparent: true,
        opacity: 0.6
    });
    
    const particlesMesh = new THREE.Points(particlesGeo, particlesMat);
    scene.add(particlesMesh);

    camera.position.z = 15;
    camera.position.y = 4;
    camera.lookAt(0, 0, 0);

    // State tracking for Alerts
    let activeAlertNode = null;
    let warningBeacon = null;
    // Shared object: screen-space position of the alert node, read by the popup
    const alertScreenPos = { x: 0, y: 0, visible: false };

    // Animation Loop
    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);
        const time = clock.getElapsedTime();

        cluster.rotation.y = time * 0.05;
        nameNode.rotation.x = time * 0.2;
        nameNode.rotation.y = time * 0.3;

        dataNodes.forEach(dn => {
            dn.userData.theta += dn.userData.speed;
            dn.position.x = Math.cos(dn.userData.theta) * dn.userData.radius;
            dn.position.z = Math.sin(dn.userData.theta) * dn.userData.radius;
            dn.position.y = dn.userData.yOffset + Math.sin(time * 2 + dn.userData.theta) * 0.5;
            
            dn.rotation.x += 0.01;
            dn.rotation.y += 0.02;

            const positions = dn.userData.line.geometry.attributes.position.array;
            positions[3] = dn.position.x;
            positions[4] = dn.position.y;
            positions[5] = dn.position.z;
            dn.userData.line.geometry.attributes.position.needsUpdate = true;
        });

        particlesMesh.rotation.y = time * -0.02;

        // Position warning beacon and compute screen coords for popup
        if (activeAlertNode && warningBeacon) {
            warningBeacon.position.x = activeAlertNode.position.x;
            warningBeacon.position.y = activeAlertNode.position.y + 2;
            warningBeacon.position.z = activeAlertNode.position.z;
            warningBeacon.rotation.y = time * 3;

            // Flashing effect on the alert node
            const flash = Math.sin(time * 8) > 0;
            activeAlertNode.material.color.setHex(flash ? 0xef4444 : 0x991b1b);

            // Project 3D position to 2D screen coords for the HTML popup
            const vec = new THREE.Vector3();
            vec.copy(activeAlertNode.position);
            // Apply cluster rotation to get world position
            cluster.localToWorld(vec);
            vec.project(camera);

            const halfWidth = renderer.domElement.clientWidth / 2;
            const halfHeight = renderer.domElement.clientHeight / 2;
            alertScreenPos.x = (vec.x * halfWidth) + halfWidth;
            alertScreenPos.y = -(vec.y * halfHeight) + halfHeight;
            alertScreenPos.visible = true;
        } else {
            alertScreenPos.visible = false;
        }

        renderer.render(scene, camera);
    }

    animate();

    // Handle Resize
    window.addEventListener('resize', () => {
        const newWidth = container.clientWidth;
        const newHeight = container.clientHeight;
        if (newWidth === 0 || newHeight === 0) return;
        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(newWidth, newHeight);
    });

    // API to control states from outside
    return {
        alertScreenPos: alertScreenPos,

        setAlertState: (blockId) => {
            if (activeAlertNode) return;
            // Pick a random DataNode
            activeAlertNode = dataNodes[Math.floor(Math.random() * dataNodes.length)];
            
            // Turn ONLY this node red and scale it up
            activeAlertNode.material.color.setHex(0xef4444);
            activeAlertNode.scale.set(2, 2, 2);
            activeAlertNode.userData.lineMat.color.setHex(0xef4444);
            activeAlertNode.userData.lineMat.opacity = 0.8;

            // Create a spinning warning beacon above it
            const beaconGeo = new THREE.ConeGeometry(0.4, 1.2, 4);
            const beaconMat = new THREE.MeshBasicMaterial({ color: 0xef4444, wireframe: true });
            warningBeacon = new THREE.Mesh(beaconGeo, beaconMat);
            warningBeacon.rotation.x = Math.PI;
            scene.add(warningBeacon);
        },

        setHealedState: () => {
            if (!activeAlertNode) return;
            
            // Pulse cyan for healing
            activeAlertNode.material.color.setHex(0x06b6d4);
            activeAlertNode.userData.lineMat.color.setHex(0x06b6d4);
            
            if (warningBeacon) {
                scene.remove(warningBeacon);
                warningBeacon.geometry.dispose();
                warningBeacon.material.dispose();
                warningBeacon = null;
            }

            // After a few seconds, return to normal green
            const nodeRef = activeAlertNode;
            activeAlertNode = null;
            setTimeout(() => {
                nodeRef.material.color.setHex(nodeRef.userData.originalColor);
                nodeRef.scale.set(1, 1, 1);
                nodeRef.userData.lineMat.color.setHex(0x06b6d4);
                nodeRef.userData.lineMat.opacity = 0.15;
            }, 3000);
        }
    };
}
