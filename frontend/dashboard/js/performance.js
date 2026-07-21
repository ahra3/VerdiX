import Chart from 'chart.js/auto';

export function initPerformanceCharts() {
    console.log("Initializing Performance Charts...");
    
    // Set global chart defaults for dark theme
    Chart.defaults.color = '#8b9bb4';
    Chart.defaults.borderColor = 'rgba(255,255,255,0.1)';

    initLatencyChart();
    initDistributionChart();
}

function initLatencyChart() {
    const ctx = document.getElementById('latencyChart');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['10s', '20s', '30s', '40s', '50s', '60s'],
            datasets: [{
                label: 'Inference Latency (ms)',
                data: [120, 135, 110, 150, 125, 140],
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.05)' }
                },
                x: {
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function initDistributionChart() {
    const ctx = document.getElementById('distributionChart');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['SERVICE_DISRUPTION', 'METADATA_INCONSISTENCY', 'INCOMPLETE_PIPELINE', 'BLOCK_LIFECYCLE_ERROR', 'WRITE_PATH_FAILURE', 'Other'],
            datasets: [{
                data: [35, 15, 20, 10, 15, 5],
                backgroundColor: [
                    '#3b82f6', // blue
                    '#eab308', // yellow
                    '#991b1b', // dark red
                    '#ec4899', // pink
                    '#ef4444', // red
                    '#4b5563'  // gray
                ],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: '#8b9bb4', padding: 20, font: { size: 11 } }
                }
            }
        }
    });
}
