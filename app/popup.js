// popup.js
document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("searchInput");
    const resultDiv = document.getElementById("result");
    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");
    const clearBtn = document.getElementById("clearBtn");
    const patternButtonsContainer = document.getElementById("pattern-buttons");
    const closeBtn = document.getElementById("closeBtn");
    const searchAttributesCheckbox = document.getElementById("searchAttributes");

    let totalMatches = 0;
    let currentIndex = -1;
    let debounceTimer;

    // --- Debounce function ---
    function debounce(func, delay) {
        return function(...args) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    }
    
    const debouncedPerformSearch = debounce(performSearch, 250); // 250ms delay

    // --- MODIFIED: Listen for messages from the content script ---
    window.addEventListener("message", (event) => {
        // --- NEW: Add source check for security & correctness ---
        if (event.source !== window.parent) {
            return;
        }

        if (event.data.type === "FOCUS_INPUT") {
            // --- MODIFIED: Use a short timeout for focus ---
            // This is often more reliable than requestAnimationFrame for focus
            setTimeout(() => {
                searchInput.focus();
            }, 50); // 50ms delay
        }
    });

    // Load last search on startup
    chrome.storage.local.get(['lastSearchPattern'], (result) => {
        if (result.lastSearchPattern) {
            searchInput.value = result.lastSearchPattern;
            performSearch(); 
        }
    });

    closeBtn.addEventListener("click", () => {
        window.parent.postMessage({ type: "CLOSE_UI" }, "*");
    });

    // Search automatically on text input
    searchInput.addEventListener("input", debouncedPerformSearch);
    
    // Also trigger search when checkbox is toggled
    searchAttributesCheckbox.addEventListener("change", performSearch);

    async function performSearch() {
        let pattern = searchInput.value;
        
        if (!pattern) {
            clearSearch(false); 
            return;
        }
    
        let isRegex = false;
        if (pattern.startsWith('/') && pattern.lastIndexOf('/') > 0) {
            isRegex = true;
            pattern = pattern.substring(1, pattern.lastIndexOf('/'));
        }
    
        chrome.storage.local.set({ lastSearchPattern: searchInput.value });
    
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) return;
        
        try {
            const findResults = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: highlightController,
                args: [{
                    action: 'find',
                    pattern: pattern,
                    isRegex: isRegex,
                    shouldSearchAttributes: searchAttributesCheckbox.checked
                }]
            });
    
            totalMatches = (findResults && findResults[0] ? findResults[0].result : 0) || 0;
    
            if (totalMatches > 0) {
                currentIndex = 0;
                navigateToMatch(currentIndex, tab.id);
            } else {
                currentIndex = -1;
            }
            updateResult();
    
        } catch (error) {
            console.error("Script injection failed:", error);
            resultDiv.textContent = "Cannot search on this page.";
        }
    }

    nextBtn.addEventListener("click", () => handleNavigation(1));
    prevBtn.addEventListener("click", () => handleNavigation(-1));

    async function handleNavigation(direction) {
        if (totalMatches === 0) return;
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) return;
        
        currentIndex = (currentIndex + direction + totalMatches) % totalMatches;
        navigateToMatch(currentIndex, tab.id);
        updateResult();
    }
    
    patternButtonsContainer.addEventListener("click", (event) => {
        if (event.target.classList.contains('pattern-btn')) {
            searchInput.value = event.target.dataset.pattern;
            performSearch();
        }
    });

    clearBtn.addEventListener("click", () => {
        searchInput.value = ""; 
        clearSearch(true);
    });

    async function clearSearch(clearInputValue = true) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) return;
        
        totalMatches = 0;
        currentIndex = -1;
        if (clearInputValue) {
            searchInput.value = "";
        }
        chrome.storage.local.remove('lastSearchPattern');
        
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: highlightController,
            args: [{ action: 'clear' }]
        });
        
        updateResult();
    }

    function navigateToMatch(index, tabId) {
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: highlightController,
            args: [{ action: 'scrollTo', index: index }]
        });
    }

    function updateResult() {
        if (totalMatches > 0) {
            resultDiv.textContent = `Showing ${currentIndex + 1} of ${totalMatches}`;
        } else if (searchInput.value) {
            resultDiv.textContent = "No matches found.";
        } else {
            resultDiv.textContent = "Enter text/regex to search.";
        }
    }

    // --- NEW: Announce that the UI is ready at the very end ---
    // This tells the parent (content.js) that it's safe to send messages.
    window.parent.postMessage({ type: "UI_READY" }, "*");
});