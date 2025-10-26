// content.js

let iframe = null;
const IFRAME_ID = "regex-highlighter-iframe";
document.addEventListener('keydown', (event) => {
    // Check for Ctrl+F (or Cmd+F on Mac)
    if (event.key === 'f' && (event.ctrlKey || event.metaKey)) {
        // Stop the browser's native find bar from appearing
        event.preventDefault();
        // Toggle your extension's UI
        toggleIframe();
    }
});
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "TOGGLE_UI") {
        toggleIframe();
    }
});

// --- MODIFIED: This listener is now more important ---
window.addEventListener("message", (event) => {
    if (!iframe || !iframe.contentWindow || event.source !== iframe.contentWindow) {
        return;
    }
    
    if (event.data.type === "CLOSE_UI") {
        iframe.classList.remove("visible");
    }

    // --- NEW: Listen for the UI to report it's ready ---
    if (event.data.type === "UI_READY") {
        // If the UI is ready AND it's supposed to be visible, tell it to focus.
        // This handles the initial "Ctrl+F" creation case.
        if (iframe.classList.contains("visible")) {
            iframe.contentWindow.postMessage({ type: "FOCUS_INPUT" }, "*");
        }
    }
});

// This function now injects BOTH stylesheets
function injectStyles() {
    // Inject iframe styles if not already present
    if (!document.getElementById('regex-container-styles')) {
        const iframeLink = document.createElement('link');
        iframeLink.id = 'regex-container-styles';
        iframeLink.rel = 'stylesheet';
        iframeLink.type = 'text/css';
        iframeLink.href = chrome.runtime.getURL('iframe-container.css');
        (document.head || document.documentElement).appendChild(iframeLink);
    }
    
    // Inject highlight styles if not already present
    if (!document.getElementById('regex-highlight-styles')) {
        const highlightLink = document.createElement('link');
        highlightLink.id = 'regex-highlight-styles';
        highlightLink.rel = 'stylesheet';
        highlightLink.type = 'text/css';
        highlightLink.href = chrome.runtime.getURL('highlight-styles.css');
        (document.head || document.documentElement).appendChild(highlightLink);
    }
}

// --- MODIFIED: This function is now simpler ---
function toggleIframe() {
    // Inject styles on first toggle action
    injectStyles(); 

    if (iframe) {
        const isNowVisible = iframe.classList.toggle("visible");
        
        // --- MODIFIED: Handle re-focusing an existing iframe ---
        if (isNowVisible) {
            // If it's already created, just tell it to focus.
            iframe.contentWindow.postMessage({ type: "FOCUS_INPUT" }, "*");
        }
    } else {
        iframe = document.createElement('iframe');
        iframe.id = IFRAME_ID;
        iframe.src = chrome.runtime.getURL('popup.html');
        iframe.classList.add("visible");
        
        // --- REMOVED: The onload listener is no longer needed ---
        // We now rely on the "UI_READY" message from the iframe itself.
        
        document.body.appendChild(iframe);
    }
}