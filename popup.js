// popup.js
document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("searchInput");
    const searchBtn = document.getElementById("searchBtn");
    const resultDiv = document.getElementById("result");
    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");
    const clearBtn = document.getElementById("clearBtn");
    const patternButtonsContainer = document.getElementById("pattern-buttons");
    const closeBtn = document.getElementById("closeBtn");
    const searchAttributesCheckbox = document.getElementById("searchAttributes");

    let totalMatches = 0;
    let currentIndex = -1;

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

    searchBtn.addEventListener("click", performSearch);
    searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") performSearch();
    });

    async function performSearch() {
        // Get the raw input from the user
        let pattern = searchInput.value;
        if (!pattern) return;
    
        let isRegex = false;
    
        // Check if the input is wrapped in slashes, indicating a regex
        if (pattern.startsWith('/') && pattern.lastIndexOf('/') > 0) {
            isRegex = true;
            // Extract the pattern from between the slashes
            pattern = pattern.substring(1, pattern.lastIndexOf('/'));
        }
    
        // Save the original search term to local storage for persistence
        chrome.storage.local.set({ lastSearchPattern: searchInput.value });
    
        // Get the active tab to inject the script into
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) return;
        
        try {
            // Execute the main controller function on the page
            const findResults = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: highlightController,
                args: [{
                    action: 'find',
                    pattern: pattern, // The clean pattern (text or regex)
                    isRegex: isRegex, // The flag indicating the pattern type
                    shouldSearchAttributes: searchAttributesCheckbox.checked
                }]
            });
    
            // Process the results returned from the script
            totalMatches = (findResults && findResults[0] ? findResults[0].result : 0) || 0;
    
            // If matches were found, set the index to the first match and navigate to it
            if (totalMatches > 0) {
                currentIndex = 0;
                navigateToMatch(currentIndex, tab.id);
            } else {
                currentIndex = -1;
            }
            // Update the "Showing X of Y" text in the UI
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

    clearBtn.addEventListener("click", async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) return;
        
        totalMatches = 0;
        currentIndex = -1;
        searchInput.value = "";
        chrome.storage.local.remove('lastSearchPattern');
        
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: highlightController,
            args: [{ action: 'clear' }]
        });
        
        resultDiv.textContent = "Highlights cleared.";
    });

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
        } else if (searchInput.value) { // Only show "no matches" if a search was performed
            resultDiv.textContent = "No matches found.";
        } else {
            resultDiv.textContent = "Enter a pattern to search.";
        }
    }
});