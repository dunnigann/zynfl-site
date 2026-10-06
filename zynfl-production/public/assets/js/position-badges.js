/* Keep the same position color wherever an abbreviation appears in rendered copy. */
(() => {
  const positions = /\b(QB|RB|WR|TE|FLEX|DEF|K)\b/g;
  const skip = 'SCRIPT,STYLE,SELECT,OPTION,TEXTAREA,CODE,PRE,.pos-badge,[contenteditable]';
  function decorate(root) {
    if (root.nodeType === 1 && root.matches(skip)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.parentElement && !node.parentElement.closest(skip) &&
          /\b(?:QB|RB|WR|TE|FLEX|DEF|K)\b/.test(node.nodeValue)
          ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const texts = [];
    while (walker.nextNode()) texts.push(walker.currentNode);
    for (const node of texts) {
      const parts = node.nodeValue.split(positions);
      if (parts.length === 1) continue;
      const fragment = document.createDocumentFragment();
      parts.forEach((part, i) => {
        if (i % 2) {
          const badge = document.createElement('span');
          badge.className = 'pos-badge pos-' + part;
          badge.textContent = part;
          fragment.append(badge);
        } else if (part) fragment.append(document.createTextNode(part));
      });
      node.replaceWith(fragment);
    }
    if (root.nodeType === 1) root.querySelectorAll('.pos-badge:not([data-coded])').forEach(el => {
      const pos = el.textContent.trim();
      if (/^(QB|RB|WR|TE|FLEX|DEF|K)$/.test(pos)) el.classList.add('pos-' + pos);
      el.dataset.coded = '';
    });
  }
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; decorate(document.body); });
  };
  new MutationObserver(schedule).observe(document.body, {childList:true,subtree:true,characterData:true});
  schedule();
})();
