// popup.js
document.addEventListener("DOMContentLoaded", () => {
    // --- Get references to all our HTML elements ---
    const searchInput = document.getElementById("searchInput");
    const searchBtn = document.getElementById("searchBtn");
    const resultDiv = document.getElementById("result");
    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");
    const clearBtn = document.getElementById("clearBtn");
    const patternButtonsContainer = document.getElementById("pattern-buttons");
    const closeBtn = document.getElementById("closeBtn");
    const searchAttributesCheckbox = document.getElementById("searchAttributes");

    // --- State variables ---
    let totalMatches = 0;
    let visibleIndices = [];
    let currentVisibleIndex = -1;

    // --- Load last search on startup and re-run it ---
    chrome.storage.local.get(['lastSearchPattern'], (result) => {
        if (result.lastSearchPattern) {
            searchInput.value = result.lastSearchPattern;
            // Automatically trigger the search if a previous pattern exists
            performSearch(); 
        }
    });

    // --- Event Listeners ---

    // Close the UI by sending a message to the parent content script
    closeBtn.addEventListener("click", () => {
        window.parent.postMessage({ type: "CLOSE_UI" }, "*");
    });

    searchBtn.addEventListener("click", performSearch);

    async function performSearch() {
        const pattern = searchInput.value;
        if (!pattern) return;

        // Save the pattern to storage for persistence
        chrome.storage.local.set({ lastSearchPattern: pattern });

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) return;
        const shouldSearchAttributes = searchAttributesCheckbox.checked;
        try {
            const findResults = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: findAndHighlight,
                args: [pattern, shouldSearchAttributes]
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
    }

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
            performSearch(); // Automatically search when a pattern is clicked
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

        // Clear the stored pattern
        chrome.storage.local.remove('lastSearchPattern');

        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: clearAllHighlights
        });
    });

    // --- Helper Functions ---
    // (navigateToMatch and updateResult functions remain unchanged)

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