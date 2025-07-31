// Update timestamp
document.getElementById('timestamp').textContent = new Date().toISOString();

// Update deployment method from environment or URL parameter
const urlParams = new URLSearchParams(window.location.search);
const deployMethod = urlParams.get('deploy_method') || 'Direct Upload';
document.getElementById('deploy-method').textContent = deployMethod;

// JavaScript test
document.getElementById('js-test').textContent = 'JavaScript is working! ✓';
document.getElementById('js-test').style.color = '#10b981';

// Load JSON data
fetch('data.json')
    .then(response => response.json())
    .then(data => {
        document.getElementById('json-test').textContent = JSON.stringify(data, null, 2);
    })
    .catch(error => {
        document.getElementById('json-test').textContent = 'JSON loading failed: ' + error.message;
    });

// API test button
document.getElementById('api-button').addEventListener('click', async () => {
    const resultDiv = document.getElementById('api-result');
    resultDiv.innerHTML = '<p>Testing API...</p>';
    
    try {
        // Simulate API call
        const response = await fetch('api/test.json');
        const data = await response.json();
        
        resultDiv.innerHTML = `
            <h4>API Response:</h4>
            <pre>${JSON.stringify(data, null, 2)}</pre>
            <p style="color: #10b981; margin-top: 10px;">✓ API test successful</p>
        `;
    } catch (error) {
        resultDiv.innerHTML = `
            <p style="color: #ef4444;">✗ API test failed: ${error.message}</p>
            <p style="margin-top: 10px;">This is expected for static hosting without API support.</p>
        `;
    }
});

// Performance test
window.addEventListener('load', () => {
    const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
    console.log(`Page load time: ${loadTime}ms`);
    
    // Add performance info to page
    const perfInfo = document.createElement('div');
    perfInfo.style.cssText = 'position: fixed; bottom: 10px; right: 10px; background: #1f2937; color: white; padding: 10px; border-radius: 4px; font-size: 12px;';
    perfInfo.textContent = `Load time: ${loadTime}ms`;
    document.body.appendChild(perfInfo);
});

// Test WebSocket connection (will fail on static hosting)
if (window.WebSocket) {
    console.log('WebSocket support detected');
}