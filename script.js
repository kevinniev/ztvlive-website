// script.js

// Utility function to log messages with timestamp
function logWithTimestamp(message) {
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    console.log(`[${timestamp}] ${message}`);
}

// Function to initialize the page
function initializePage() {
    logWithTimestamp('Page is initializing...');

    // Check if the domain is ztvlivestream.com
    if (window.location.hostname === 'ztvlivestream.com') {
        logWithTimestamp('Domain is valid: ztvlivestream.com');
    } else {
        logWithTimestamp('Invalid domain: ' + window.location.hostname);
    }

    // Add event listeners
    document.addEventListener('DOMContentLoaded', () => {
        logWithTimestamp('DOM fully loaded and parsed');
        // Add other event listeners here if needed
    });
}

// Initialize the page
initializePage();