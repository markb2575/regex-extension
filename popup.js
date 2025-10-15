document.addEventListener("DOMContentLoaded", () => {
    // --- Get references to all our HTML elements ---
    const searchInput = document.getElementById("searchInput");
    const searchBtn = document.getElementById("searchBtn");
    const resultDiv = document.getElementById("result");
    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");
    const clearBtn = document.getElementById("clearBtn");
    const patternButtonsContainer = document.getElementById("pattern-buttons");

    // --- State variables ---
    let totalMatches = 0;
    let visibleIndices = [];
    let currentVisibleIndex = -1; 

    // --- Event Listeners ---

    searchBtn.addEventListener("click", async () => {
        const pattern = searchInput.value;
        if (!pattern) return;

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) return;

        try {
            const findResults = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: findAndHighlight,
                args: [pattern]
            });

            if (!findResults || !findResults[0]) return;
            totalMatches = findResults[0].result || 0;

            if (totalMatches > 0) {
                const visibleResults = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: getVisibleIndices,
                });
                visibleIndices = visibleResults[0].result || [];

                if (visibleIndices.length > 0) {
                    currentVisibleIndex = 0;
                    navigateToMatch(visibleIndices[currentVisibleIndex], tab.id);
                }
            } else {
                visibleIndices = [];
                currentVisibleIndex = -1;
            }
            updateResult();

        } catch (error) {
            console.error("Failed to inject script:", error);
            resultDiv.textContent = "Cannot search on this page.";
        }
    });

    nextBtn.addEventListener("click", async () => {
        if (visibleIndices.length === 0) return;
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) return;
        
        currentVisibleIndex = (currentVisibleIndex + 1) % visibleIndices.length;
        navigateToMatch(visibleIndices[currentVisibleIndex], tab.id);
        updateResult();
    });

    prevBtn.addEventListener("click", async () => {
        if (visibleIndices.length === 0) return;
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) return;

        currentVisibleIndex = (currentVisibleIndex - 1 + visibleIndices.length) % visibleIndices.length;
        navigateToMatch(visibleIndices[currentVisibleIndex], tab.id);
        updateResult();
    });
    
    patternButtonsContainer.addEventListener("click", (event) => {
        if (event.target.classList.contains('pattern-btn')) {
            searchInput.value = event.target.dataset.pattern;
        }
    });

    clearBtn.addEventListener("click", async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) return;
        totalMatches = 0;
        visibleIndices = [];
        currentVisibleIndex = -1;
        searchInput.value = "";
        resultDiv.textContent = "Highlights cleared.";
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: clearAllHighlights
        });
    });

    // --- Helper Functions ---

    function navigateToMatch(index, tabId) {
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: scrollToMatch,
            args: [index]
        });
    }

    function updateResult() {
        if (totalMatches > 0) {
            if (visibleIndices.length > 0) {
                resultDiv.textContent = `Showing ${currentVisibleIndex + 1} of ${visibleIndices.length} matches`;
            } else {
                resultDiv.textContent = `Found ${totalMatches} hidden matches.`;
            }
        } else if (resultDiv.textContent !== "Highlights cleared.") {
            resultDiv.textContent = "No matches found.";
        }
    }
});


// --- Functions to be Injected into the Web Page ---

function getVisibleIndices() {
    if (!window.geminiMatches) return [];
    
    const visibleIndices = [];
    window.geminiMatches.forEach((el, index) => {
        // This is a more robust visibility check.
        // It ensures the element has actual dimensions and is not explicitly hidden.
        const style = window.getComputedStyle(el);
        const isVisible = 
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            el.offsetWidth > 0 &&
            el.offsetHeight > 0;

        if (isVisible) {
            visibleIndices.push(index);
        }
    });
    return visibleIndices;
}

function clearAllHighlights() {
    const textHighlights = document.querySelectorAll('span[data-gemini-highlight="text"]');
    textHighlights.forEach(el => {
        const parent = el.parentNode;
        parent.replaceChild(document.createTextNode(el.textContent), el);
        parent.normalize();
    });

    const attrHighlights = document.querySelectorAll('[data-gemini-highlight="attribute"]');
    attrHighlights.forEach(el => {
        el.removeAttribute('data-gemini-highlight');
        el.style.backgroundColor = '';
        el.style.position = ''; // Reset position
        el.style.zIndex = '';   // Reset z-index
    });

    window.geminiMatches = [];
}

function findAndHighlight(pattern) {
    // Cleanup logic is now self-contained
    const textHighlights = document.querySelectorAll('span[data-gemini-highlight="text"]');
    textHighlights.forEach(el => {
        const parent = el.parentNode;
        parent.replaceChild(document.createTextNode(el.textContent), el);
        parent.normalize();
    });
    const attrHighlights = document.querySelectorAll('[data-gemini-highlight="attribute"]');
    attrHighlights.forEach(el => {
        el.removeAttribute('data-gemini-highlight');
        el.style.backgroundColor = '';
        el.style.position = ''; // Reset position
        el.style.zIndex = '';   // Reset z-index
    });

    if (!pattern) return 0;
    
    const regex = new RegExp(pattern, "i");
    const attributeWhitelist = ['href'];

    const attrMatchElements = [];

    // Find Attribute Matches FIRST
    const allElements = document.querySelectorAll('*');
    allElements.forEach(el => {
        for (const attr of el.attributes) {
            if (attributeWhitelist.includes(attr.name.toLowerCase()) && regex.test(attr.value)) {
                el.dataset.geminiHighlight = "attribute";
                el.style.backgroundColor = 'rgba(173, 216, 230, 0.3)';
                el.style.position = 'relative'; // Set position
                el.style.zIndex = '9999';       // Set z-index
                attrMatchElements.push(el);
                break; 
            }
        }
    });

    // Find Text Matches, ignoring any inside an already-found attribute match
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let textNode;
    const nodesToProcess = [];
    while (textNode = walker.nextNode()) {
        const parentTag = textNode.parentNode.tagName;
        if (parentTag === 'SCRIPT' || parentTag === 'STYLE' || parentTag === 'CODE') continue;

        if (attrMatchElements.some(el => el.contains(textNode))) {
            continue;
        }

        if (regex.test(textNode.textContent)) {
            nodesToProcess.push(textNode);
        }
    }

    const textMatchElements = [];
    nodesToProcess.forEach(node => {
        const matches = node.textContent.matchAll(regex);
        let lastIndex = 0;
        const newNodes = [];
        for (const match of matches) {
            if (match.index > lastIndex) {
                newNodes.push(document.createTextNode(node.textContent.slice(lastIndex, match.index)));
            }
            const span = document.createElement('span');
            span.dataset.geminiHighlight = "text";
            span.style.backgroundColor = 'yellow';
            span.style.color = 'black';
            span.textContent = match[0];
            newNodes.push(span);
            textMatchElements.push(span);
            lastIndex = match.index + match[0].length;
        }
        if (lastIndex < node.textContent.length) {
            newNodes.push(document.createTextNode(node.textContent.slice(lastIndex)));
        }
        node.replaceWith(...newNodes);
    });

    window.geminiMatches = [...attrMatchElements, ...textMatchElements];
    return window.geminiMatches.length;
}

function scrollToMatch(index) {
    if (!window.geminiMatches || window.geminiMatches.length === 0) return;

    // Reset styles for all matches
    window.geminiMatches.forEach(el => {
        if (el.dataset.geminiHighlight === 'text') {
            el.style.backgroundColor = 'yellow';
            el.style.position = ''; // Make sure text spans don't have these
            el.style.zIndex = '';
        } else if (el.dataset.geminiHighlight === 'attribute') {
            el.style.backgroundColor = 'rgba(173, 216, 230, 0.3)';
            el.style.position = 'relative'; // Ensure these are always set for attribute matches
            el.style.zIndex = '9999';
        }
    });

    const targetElement = window.geminiMatches[index];
    if (targetElement) {
        console.log(targetElement);

        if (targetElement.dataset.geminiHighlight === 'text') {
            targetElement.style.backgroundColor = 'orange';
        } else if (targetElement.dataset.geminiHighlight === 'attribute') {
            targetElement.style.backgroundColor = 'rgba(255, 165, 0, 0.4)';
            // Make the current one stand out even more, just in case
            targetElement.style.zIndex = '10000'; 
        }
        
        targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
        });
    }
}