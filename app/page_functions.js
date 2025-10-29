// page_functions.js

/**
 * A controller function executed in the page's context to manage highlighting.
 * This acts as a router for different actions ('find', 'clear', 'scrollTo').
 */
function highlightController(options) {
  
    // --- Global state within the page ---
    if (typeof window.regexMatches === 'undefined') {
      window.regexMatches = [];
    }
    if (typeof window.textNodeMap === 'undefined') {
      window.textNodeMap = [];
    }
    // --- NEW: Keep track of which Shadow DOMs we've injected styles into ---
    if (typeof window.injectedShadowRoots === 'undefined') {
      window.injectedShadowRoots = new Set();
    }
  
  
    // --- Utility Functions ---
  
    function isElementVisible(el) {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return false;
      }
      return !!(el.offsetWidth || el.offsetHeight || (el.getClientRects && el.getClientRects().length));
    }
  
    function escapeRegex(string) {
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  
    async function revealElement(el) {
      let current = el;
      for (let i = 0; i < 10; i++) {
        if (isElementVisible(el)) return true;
        if (!current || !current.parentElement) break;
        current = current.parentElement;
  
        // Check for aria-controls (common for tabs and accordions)
        if (current.id) {
          const trigger = document.querySelector(`[aria-controls="${current.id}"][aria-expanded="false"]`);
          if (trigger && isElementVisible(trigger)) {
            trigger.click();
            await new Promise(r => setTimeout(r, 300)); // Wait for animation
            continue;
          }
        }
  
        // Check for Bootstrap data-bs-target/data-target
        if (current.id) {
          const bsTrigger = document.querySelector(`[data-bs-target="#${current.id}"],[data-target="#${current.id}"]`);
          if (bsTrigger && isElementVisible(bsTrigger) && (bsTrigger.classList.contains('collapsed') || bsTrigger.getAttribute('aria-expanded') === 'false')) {
            bsTrigger.click();
            await new Promise(r => setTimeout(r, 300));
            continue;
          }
        }
  
        // Check for <details> element
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
  
    // --- Core Highlighting Logic ---
  
    /**
     * Clears all highlights from the page.
     * This is the fixed version that correctly replaces spans and normalizes the DOM.
     */
    function clearAllHighlights() {
      // Remove attribute-based highlights
      document.querySelectorAll('.regex-highlight:not(span)').forEach(el => {
        el.classList.remove('regex-highlight', 'regex-highlight-current');
      });
  
      // Find ALL span highlights first
      // We must search recursively in Shadow DOM here too.
      const spans = [];
      function findSpans(root) {
          root.querySelectorAll('span.regex-highlight').forEach(span => spans.push(span));
          root.querySelectorAll('*').forEach(el => {
              if (el.shadowRoot) findSpans(el.shadowRoot);
          });
      }
      findSpans(document.body);
      
      const parents = new Set(); // Store parents to normalize them later
  
      spans.forEach(span => {
        const parent = span.parentNode;
        if (parent) {
          parents.add(parent);
          // Replace the span with its own text content (as a text node)
          parent.replaceChild(document.createTextNode(span.textContent), span);
        }
      });
  
      // Normalize all affected parents *after* spans are removed
      parents.forEach(parent => parent.normalize());
  
      window.regexMatches = [];
      window.textNodeMap = []; // Clear the map
      window.injectedShadowRoots.clear(); // --- NEW: Clear the style cache ---
    }
  
    /**
     * Finds and highlights all matches for a given pattern.
     * This is the new, fully recursive function.
     */
    function findAndHighlight(pattern, isRegex, shouldSearchAttributes) {
      clearAllHighlights(); // Clear old results and normalize the DOM
      if (!pattern) return 0;
  
      const finalPattern = isRegex ? pattern : escapeRegex(pattern);
      const regex = new RegExp(finalPattern, "i");
      const attrMatchElements = [];
  
      // --- Part 1: Recursive Attribute Search ---
      function recursiveAttributeFinder(rootNode) {
          const attributeWhitelist = ['href'];
          // Use querySelectorAll on the current root (which could be a shadowRoot)
          rootNode.querySelectorAll('*').forEach(el => {
              if (el.classList.contains('regex-highlight')) return;
  
              for (const attr of el.attributes) {
                  if (attributeWhitelist.includes(attr.name.toLowerCase()) && regex.test(attr.value)) {
                      el.classList.add('regex-highlight');
                      attrMatchElements.push(el);
                      break; 
                  }
              }
              
              // *** THE RECURSIVE PART ***
              // If this element has a shadow root, search inside it too.
              if (el.shadowRoot) {
                  recursiveAttributeFinder(el.shadowRoot);
              }
          });
      }
      
      if (shouldSearchAttributes) {
          recursiveAttributeFinder(document.body); // Start search from the document body
      }
  
      // --- Part 2: Build Virtual Text Map (Recursive) ---
      let contiguousText = "";
      window.textNodeMap = []; // Clear map from previous search
      
      function recursiveTextFinder(node) {
          // 1. If it's a text node, add it to our map
          if (node.nodeType === 3) { // 3 is Node.TEXT_NODE
              const parentTag = node.parentNode ? node.parentNode.tagName : '';
              // Filter out nodes we don't want to search
              if (['SCRIPT', 'STYLE', 'CODE'].includes(parentTag) || 
                  (node.parentNode && node.parentNode.isContentEditable) ||
                  (node.parentNode && node.parentNode.classList && node.parentNode.classList.contains('regex-highlight'))) {
                  return; // Skip this node
              }
              
              // This is the map: store the node and its start index
              window.textNodeMap.push({
                  node: node,
                  start: contiguousText.length,
              });
              contiguousText += node.textContent;
              return; // Text nodes don't have children, so we stop
          }
  
          // 2. If it's an element, check for Shadow DOM and recurse
          if (node.nodeType === 1) { // 1 is Node.ELEMENT_NODE
              // Don't search inside these tags
              if (['SCRIPT', 'STYLE', 'CODE', 'IFRAME', 'SVG', 'VIDEO', 'AUDIO'].includes(node.tagName)) {
                  return;
              }
  
              // *** THE SHADOW DOM PIERCE ***
              // If it has a shadowRoot, recurse into its children
              if (node.shadowRoot) {
                  node.shadowRoot.childNodes.forEach(recursiveTextFinder);
              }
          }
          
          // 3. Recurse into all regular children
          node.childNodes.forEach(recursiveTextFinder);
      }
      
      recursiveTextFinder(document.body); // Start the recursive search
  
      // --- Part 3: Find Matches in Virtual String (Unchanged) ---
      const textMatchSpans = [];
      // Use the *correct* pattern (escaped if not regex) with 'g' and 'i' flags
      const globalRegex = new RegExp(finalPattern, "gi");
      let match;
  
      while ((match = globalRegex.exec(contiguousText)) !== null) {
        const matchStart = match.index;
        const matchEnd = matchStart + match[0].length;
  
        if (match[0].trim() === "") continue; // Skip whitespace-only matches
  
        // --- Part 4: Map Virtual Match back to DOM Nodes (Unchanged) ---
        const nodesToWrap = [];
        let foundStartNode = false;
  
        for (const mapping of window.textNodeMap) {
          const nodeStart = mapping.start;
          const nodeEnd = nodeStart + mapping.node.textContent.length;
  
          // Check for overlap (i.e., this node is part of the match)
          if (nodeEnd > matchStart && nodeStart < matchEnd) {
            nodesToWrap.push({
              node: mapping.node,
              startOffset: Math.max(0, matchStart - nodeStart), // Start offset within this node
              endOffset: Math.min(mapping.node.textContent.length, matchEnd - nodeStart) // End offset within this node
            });
            foundStartNode = true;
          } else if (foundStartNode) {
            // If we've found the start and this node is not in range, we can stop.
            break;
          }
        }
        
        // --- Part 5: Wrap the DOM Nodes using Range ---
        const spansForThisMatch = [];
        for (let i = nodesToWrap.length - 1; i >= 0; i--) {
          const item = nodesToWrap[i];
          const node = item.node;
          const start = item.startOffset;
          const end = item.endOffset;
  
          if (end <= start) continue; // Skip empty ranges
  
          try {
            // This is the magic: create a range and wrap it.
            // This will automatically split text nodes if necessary.
            const range = document.createRange();
            range.setStart(node, start);
            range.setEnd(node, end);
  
            const span = document.createElement('span');
            span.className = 'regex-highlight';
            
            range.surroundContents(span);
            spansForThisMatch.push(span);
  
            // --- NEW: INJECT STYLES INTO SHADOW DOM ---
            const root = span.getRootNode();
            // nodeType 11 is a DocumentFragment (which a shadowRoot is)
            if (root.nodeType === 11 && !window.injectedShadowRoots.has(root)) {
                // Find the original stylesheet <link> in the main document
                const mainStyles = document.getElementById('regex-highlight-styles');
                if (mainStyles) {
                    // Clone it and append it to the shadowRoot
                    root.appendChild(mainStyles.cloneNode());
                    window.injectedShadowRoots.add(root);
                }
            }
            // --- END NEW ---
  
          } catch (e) {
            // Log errors but continue
            console.warn("Regex Highlighter: surroundContents failed.", e, item);
          }
        }
        // Add the spans for this match in their correct DOM order
        textMatchSpans.push(...spansForThisMatch.reverse());
      }
  
      // Store the final list of all match elements
      window.regexMatches = [...attrMatchElements, ...textMatchSpans];
      return window.regexMatches.length;
    }
  
    /**
     * Scrolls to a specific match by its index.
     */
    async function scrollToMatch(index) {
      if (!window.regexMatches || !window.regexMatches[index]) return;
      
      // Clear previous 'current' highlight
      // We must search recursively in Shadow DOM here too.
      const currentHighlights = [];
      function findCurrent(root) {
          root.querySelectorAll('.regex-highlight-current').forEach(el => currentHighlights.push(el));
          root.querySelectorAll('*').forEach(el => {
              if (el.shadowRoot) findCurrent(el.shadowRoot);
          });
      }
      findCurrent(document.body);
      currentHighlights.forEach(el => el.classList.remove('regex-highlight-current'));
  
        
      const targetElement = window.regexMatches[index];
      
      targetElement.classList.add('regex-highlight-current');
  
      if (!isElementVisible(targetElement)) {
        await revealElement(targetElement);
      }
  
      // --- MODIFIED: SCROLL FIX ---
      
      // 1. This scrolls the *internal* container (if any)
      targetElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
  
      // 2. If the element is in a Shadow DOM, scroll its host element
      //    (the custom element) into view in the *main* document.
      const root = targetElement.getRootNode();
      if (root && root.host) {
        root.host.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      }
      // --- END MODIFIED ---
    }
  
    // --- Action Router ---
    switch (options.action) {
      case 'find':
        return findAndHighlight(options.pattern, options.isRegex, options.shouldSearchAttributes);
        
      case 'clear':
        clearAllHighlights();
        return;
        
      case 'scrollTo':
        scrollToMatch(options.index);
        return;
        
      default:
        throw new Error(`Unknown action: ${options.action}`);
    }
  }