// content.js

let iframe = null;
const IFRAME_ID = "gemini-highlighter-iframe";

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
    if (!document.getElementById('gemini-iframe-styles')) {
        const iframeLink = document.createElement('link');
        iframeLink.id = 'gemini-iframe-styles';
        iframeLink.rel = 'stylesheet';
        iframeLink.type = 'text/css';
        iframeLink.href = chrome.runtime.getURL('iframe-styles.css');
        (document.head || document.documentElement).appendChild(iframeLink);
    }
    
    // Inject highlight styles if not already present
    if (!document.getElementById('gemini-highlight-styles')) {
        const highlightLink = document.createElement('link');
        highlightLink.id = 'gemini-highlight-styles';
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