function highlightController(options) {
    function isElementVisible(el) {
        if (!el) return false;
        return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    }

    function clearAllHighlights() {
        // Remove highlight classes
        document.querySelectorAll('.gemini-highlight').forEach(el => {
            el.classList.remove('gemini-highlight', 'gemini-highlight-current');
        });

        // Replace <span> wrappers created for text highlights
        document.querySelectorAll('span.gemini-highlight').forEach(el => {
            const parent = el.parentNode;
            if (parent) {
                parent.replaceChild(document.createTextNode(el.textContent), el);
                parent.normalize();
            }
        });

        window.geminiMatches = [];
    }

    async function revealElement(el) {
        let current = el;
        for (let i = 0; i < 10; i++) {
            if (isElementVisible(el)) return true;
            if (!current || !current.parentElement) break;
            current = current.parentElement;

            if (current.id) {
                const trigger = document.querySelector(`[aria-controls="${current.id}"][aria-expanded="false"]`);
                if (trigger && isElementVisible(trigger)) {
                    trigger.click();
                    await new Promise(r => setTimeout(r, 300));
                    continue;
                }
            }

            if (current.id) {
                const bsTrigger = document.querySelector(`[data-bs-target="#${current.id}"],[data-target="#${current.id}"]`);
                if (bsTrigger && isElementVisible(bsTrigger) && (bsTrigger.classList.contains('collapsed') || bsTrigger.getAttribute('aria-expanded') === 'false')) {
                    bsTrigger.click();
                    await new Promise(r => setTimeout(r, 300));
                    continue;
                }
            }

            if (current.tagName === 'DETAILS' && !current.open) {
                const summary = current.querySelector('summary');
                if (summary) {
                    summary.click();
                    await new Promise(r => setTimeout(r, 100));
                    continue;
                }
            }
        }
        return isElementVisible(el);
    }

    function findAndHighlight(pattern, shouldSearchAttributes) {
        clearAllHighlights();

        if (!pattern) return 0;
        const regex = new RegExp(pattern, "i");
        const attrMatchElements = [];

        if (shouldSearchAttributes) {
            const attributeWhitelist = ['href'];
            document.body.querySelectorAll('*').forEach(el => {
                if (el.classList.contains('gemini-highlight')) return;
                for (const attr of el.attributes) {
                    if (attributeWhitelist.includes(attr.name.toLowerCase()) && regex.test(attr.value)) {
                        el.classList.add('gemini-highlight');
                        attrMatchElements.push(el);
                        break;
                    }
                }
            });
        }

        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        const nodesToProcess = [];
        let textNode;
        while (textNode = walker.nextNode()) {
            const parentTag = textNode.parentNode.tagName;
            if (['SCRIPT', 'STYLE', 'CODE'].includes(parentTag) || textNode.parentNode.isContentEditable) continue;
            if (attrMatchElements.some(el => el.contains(textNode))) continue;
            if (regex.test(textNode.textContent)) nodesToProcess.push(textNode);
        }

        const textMatchElements = [];
        nodesToProcess.forEach(node => {
            const matches = [...node.textContent.matchAll(new RegExp(pattern, "gi"))];
            if (matches.length === 0) return;

            const newNodes = [];
            let lastIndex = 0;
            for (const match of matches) {
                if (match.index > lastIndex) {
                    newNodes.push(document.createTextNode(node.textContent.slice(lastIndex, match.index)));
                }
                const span = document.createElement('span');
                span.classList.add('gemini-highlight');
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

    async function scrollToMatch(index) {
        if (!window.geminiMatches || !window.geminiMatches[index]) return;
        const targetElement = window.geminiMatches[index];
        console.log(targetElement)
        if (!isElementVisible(targetElement)) {
            await revealElement(targetElement);
        }

        document.querySelectorAll('.gemini-highlight-current')
            .forEach(el => el.classList.remove('gemini-highlight-current'));

        targetElement.classList.add('gemini-highlight-current');
        
        targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
        });
    }

    // --- Action router ---
    switch (options.action) {
        case 'find':
            return findAndHighlight(options.pattern, options.shouldSearchAttributes);
        case 'clear':
            clearAllHighlights();
            return;
        case 'scrollTo':
            return scrollToMatch(options.index);
        default:
            throw new Error(`Unknown action: ${options.action}`);
    }
}
