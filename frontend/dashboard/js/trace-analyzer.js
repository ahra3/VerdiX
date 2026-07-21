/* Trace Analyzer JS */

let tracesData = [];
let isAnalyzing = false;
let typewriterTimeout;

export async function initTraceAnalyzer() {
    console.log("Initializing Trace Analyzer...");
    
    try {
        // Fetch data
        const res = await fetch('./data/cot_analysis_results.json');
        const rawData = await res.json();
        
        // Filter out items without parsed_action
        tracesData = rawData.filter(d => d.parsed_action);
        
        // Populate dropdown
        const selector = document.getElementById('trace-selector');
        selector.innerHTML = '';
        
        tracesData.forEach((trace, index) => {
            const opt = document.createElement('option');
            opt.value = index;
            // Shorten block id
            const shortId = trace.trace_data.block_id.substring(0, 15) + '...';
            const status = trace.parsed_action.classification === 'NORMAL' ? '🟢' : '🔴';
            opt.textContent = `${status} Trace ${index + 1}: ${shortId}`;
            selector.appendChild(opt);
        });

        // Attach listener
        document.getElementById('btn-analyze').addEventListener('click', startAnalysis);

    } catch (err) {
        console.error("Failed to load trace data:", err);
        document.getElementById('trace-selector').innerHTML = '<option>Error loading data</option>';
    }
}

function startAnalysis() {
    if (isAnalyzing) return;
    
    const selector = document.getElementById('trace-selector');
    const selectedIdx = selector.value;
    if (selectedIdx === '') return;
    
    const data = tracesData[selectedIdx];
    isAnalyzing = true;
    
    const btn = document.getElementById('btn-analyze');
    btn.disabled = true;
    btn.textContent = 'Analyzing...';
    btn.classList.add('pulse');

    // Reset UI
    document.getElementById('action-card').classList.add('hidden');
    document.getElementById('event-timeline').innerHTML = '';
    const twContent = document.getElementById('typewriter-content');
    twContent.innerHTML = '<span class="prompt">$</span> ';
    if (typewriterTimeout) clearTimeout(typewriterTimeout);

    // 1. Draw timeline
    drawTimeline(data.trace_data.sequence);

    // 2. Start typewriter effect for reasoning
    // The raw output contains markdown like **PREMISE**:
    typewriterEffect(twContent, data.raw_output, () => {
        // Callback when finished
        revealActionCard(data.parsed_action);
        
        isAnalyzing = false;
        btn.disabled = false;
        btn.textContent = 'Analyze Trace';
        btn.classList.remove('pulse');
    });
}

function drawTimeline(sequence) {
    const timeline = document.getElementById('event-timeline');
    
    sequence.forEach((event, idx) => {
        setTimeout(() => {
            const el = document.createElement('div');
            el.className = 'event-node event-enter';
            
            // Highlight specific events (just an example heuristic)
            if (event === 'E4' || event === 'E7' || event === 'E12' || event === 'E13') {
                el.classList.add('error');
            } else if (['E22', 'E26', 'E5'].includes(event)) {
                el.classList.add('highlight');
            }
            
            el.innerHTML = `
                <div class="event-id">${event}</div>
                <div class="event-line"></div>
            `;
            timeline.appendChild(el);
            
            // Scroll to bottom
            timeline.scrollTop = timeline.scrollHeight;
        }, idx * 100); // 100ms per event
    });
}

function typewriterEffect(element, text, callback) {
    let i = 0;
    
    // We do a simple character by character, but handle newlines
    function typeChar() {
        if (i < text.length) {
            let char = text.charAt(i);
            
            if (char === '\n') {
                element.appendChild(document.createElement('br'));
            } else {
                element.appendChild(document.createTextNode(char));
            }
            
            i++;
            // Scroll to bottom
            element.parentElement.scrollTop = element.parentElement.scrollHeight;
            
            // Randomize typing speed for realism (10 to 40 ms)
            let speed = Math.random() * 30 + 10;
            typewriterTimeout = setTimeout(typeChar, speed);
        } else {
            if (callback) callback();
        }
    }
    
    typeChar();
}

function revealActionCard(action) {
    const card = document.getElementById('action-card');
    card.classList.remove('hidden');
    
    const modeEl = document.getElementById('res-mode');
    modeEl.textContent = action.failure_mode;
    
    if (action.failure_mode !== 'NORMAL') {
        modeEl.className = 'value error';
    } else {
        modeEl.className = 'value normal';
    }
    
    document.getElementById('res-conf').textContent = (action.confidence * 100) + '%';
    document.getElementById('res-root').textContent = action.root_cause;
    document.getElementById('res-remedy').textContent = `[${action.remediation.priority}] ${action.remediation.action}: ${action.remediation.details}`;
    
    // Animate pop-in
    card.style.animation = 'popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';
}
