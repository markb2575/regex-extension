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

window.addEventListener("message", (event) => {
    if (!iframe || !iframe.contentWindow || event.source !== iframe.contentWindow) {
        return;
    }
    if (event.data.type === "CLOSE_UI") {
        iframe.classList.remove("visible");
    }
});

// This function now injects BOTH stylesheets
function injectStyles() {
    // Inject iframe styles if not already present
    if (!document.getElementById('regex-iframe-styles')) {
        const iframeLink = document.createElement('link');
        iframeLink.id = 'regex-iframe-styles';
        iframeLink.rel = 'stylesheet';
        iframeLink.type = 'text/css';
        iframeLink.href = chrome.runtime.getURL('iframe-styles.css');
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

function toggleIframe() {
    // Inject styles on first toggle action
    injectStyles(); 

    if (iframe) {
        iframe.classList.toggle("visible");
    } else {
        iframe = document.createElement('iframe');
        iframe.id = IFRAME_ID;
        iframe.src = chrome.runtime.getURL('popup.html');
        iframe.classList.add("visible");
        
        document.body.appendChild(iframe);
    }
}