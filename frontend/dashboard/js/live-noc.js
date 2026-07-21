// ==========================================
// LIVE NOC WEBSOCKET INTEGRATION
// ==========================================

export function initLiveNOC(heroAPI) {
    console.log("🔌 Initializing Live NOC Integration...");
    
    // UI Elements
    const terminalOutput = document.getElementById('analyzer-output');
    const tickerList = document.getElementById('live-ticker-list');
    const ledgerBody = document.getElementById('ledger-body');
    const globalStatusDot = document.getElementById('global-status-dot');
    const globalStatusText = document.getElementById('global-status-text');
    const logsPerMin = document.getElementById('logs-per-min');
    const activeBlocksEl = document.getElementById('active-blocks');
    const nodePopup = document.getElementById('node-alert-popup');
    const popupText = document.getElementById('popup-text');
    const topologyCell = document.querySelector('.topology-cell');

    // State
    let logCount = 0;
    let popupAnimFrame = null;
    let totalLogsIngested = 0;
    const activeBlocks = new Set();
    
    // Periodically update the logs/min display based on real traffic
    setInterval(() => {
        // Multiply by 60 because we update every 1s, but logCount is since last second
        // To smooth it out, we'll keep a running average or just reset every second
        const ratePerMin = logCount * 60; 
        logsPerMin.innerText = `Ingesting: ~${ratePerMin} logs/min`;
        logCount = 0; // Reset for the next second's calculation
    }, 1000);

    // Popup position tracker — reads alertScreenPos from heroAPI every frame
    function startPopupTracking() {
        function updatePopup() {
            if (heroAPI && heroAPI.alertScreenPos && heroAPI.alertScreenPos.visible) {
                const rect = topologyCell.getBoundingClientRect();
                const localX = heroAPI.alertScreenPos.x;
                const localY = heroAPI.alertScreenPos.y;
                
                // Position popup above the node, clamped within bounds
                const popupWidth = nodePopup.offsetWidth;
                const clampedX = Math.max(popupWidth / 2, Math.min(localX, rect.width - popupWidth / 2));
                const clampedY = Math.max(40, localY - 40);

                nodePopup.style.left = `${clampedX}px`;
                nodePopup.style.top = `${clampedY}px`;
                nodePopup.style.transform = 'translateX(-50%)';
            }
            popupAnimFrame = requestAnimationFrame(updatePopup);
        }
        updatePopup();
    }

    function stopPopupTracking() {
        if (popupAnimFrame) {
            cancelAnimationFrame(popupAnimFrame);
            popupAnimFrame = null;
        }
    }

    // Show/hide popup
    function showPopup(text, state) {
        popupText.innerText = text;
        nodePopup.className = `node-popup ${state}`;
    }

    function hidePopup() {
        nodePopup.className = 'node-popup hidden';
        stopPopupTracking();
    }

    // 2. Connect to Go Backend via WebSocket
    function connect() {
        console.log("Attempting to connect to Live Go Backend...");
        const socket = new WebSocket('ws://localhost:8080/ws');

        socket.onopen = function() {
            console.log("✅ Connected to Live AIOps Backend!");
            globalStatusDot.className = "pulse-dot green";
            globalStatusText.innerText = "System Nominal - Listening to Kafka";
        };

        socket.onmessage = function(event) {
            const textData = event.data;
            
            // Check if this is a raw log for the Ingestion Feed
            if (textData.startsWith("LOG:")) {
                logCount++;
                totalLogsIngested++;
                
                const rawLog = textData.substring(4);
                // Extract block ID to show in ticker
                const match = rawLog.match(/(blk_[-0-9]+)/);
                if (match) {
                    const blockId = match[1];
                    
                    // Track unique blocks dynamically
                    activeBlocks.add(blockId);
                    activeBlocksEl.innerText = `Tracking: ${activeBlocks.size} active`;
                    
                    const li = document.createElement('li');
                    li.innerText = `> ${rawLog.substring(0, 45)}... [${blockId}]`;
                    tickerList.prepend(li);
                    
                    if (tickerList.children.length > 20) {
                        tickerList.removeChild(tickerList.lastChild);
                    }
                }
                return; // Stop here, it's not an LLM diagnosis
            }

            // Check for API Error
            if (textData.startsWith("API_ERROR:")) {
                console.log("⚠️ LLM API Limit Reached!");
                showPopup('⚠️ LLM API Error!', 'diagnosing');
                
                terminalOutput.innerHTML = "";
                typeWriter(`🚨 SYSTEM ALERT: LLM API Issue.\n\n${textData.substring(10)}\n\nCannot diagnose further anomalies until API recovers or a new key is provided.`, terminalOutput, 10, () => {
                    setTimeout(() => {
                        hidePopup();
                    }, 5000);
                });
                return; // Stop here, do NOT trigger 3D node alerts and do NOT add to ledger
            }

            // Otherwise, it's an AI Diagnosis!
            console.log("🚨 INCOMING AI DIAGNOSIS!");
            const geminiText = textData;
            
            // Extract Block ID
            let blockId = "blk_unknown";
            const blockMatch = geminiText.match(/(blk_[-0-9]+)/);
            if (blockMatch) {
                blockId = blockMatch[1];
            }

            // Extract Failure Mode
            let failureMode = "UNKNOWN";
            const modeMatch = geminiText.match(/\*\*DEDUCTION\*\*.*?((?:WRITE_PATH|INCOMPLETE_PIPELINE|BLOCK_LIFECYCLE|SERVE_FAILURE|EMPTY_PACKET|METADATA_INCONSISTENCY|REPLICATION_FAILURE|SILENT_RECOVERY)[A-Z_]*)/i);
            if (modeMatch) {
                failureMode = modeMatch[1].toUpperCase();
            } else if (geminiText.includes('WRITE_PATH_FAILURE')) {
                failureMode = 'WRITE_PATH_FAILURE';
            } else if (geminiText.includes('API_RATE_LIMIT_EXCEEDED')) {
                failureMode = 'API_RATE_LIMIT_EXCEEDED';
            }

            // === PHASE 1: ALERT STATE ===
            globalStatusDot.className = "pulse-dot red";
            globalStatusText.innerText = `ALERT: Anomaly detected on ${blockId}`;
            
            // Trigger 3D Node Alert
            if (heroAPI) heroAPI.setAlertState(blockId);
            
            // Show floating popup: "Anomaly detected"
            showPopup(`🚨 Anomaly detected: ${blockId}`, 'alert');
            startPopupTracking();

            // === PHASE 2: DIAGNOSING (after 1.5s, switch popup to diagnosing) ===
            setTimeout(() => {
                showPopup('🔍 Diagnosing problem...', 'diagnosing');
            }, 1500);

            // Type out reasoning in terminal
            terminalOutput.innerHTML = "";
            typeWriter(geminiText, terminalOutput, 10, () => {
                // === PHASE 3: HEALED ===
                setTimeout(() => {
                    globalStatusDot.className = "pulse-dot cyan";
                    globalStatusText.innerText = "Healed: Automated Remediation Complete";
                    
                    // Trigger 3D Node Healing
                    if (heroAPI) heroAPI.setHealedState();
                    
                    // Update popup to healed
                    showPopup('✅ Problem resolved!', 'healed');
                    
                    // Add to Ledger
                    addLedgerEntry(blockId, failureMode, "Restarted DataNode / Checked Disk");

                    // After a few seconds, hide popup and return to nominal
                    setTimeout(() => {
                        hidePopup();
                        globalStatusDot.className = "pulse-dot green";
                        globalStatusText.innerText = "System Nominal";
                    }, 4000);
                }, 1000);
            });
        };

        socket.onclose = function() {
            console.log("❌ Disconnected. Retrying...");
            globalStatusDot.className = "pulse-dot yellow";
            globalStatusText.innerText = "Connection Lost. Retrying...";
            setTimeout(connect, 5000);
        };
        
        socket.onerror = function(error) {
            console.error("WebSocket Error:", error);
        };
    }

    connect();

    // Utility: Typewriter effect
    let currentTypewriterTimeout = null;
    
    function typeWriter(text, element, speed = 20, callback = null) {
        // Clear any existing typewriter loop immediately to prevent overlapping rubbish text
        if (currentTypewriterTimeout) {
            clearTimeout(currentTypewriterTimeout);
            currentTypewriterTimeout = null;
        }

        let i = 0;
        function type() {
            if (i < text.length) {
                element.innerHTML += text.charAt(i);
                element.scrollTop = element.scrollHeight;
                i++;
                currentTypewriterTimeout = setTimeout(type, speed);
            } else if (callback) {
                currentTypewriterTimeout = null;
                callback();
            }
        }
        type();
    }

    // Utility: Add to Ledger
    function addLedgerEntry(blockId, mode, action) {
        const tr = document.createElement('tr');
        const now = new Date();
        const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        
        tr.innerHTML = `
            <td>${timeStr}</td>
            <td style="font-family: var(--font-mono);">${blockId}</td>
            <td style="color: #ef4444; font-weight: 600;">${mode}</td>
            <td style="color: #06b6d4;">${action}</td>
            <td>✅ Resolved</td>
        `;
        ledgerBody.prepend(tr);
    }
}
