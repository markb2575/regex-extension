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
        const pattern = searchInput.value;
        if (!pattern) return;

        chrome.storage.local.set({ lastSearchPattern: pattern });

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) return;
        
        try {
            const findResults = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: highlightController,
                args: [{
                    action: 'find',
                    pattern: pattern,
                    shouldSearchAttributes: searchAttributesCheckbox.checked
                }]
            });

            totalMatches = (findResults && findResults[0] ? findResults[0].result : 0) || 0;

            currentIndex = totalMatches > 0 ? 0 : -1;
            if (currentIndex !== -1) {
                navigateToMatch(currentIndex, tab.id);
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