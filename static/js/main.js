// Domino API Configuration
const DOMINO_API_BASE = window.location.origin;
const API_KEY = '914d81ea8309f1dcb03ec63a4df82c66adad7fb9e5fbf6f24831fe7b59c7ab0b';
const PROJECT_ID = typeof DOMINO_PROJECT_ID !== 'undefined' ? DOMINO_PROJECT_ID : '';

// Global state - single source of truth
let appState = {
    bundles: null,
    policies: {},
    evidence: {},
    models: {},
    tableData: []
};

// API Functions
async function fetchAllData() {
    try {
        // 1. Fetch bundles
        const bundlesResponse = await fetch(`${DOMINO_API_BASE}/api/governance/v1/bundles`, {
            headers: {
                'X-Domino-Api-Key': API_KEY,
                'accept': 'application/json'
            }
        });
        
        if (!bundlesResponse.ok) throw new Error(`Bundles API: ${bundlesResponse.status}`);
        const bundlesData = await bundlesResponse.json();
        
        // Filter bundles with fitch policies
        const filteredBundles = bundlesData.data?.filter(bundle => 
            bundle.state !== 'Archived' && 
            bundle.policies?.some(policy => policy.policyName?.toLowerCase().includes('[fitch'))
        ) || [];

        appState.bundles = filteredBundles;

        // 2. Collect all policy IDs
        const policyIds = new Set();
        filteredBundles.forEach(bundle => {
            bundle.policies?.forEach(policy => {
                if (policy.policyId) policyIds.add(policy.policyId);
            });
        });

        // 3. Fetch all policies in parallel
        const policyPromises = Array.from(policyIds).map(async policyId => {
            try {
                const response = await fetch(`https://se-demo.domino.tech/api/governance/v1/policies/${policyId}`, {
                    headers: {
                        'X-Domino-Api-Key': API_KEY,
                        'accept': 'application/json'
                    }
                });
                if (response.ok) {
                    appState.policies[policyId] = await response.json();
                }
            } catch (err) {
                console.error(`Policy ${policyId} failed:`, err);
            }
        });

        // 4. Fetch all evidence in parallel
        const evidencePromises = filteredBundles.map(async bundle => {
            try {
                const response = await fetch(`https://se-demo.domino.tech/api/governance/v1/drafts/latest?bundleId=${bundle.id}`, {
                    headers: {
                        'X-Domino-Api-Key': API_KEY,
                        'accept': 'application/json'
                    }
                });
                if (response.ok) {
                    appState.evidence[bundle.id] = await response.json();
                }
            } catch (err) {
                console.error(`Evidence ${bundle.id} failed:`, err);
            }
        });

        // Wait for all API calls
        await Promise.all([...policyPromises, ...evidencePromises]);

        console.log('All data fetched:', appState);
        return true;
        
    } catch (error) {
        console.error('Failed to fetch data:', error);
        return false;
    }
}

// Data Processing - single function to create all derived data
function processData() {
    appState.models = {};
    appState.tableData = [];

    // Process each bundle to extract model data
    appState.bundles.forEach(bundle => {
        bundle.attachments?.forEach(attachment => {
            if (attachment.type === 'ModelVersion' && attachment.identifier) {
                const modelKey = `${attachment.identifier.name}_v${attachment.identifier.version}`;
                
                // Initialize model data structure
                if (!appState.models[modelKey]) {
                    appState.models[modelKey] = {
                        modelName: attachment.identifier.name,
                        modelVersion: attachment.identifier.version,
                        modelKey: modelKey,
                        bundles: [],
                        evidence: [],
                        policies: [],
                        systemId: null,
                        applicationId: null,
                        applicationType: null,
                        status: null
                    };
                }

                const model = appState.models[modelKey];

                // Add bundle info
                model.bundles.push({
                    bundleId: bundle.id,
                    bundleName: bundle.name,
                    bundleState: bundle.state,
                    createdAt: bundle.createdAt
                });

                // Process evidence for this bundle
                const bundleEvidence = appState.evidence[bundle.id] || [];
                if (Array.isArray(bundleEvidence)) {
                    bundleEvidence.forEach(evidence => {
                        const externalId = getEvidenceExternalId(evidence, bundle.policies);
                        
                        // Find system-id evidence
                        if (externalId === 'system-id') {
                            model.systemId = evidence.artifactContent;
                            model.applicationId = `v${evidence.artifactContent}.${model.modelVersion}`;
                        }
                        
                        // Find application-type evidence
                        if (externalId === 'application-type') {
                            model.applicationType = evidence.artifactContent;
                        }

                        if (externalId === 'service-level') {
                            model.serviceLevel = evidence.artifactContent;
                        }

                        
                        model.evidence.push({
                            ...evidence,
                            bundleId: bundle.id,
                            bundleName: bundle.name
                        });
                    });
                }

                // Add policies
                bundle.policies?.forEach(policy => {
                    model.policies.push({
                        ...policy,
                        bundleId: bundle.id,
                        fullPolicyData: appState.policies[policy.policyId] || null
                    });
                });
            }
        });
    });

    // Create table data
    appState.tableData = Object.values(appState.models).map(model => ({
        modelName: model.modelName,
        modelVersion: model.applicationId || `n/a`,
        applicationType: model.applicationType || 'Unknown',
        serviceLevel: model.serviceLevel || 'Unknown',
        bundleName: model.bundles[0]?.bundleName || 'Unknown',
        bundleId: model.bundles[0]?.bundleId || null,
        evidenceStatus: model.evidence[0]?.evidenceId || '-',
        evidenceCreated: model.evidence[0]?.updatedAt || '-',
        owner: model.evidence[0]?.userId || 'Unknown',
        createdAt: model.bundles[0]?.createdAt,
        riskClass: 'P3',
        health: '98.5',
        activeDevelopment: false,
        findings: [],
        dependencies: [],
        externalAccess: false,
        lastRun: null
    }));

    console.log('Data processed:', { models: appState.models, tableData: appState.tableData });
}

// Helper function to get evidence external ID
function getEvidenceExternalId(evidence, bundlePolicies) {
    for (const policy of bundlePolicies || []) {
        const fullPolicy = appState.policies[policy.policyId];
        if (!fullPolicy?.stages) continue;
        
        for (const stage of fullPolicy.stages) {
            const evidenceDef = stage.evidenceSet?.find(def => def.id === evidence.evidenceId);
            if (evidenceDef) return evidenceDef.externalId;
        }
    }
    return null;
}

// Rendering Functions
function renderTable() {
    const tbody = document.querySelector('.table-container tbody');
    if (!tbody) return;

    if (appState.tableData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="12" style="text-align: center; padding: 40px; color: #888;">
                    No models found
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = appState.tableData.map((model, index) => `
        <tr>
            <td>
                <div class="model-name">${model.modelName}</div>
                <div class="model-type">${model.modelVersion}</div>
            </td>
            <td>
                    <span class="user-name">${model.applicationType}</span>
            </td>
            <td><span class="status-badge status-${model.serviceLevel.toLowerCase().replace(/\s+/g, '-')}">${model.serviceLevel}</span></td>
            <td><span class="risk-badge">${model.riskClass}</span></td>
            <td><span class="dev-item">${model.activeDevelopment ? 'Active' : 'None'}</span></td>
            <td><span class="no-findings">No Findings</span></td>
            <td>None</td>
            <td><span class="metric-value">${model.externalAccess ? 'Enabled' : 'Disabled'}</span></td>
            <td><span class="metric-value">${model.health}%</span></td>
            <td>${model.lastRun || 'Never'}</td>
            <td>
                <button class="action-btn" onclick="toggleDetails(this, ${index})">
                    <span>Details</span>
                    <span class="arrow">▼</span>
                </button>
            </td>
        </tr>
        <tr id="details-${index}" class="expandable-row">
            <td colspan="11">
                <div class="expandable-content">
                    <div class="detail-section">
                        <h3>Model Details</h3>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <div class="detail-label">Version</div>
                                <div class="detail-value">${model.modelVersion}</div>
                            </div>
                            <div class="detail-item">
                                <div class="detail-label">Created</div>
                                <div class="detail-value">${formatDate(model.createdAt)}</div>
                            </div>
                            <div class="detail-item">
                                <div class="detail-label">Bundle</div>
                                <div class="detail-value">${model.bundleName}</div>
                            </div>
                        </div>
                    </div>
                    <div class="actions-row">
                        <button class="btn btn-primary">View Model</button>
                        <button class="btn btn-secondary">Edit Settings</button>
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

// Utility Functions
function getInitials(name) {
    return (name || 'Unknown').split(' ').map(n => n[0]).join('').toUpperCase();
}

function formatDate(date) {
    return date ? new Date(date).toLocaleDateString() : 'Unknown';
}

// Event Handlers
function toggleDetails(button, index) {
    const row = document.getElementById(`details-${index}`);
    const arrow = button.querySelector('.arrow');
    
    // Close all other rows
    document.querySelectorAll('.expandable-row.show').forEach(r => r.classList.remove('show'));
    document.querySelectorAll('.arrow.rotated').forEach(a => a.classList.remove('rotated'));
    document.querySelectorAll('.action-btn.expanded').forEach(b => {
        b.classList.remove('expanded');
        b.querySelector('span').textContent = 'Details';
    });
    
    // Toggle current row
    if (row.classList.contains('show')) {
        row.classList.remove('show');
        arrow.classList.remove('rotated');
        button.classList.remove('expanded');
        button.querySelector('span').textContent = 'Details';
    } else {
        row.classList.add('show');
        arrow.classList.add('rotated');
        button.classList.add('expanded');
        button.querySelector('span').textContent = 'Close';
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

// Main initialization function - simple flow
async function initializeDashboard() {
    console.log('Initializing Dashboard...');
    showLoading();
    
    // 1. Fetch all data
    const success = await fetchAllData();
    
    if (success) {
        // 2. Process data once
        processData();
        
        // 3. Render table
        renderTable();
        
        console.log('Dashboard ready');
    } else {
        const tbody = document.querySelector('.table-container tbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="12" style="text-align: center; padding: 40px; color: #e74c3c;">
                        Failed to load data
                    </td>
                </tr>
            `;
        }
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', initializeDashboard);

// Tab filtering
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', function(e) {
        e.preventDefault();
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        
        const filterValue = this.getAttribute('data-filter');
        filterByStatus(filterValue);
    });
});

// Search functionality
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

console.log('Dashboard initialized with Project ID:', PROJECT_ID);