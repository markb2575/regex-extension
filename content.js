// content.js

let iframe = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "TOGGLE_UI") {
    toggleIframe();
  }
});

// Listen for messages from the iframe (e.g., to close itself)
window.addEventListener("message", (event) => {
    // THIS IS THE NEW, MORE ROBUST CHECK:
    // It stops if the iframe hasn't been created OR if its contentWindow isn't ready.
    if (!iframe || !iframe.contentWindow) {
        return;
    }

    // We only accept messages from our own extension
    if (event.source !== iframe.contentWindow) {
        return;
    }

    if (event.data.type === "CLOSE_UI") {
        iframe.style.display = "none";
    }
});


function toggleIframe() {
  if (iframe) {
    // Toggle visibility if it already exists
    const isVisible = iframe.style.display === "block";
    iframe.style.display = isVisible ? "none" : "block";
  } else {
    // Create the iframe if it doesn't exist
    iframe = document.createElement('iframe');
    iframe.src = chrome.runtime.getURL('popup.html');

    // --- UPDATED STYLES ---
    iframe.style.position = "fixed";
    iframe.style.top = "15px";
    iframe.style.right = "15px";
    iframe.style.width = "330px"; // Increased width for new padding
    iframe.style.height = "260px"; // Increased height for better spacing
    iframe.style.border = "1px solid #43464c"; // Darker border
    iframe.style.borderRadius = "10px"; // Softer corners
    iframe.style.boxShadow = "0 5px 15px rgba(0,0,0,0.4)"; // Deeper shadow for depth
    iframe.style.zIndex = "99999999";
    iframe.style.display = "block";
    iframe.style.overflow = "hidden"; // Ensures content respects border-radius
    iframe.style.backgroundColor = "#2b2d31"; // Match the body background to prevent flash

    document.body.appendChild(iframe);
  }
}