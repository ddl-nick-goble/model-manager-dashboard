// static/js/main.js
const DOMINO_API_BASE = window.location.origin + window.location.pathname.replace(/\/$/, '');
const ORIGINAL_API_BASE = window.DOMINO?.API_BASE || '';
const HARDCODED_MODEL_DATA = window.MODELDATA || [];
console.log('window.DOMINO?.API_BASE', window.DOMINO?.API_BASE);
console.log('window.location.origin', window.location.origin);
console.log('window.location.pathname', window.location.pathname);
console.log('using proxy base', DOMINO_API_BASE);
console.log('proxying to', ORIGINAL_API_BASE);
console.log('HARDCODED_MODEL_DATA', HARDCODED_MODEL_DATA);
const API_KEY = window.DOMINO?.API_KEY || null;

// Global state - single source of truth
let appState = {
    bundles: null,
    policies: {},
    evidence: {},
    models: {},
    tableData: [],
    securityScans: {}
};

// Helper function to make proxy API calls
async function proxyFetch(apiPath, options = {}) {
    const [basePath, queryString] = apiPath.split('?');
    const targetParam = `target=${encodeURIComponent(ORIGINAL_API_BASE)}`;
    const finalQuery = queryString ? `${queryString}&${targetParam}` : targetParam;
    const url = `${DOMINO_API_BASE}/proxy/${basePath.replace(/^\//, '')}?${finalQuery}`;
    
    const defaultHeaders = {
        'X-Domino-Api-Key': API_KEY,
        'accept': 'application/json'
    };
    
    return fetch(url, {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers
        }
    });
}

// Security scan functions
async function triggerSecurityScan(modelName, modelVersion) {
    try {
        const basePath = window.location.pathname.replace(/\/$/, '');
        const response = await fetch(`${basePath}/security-scan-model`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                modelName: modelName,
                version: modelVersion,
                fileRegex: ".*",
                excludeRegex: "(^|/)(node_modules|\\.git|\\.venv|venv|env|__pycache__|\\.ipynb_checkpoints)(/|$)",
                semgrepConfig: "auto",
                includeIssues: true
            })
        });
        
        if (!response.ok) {
            throw new Error(`Security scan failed: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        
        const transformedResult = {
            total_issues: result.scan?.total || 0,
            high_severity: result.scan?.high || 0,
            medium_severity: result.scan?.medium || 0,
            low_severity: result.scan?.low || 0,
            issues: result.issues || [],
            timestamp: Date.now()
        };
        
        return transformedResult;
    } catch (error) {
        console.error('Security scan error:', error);
        throw error;
    }
}

function showSecurityScanSpinner(buttonElement) {
    const originalText = buttonElement.innerHTML;
    buttonElement.innerHTML = '<span class="spinner"></span> Scanning...';
    buttonElement.disabled = true;
    return originalText;
}

function hideSecurityScanSpinner(buttonElement, originalText) {
    buttonElement.innerHTML = originalText;
    buttonElement.disabled = false;
}

function displaySecurityScanResults(results, containerElement) {
    const resultsHtml = `
        <div class="security-scan-results">
            <h4>Security Scan Results</h4>
            <div class="scan-summary">
                <div class="scan-stat">
                    <span class="stat-label">Total Issues:</span>
                    <span class="stat-value ${results.total_issues > 0 ? 'stat-warning' : 'stat-success'}">
                        ${results.total_issues || 0}
                    </span>
                </div>
                <div class="scan-stat">
                    <span class="stat-label">High Severity:</span>
                    <span class="stat-value ${(results.high_severity || 0) > 0 ? 'stat-danger' : 'stat-success'}">
                        ${results.high_severity || 0}
                    </span>
                </div>
                <div class="scan-stat">
                    <span class="stat-label">Medium Severity:</span>
                    <span class="stat-value ${(results.medium_severity || 0) > 0 ? 'stat-warning' : 'stat-success'}">
                        ${results.medium_severity || 0}
                    </span>
                </div>
                <div class="scan-stat">
                    <span class="stat-label">Low Severity:</span>
                    <span class="stat-value">${results.low_severity || 0}</span>
                </div>
            </div>
            ${results.issues && results.issues.length > 0 ? `
                <div class="scan-details">
                    <h5>Issues Found:</h5>
                    <div class="issues-list">
                        ${results.issues.slice(0, 5).map(issue => `
                            <div class="issue-item severity-${issue.severity?.toLowerCase() || 'unknown'}">
                                <div class="issue-title">${issue.test_name || 'Unknown Issue'}</div>
                                <div class="issue-file">${issue.filename || 'Unknown file'}:${issue.line_number || 'N/A'}</div>
                                <div class="issue-message">${issue.issue_text || 'No description available'}</div>
                            </div>
                        `).join('')}
                        ${results.issues.length > 5 ? `
                            <div class="more-issues">
                                ... and ${results.issues.length - 5} more issues
                            </div>
                        ` : ''}
                    </div>
                </div>
            ` : '<div class="no-issues">No security issues found!</div>'}
            <div class="scan-timestamp">
                <small>Scanned: ${new Date(results.timestamp || Date.now()).toLocaleString()}</small>
            </div>
        </div>
    `;
    
    containerElement.innerHTML = resultsHtml;
}

async function handleSecurityScan(modelName, modelVersion, buttonElement) {
    const resultsContainer = buttonElement.parentElement.querySelector('.security-scan-container') || 
                           (() => {
                               const container = document.createElement('div');
                               container.className = 'security-scan-container';
                               buttonElement.parentElement.appendChild(container);
                               return container;
                           })();
    
    const originalText = showSecurityScanSpinner(buttonElement);
    
    try {
        const results = await triggerSecurityScan(modelName, modelVersion);
        displaySecurityScanResults(results, resultsContainer);
    } catch (error) {
        resultsContainer.innerHTML = `
            <div class="security-scan-error">
                <h4>Security Scan Failed</h4>
                <p>Error: ${error.message}</p>
                <button onclick="handleSecurityScan('${modelName}', ${modelVersion}, this.parentElement.parentElement.querySelector('.security-scan-btn'))" class="btn btn-secondary">Retry Scan</button>
            </div>
        `;
    } finally {
        hideSecurityScanSpinner(buttonElement, originalText);
    }
}

function createSparkline(data) {
    if (!Array.isArray(data) || data.length === 0) {
        return '<span class="no-data">n/a</span>';
    }
    
    const width = 60;
    const height = 24;
    const padding = 2;
    
    // Fixed scale from 0 to 100
    const min = 0;
    const max = 100;
    const range = 100;
    
    const points = data.map((value, index) => {
        const x = padding + (index / (data.length - 1 || 1)) * (width - padding * 2);
        const y = height - padding - ((value - min) / range) * (height - padding * 2);
        return `${x},${y}`;
    }).join(' ');
    
    const latestValue = data[data.length - 1];
    const percentage = latestValue.toFixed(1);
    
    // Color based on value thresholds
    let colorClass = 'sparkline-good';
    if (latestValue >= 80) {
        colorClass = 'sparkline-good';
        trendClass = 'trend-up';
    } else if (latestValue < 80) {
        colorClass = 'sparkline-bad';
        trendClass = 'trend-down';
    }
    
    const fillColor = latestValue >= 80 ? '#e8faf2' : '#fdecec';
    
    // Create polygon points for filled area (add baseline points)
    const polygonPoints = points + ` ${width - padding},${height - padding} ${padding},${height - padding}`;
    
    return `
        <div class="sparkline-card">
            <svg width="${width}" height="${height}" class="sparkline ${colorClass}">
                <polygon
                    points="${polygonPoints}"
                    fill="${fillColor}"
                    stroke="none"
                />
                <polyline
                    points="${points}"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />
            </svg>
            <span class="sparkline-value ${trendClass}">${percentage}%</span>
        </div>
    `;
}




function processHardcodedData() {
    appState.tableData = HARDCODED_MODEL_DATA.map(model => ({
        modelName: model.name || 'Unknown',
        modelVersion: model.version || 'n/a',
        dominoModelName: model.name || 'Unknown',
        applicationId: `${model.name}_${model.version}` || 'n/a',
        applicationType: model.type || 'Unknown',
        serviceLevel: model.stage || 'Unknown',
        significanceRisk: model.risk_score || 'n/a',
        usageRisk: model.utilization_score || 'n/a',
        complexityRisk: 'n/a',
        userType: 'n/a',
        outputAuthorization: 'n/a',
        expiryDate: model.next_validation || 'n/a',
        securityClassification: 'n/a',
        euAIActRisk: 'n/a',
        modelHealth: model.model_health || [],
        bundleName: 'Hardcoded Data',
        bundleId: null,
        evidenceStatus: '-',
        evidenceCreated: '-',
        owner: 'System',
        createdAt: null,
        experimentId: null,
        findings: [],
        dependencies: [],
        nextValidation: model.next_validation || 'n/a',
        daysNoncompliant: model.days_noncompliant || 0,
        exceptions: Array.isArray(model.exceptions)
          ? model.exceptions.reduce((sum, val) => sum + val, 0)
          : 0,
        exceptionsArray: model.exceptions || [],
        keyMetrics: model.key_metrics,
        tags: model.tags,
        confidenceDistribution: model.confidence_distribution
    }));

    console.log('Hardcoded data processed:', appState.tableData);
}

function renderTable() {
    const tbody = document.querySelector('.table-container tbody');
    if (!tbody) return;

    if (appState.tableData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="13" style="text-align: center; padding: 40px; color: #888;">
                    No models found
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = appState.tableData.map((model, index) => `
        <tr>
            <td>
                <button class="action-btn icon-only" onclick="toggleDetails(this, ${index})">
                    <span class="arrow">►</span>
                </button>
            </td>
            <td>
                <div class="model-name">${model.modelName}</div>
                <div class="model-type">${model.modelVersion}</div>
            </td>
            <td><span class="user-name">${model.applicationType}</span></td>
            <td><span class="status-badge status-${model.serviceLevel?.toLowerCase().replace(/\s+/g, '-')}">${model.serviceLevel}</span></td>
            <td><span class="risk-level" data-risk="${model.significanceRisk}">${model.significanceRisk}</span></td>
            <td><span class="risk-level" data-risk="${model.usageRisk}">${model.usageRisk}</span></td>
            <td><span class="user-name">${model.exceptions}</span></td>
            <td><span class="user-name">${model.daysNoncompliant} days</span></td>
            <td><span class="user-name">${model.nextValidation} days</span></td>
            <td>${createSparkline(model.modelHealth)}</td>
        </tr>
        <tr id="details-${index}" class="expandable-row">
            <td colspan="13">
                <div class="expandable-content">
                    <div class="detail-card-horizontal">
                        <div class="detail-left">
                            <h3>${model.modelName}</h3>
                            <div class="version-text">Version ${model.modelVersion}</div>
                            
                            ${model.tags && model.tags.length > 0 ? `
                                <div class="tags-section">
                                    ${model.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                                </div>
                            ` : ''}
                            
                            <div class="metrics-histogram-row">
                                ${model.keyMetrics && model.keyMetrics.length > 0 ? `
                                    <div class="metrics-compact">
                                        <h5>Key Metrics</h5>
                                        <table class="metrics-table-compact">
                                            <thead>
                                                <tr>
                                                    <th>Metric</th>
                                                    <th>Value</th>
                                                    <th>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${model.keyMetrics.map(metric => `
                                                    <tr>
                                                        <td>${metric.metric}</td>
                                                        <td class="metric-value-cell">${metric.value}</td>
                                                        <td><span class="status-indicator status-${metric.status.toLowerCase()}">${metric.status}</span></td>
                                                    </tr>
                                                `).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                ` : ''}
                                
                                ${model.confidenceDistribution && model.confidenceDistribution.length > 0 ? `
                                    <div class="histogram-section">
                                        <h5>Confidence Distribution</h5>
                                        <div class="histogram">
                                            ${model.confidenceDistribution.map((value, idx) => {
                                                const maxValue = Math.max(...model.confidenceDistribution);
                                                const height = maxValue > 0 ? (value / maxValue * 100) : 0;
                                                return `
                                                    <div class="histogram-bar-wrapper">
                                                        <div class="histogram-bar" style="height: ${height}%">
                                                        </div>
                                                        <div class="histogram-label">${idx * 10}-${(idx + 1) * 10}%</div>
                                                    </div>
                                                `;
                                            }).join('')}
                                        </div>
                                    </div>
                                ` : ''}
                                
                                ${Array.isArray(model.exceptionsArray) && model.exceptionsArray.length > 0 ? `
                                    <div class="histogram-section">
                                        <h5>Exceptions Over Time</h5>
                                        <div class="stepline-chart">
                                            <div class="stepline-y-axis">
                                                <div class="y-axis-label"># Exceptions</div>
                                                <div class="y-axis-ticks">
                                                    ${(() => {
                                                        const maxVal = Math.max(...model.exceptionsArray, 1);
                                                        const ticks = [];
                                                        const step = maxVal <= 4 ? 1 : Math.ceil(maxVal / 4);
                                                        
                                                        for (let i = maxVal; i >= 0; i -= step) {
                                                            ticks.push(`<div class="y-tick">${i}</div>`);
                                                        }
                                                        
                                                        if (ticks[ticks.length - 1] !== '<div class="y-tick">0</div>') {
                                                            ticks.push('<div class="y-tick">0</div>');
                                                        }
                                                        
                                                        return ticks.join('');
                                                    })()}
                                                </div>
                                            </div>
                                            <div class="stepline-chart-area">
                                                <svg class="stepline-svg" viewBox="0 0 300 140" preserveAspectRatio="none">
                                                    <!-- X-axis line -->
                                                    <line x1="10" y1="110" x2="290" y2="110" stroke="#e5e7eb" stroke-width="1"/>
                                                    <!-- Y-axis line -->
                                                    <line x1="10" y1="10" x2="10" y2="110" stroke="#e5e7eb" stroke-width="1"/>
                                                    <!-- Step line -->
                                                    ${(() => {
                                                        const values = model.exceptionsArray;
                                                        const maxVal = Math.max(...values, 1);
                                                        const width = 300;
                                                        const height = 120;
                                                        const padding = 10;
                                                        const stepWidth = (width - padding * 2) / values.length;
                                                        
                                                        let path = `M ${padding} ${height - padding}`;
                                                        values.forEach((val, idx) => {
                                                            const x = padding + idx * stepWidth;
                                                            const y = height - padding - ((val / maxVal) * (height - padding * 2));
                                                            const nextX = padding + (idx + 1) * stepWidth;
                                                            
                                                            path += ` L ${x} ${y}`;
                                                            if (idx < values.length - 1) {
                                                                path += ` L ${nextX} ${y}`;
                                                            }
                                                        });
                                                        
                                                        return `<path d="${path}" fill="none" stroke="#543FDD" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"/>`;
                                                    })()}
                                                </svg>
                                                <div class="stepline-labels">
                                                    ${model.exceptionsArray.map((_, idx) => `
                                                        <div class="stepline-label">${-1*(model.exceptionsArray.length - idx - 0)}d</div>
                                                    `).join('')}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ` : ''}
                            </div>

                            <div class="actions-section">
                                <button class="btn btn-primary" disabled>View Monitoring</button>
                                <button class="btn btn-secondary" disabled>View Bundles</button>
                                ${model.modelName && model.modelVersion
                                    ? `
                                        <button class="btn btn-warning security-scan-btn"
                                            onclick="handleSecurityScan('${model.dominoModelName}', '${model.modelVersion}', this)">
                                            Security Scan
                                        </button>
                                    `
                                    : ''
                                }
                            </div>
                        </div>
                    </div>
                </div>
            </td>
        </tr>
    `).join('');
}




function showLoading() {
    const tbody = document.querySelector('.table-container tbody');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="12" style="text-align: center; padding: 40px;">
                    <div style="color: #543FDD; font-size: 18px;">Loading models...</div>
                </td>
            </tr>
        `;
    }
}

function getInitials(name) {
    return (name || 'Unknown').split(' ').map(n => n[0]).join('').toUpperCase();
}

function formatDate(date) {
    return date ? new Date(date).toLocaleDateString() : 'Unknown';
}

function toggleDetails(button, index) {
    const row = document.getElementById(`details-${index}`);
    const arrow = button.querySelector('.arrow');
    const isCurrentlyOpen = row.classList.contains('show');
    
    document.querySelectorAll('.expandable-row.show').forEach(r => r.classList.remove('show'));
    document.querySelectorAll('.arrow.rotated').forEach(a => a.classList.remove('rotated'));
    document.querySelectorAll('.action-btn.expanded').forEach(b => {
        b.classList.remove('expanded');
    });
    
    if (!isCurrentlyOpen) {
        row.classList.add('show');
        arrow.classList.add('rotated');
        button.classList.add('expanded');
    }
}

function filterByStatus(status) {
    const rows = document.querySelectorAll('tbody tr:not(.expandable-row)');
    rows.forEach(row => {
        if (status === 'all') {
            row.style.display = '';
        } else {
            const statusCell = row.querySelector('.status-badge');
            const matches = statusCell?.textContent.toLowerCase().includes(status.toLowerCase());
            row.style.display = matches ? '' : 'none';
        }
    });
}

// Simplified initialization using hardcoded data
function initializeDashboard() {
    console.log('Initializing Dashboard with hardcoded data...');
    showLoading();
    
    processHardcodedData();
    renderTable();
    
    console.log('Dashboard ready');
}

// Event Listeners
document.addEventListener('DOMContentLoaded', initializeDashboard);

document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', function(e) {
        e.preventDefault();
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        
        const filterValue = this.getAttribute('data-filter');
        filterByStatus(filterValue);
    });
});

const searchBox = document.querySelector('.search-box');
if (searchBox) {
    searchBox.addEventListener('input', function(e) {
        const searchTerm = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('tbody tr:not(.expandable-row)');
        
        rows.forEach(row => {
            const modelName = row.querySelector('.model-name')?.textContent.toLowerCase() || '';
            const ownerName = row.querySelector('.user-name')?.textContent.toLowerCase() || '';
            const matches = modelName.includes(searchTerm) || ownerName.includes(searchTerm);
            row.style.display = matches ? '' : 'none';
        });
    });
}

console.log('Dashboard initialized');