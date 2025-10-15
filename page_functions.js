// page_functions.js

function findAndHighlight(pattern, shouldSearchAttributes) {
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
    const attrMatchElements = [];
    
    if (shouldSearchAttributes) {
        const attributeWhitelist = ['href'];
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
    }
    // Find Attribute Matches FIRST


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
        const matches = node.textContent.matchAll(new RegExp(pattern, "gi")); // Ensure global flag for matchAll
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

function getVisibleIndices() {
    if (!window.geminiMatches) return [];
    
    const visibleIndices = [];
    window.geminiMatches.forEach((el, index) => {
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

function scrollToMatch(index) {
    if (!window.geminiMatches || window.geminiMatches.length === 0) return;

    window.geminiMatches.forEach(el => {
        if (el.dataset.geminiHighlight === 'text') {
            el.style.backgroundColor = 'yellow';
        } else if (el.dataset.geminiHighlight === 'attribute') {
            el.style.backgroundColor = 'rgba(173, 216, 230, 0.3)';
        }
    });

    const targetElement = window.geminiMatches[index];
    if (targetElement) {
        if (targetElement.dataset.geminiHighlight === 'text') {
            targetElement.style.backgroundColor = 'orange';
        } else if (targetElement.dataset.geminiHighlight === 'attribute') {
            targetElement.style.backgroundColor = 'rgba(255, 165, 0, 0.4)';
        }
        
        targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
        });
    }
}