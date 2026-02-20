/**
 * Custom Colored Select Component
 *
 * Replaces every native <select> with a fully-styled dropdown that shows
 * colour-coded options matching the badge palette already used in the app.
 * The native <select> stays in the DOM (hidden) so form submission still works.
 *
 * Public API:
 *   enhanceSelect(selectEl)         – enhance one element, returns { refresh, rebuild }
 *   enhanceAllSelects(containerEl)  – enhance every <select> inside a container
 */

/* ---- Colour map – keys are the Hebrew option texts ---- */
const SELECT_COLORS = {
  /* Status */
  'ממתין':                    { bg: '#fef3c7', fg: '#b45309' },
  'בעבודה':                   { bg: '#dbeafe', fg: '#1d4ed8' },
  'נשלחו תוכניות לעיון':      { bg: '#e0e7ff', fg: '#4338ca' },
  'נשלחו תוכניות מעודכנות':   { bg: '#d1fae5', fg: '#047857' },
  'נשלחו תוכניות למכרז':      { bg: '#f3e8ff', fg: '#7c3aed' },
  'נשלחו תוכניות לביצוע':     { bg: '#ccfbf1', fg: '#0d9488' },
  'מיוחד':                    { bg: '#fce7f3', fg: '#db2777' },

  /* Priority */
  'בהמתנה':                   { bg: '#f3f4f6', fg: '#4b5563' },
  'דחוף':                     { bg: '#fef2f2', fg: '#dc2626' },
  'חדש':                      { bg: '#f0fdf4', fg: '#16a34a' },

  /* Yes / No */
  'כן':                       { bg: '#d1fae5', fg: '#047857' },
  'לא':                       { bg: '#fef2f2', fg: '#dc2626' },

  /* Employee modal */
  'עובד (2)':                 { bg: '#dbeafe', fg: '#1d4ed8' },
  'מנהל (1)':                 { bg: '#fce7f3', fg: '#db2777' },
  'עובד':                     { bg: '#dbeafe', fg: '#1d4ed8' },
  'מנהל':                     { bg: '#fce7f3', fg: '#db2777' },
};

/**
 * Enhance a single native <select> element.
 * @param {HTMLSelectElement} selectEl
 * @returns {{ refresh: Function, rebuild: Function } | null}
 */
function enhanceSelect(selectEl) {
  if (!selectEl || selectEl.dataset.csEnhanced) return null;
  selectEl.dataset.csEnhanced = '1';

  const isSmall = selectEl.classList.contains('edit-select');

  /* ---- Wrapper ---- */
  const wrapper = document.createElement('div');
  wrapper.className = 'cs-wrapper' + (isSmall ? ' cs-sm' : '');

  /* ---- Trigger ---- */
  const trigger = document.createElement('div');
  trigger.className = 'cs-trigger';
  trigger.tabIndex = 0;
  trigger.setAttribute('role', 'combobox');
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');

  const label = document.createElement('span');
  label.className = 'cs-trigger-label';

  const arrow = document.createElement('span');
  arrow.className = 'cs-trigger-arrow';
  arrow.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path d="M2 4l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

  trigger.append(label, arrow);

  /* ---- Dropdown ---- */
  const dropdown = document.createElement('div');
  dropdown.className = 'cs-dropdown';
  dropdown.setAttribute('role', 'listbox');

  wrapper.append(trigger, dropdown);

  /* Insert wrapper in place of select, then move select inside it (hidden) */
  selectEl.parentNode.insertBefore(wrapper, selectEl);
  wrapper.appendChild(selectEl);
  selectEl.style.display = 'none';

  /* ---- Internal helpers ---- */

  function updateTrigger() {
    const sel = selectEl.options[selectEl.selectedIndex];
    const text  = sel ? sel.text  : '';
    const value = sel ? sel.value : '';
    label.textContent = text || '-- בחר --';

    const c = SELECT_COLORS[text];
    if (c && value !== '') {
      trigger.style.background   = c.bg;
      trigger.style.color        = c.fg;
      trigger.style.borderColor  = c.fg + '66';
    } else {
      trigger.style.removeProperty('background');
      trigger.style.removeProperty('color');
      trigger.style.removeProperty('border-color');
    }
  }

  function buildDropdown() {
    dropdown.innerHTML = '';
    Array.from(selectEl.options).forEach((opt, i) => {
      const isSelected = i === selectEl.selectedIndex;

      const item = document.createElement('div');
      item.className = 'cs-option' + (isSelected ? ' selected' : '');
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(isSelected));

      const c = SELECT_COLORS[opt.text];
      if (c && opt.value !== '') {
        item.style.background = c.bg;
        item.style.color      = c.fg;

        const dot = document.createElement('span');
        dot.className = 'cs-dot';
        dot.style.background = c.fg;
        item.appendChild(dot);
      }

      item.appendChild(document.createTextNode(opt.text || '-- בחר --'));

      item.addEventListener('mousedown', (e) => {
        e.preventDefault(); /* keep focus on trigger */
        selectEl.selectedIndex = i;
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        updateTrigger();
        closeDropdown();
      });

      dropdown.appendChild(item);
    });
  }

  function openDropdown() {
    /* Close any other open dropdowns first */
    document.querySelectorAll('.cs-dropdown.open').forEach(d => {
      if (d !== dropdown) {
        d.classList.remove('open');
        d.parentElement?.querySelector('.cs-trigger.open')?.classList.remove('open');
      }
    });

    buildDropdown();
    dropdown.classList.add('open');
    trigger.classList.add('open');
    trigger.setAttribute('aria-expanded', 'true');

    const selected = dropdown.querySelector('.cs-option.selected');
    if (selected) setTimeout(() => selected.scrollIntoView({ block: 'nearest' }), 0);
  }

  function closeDropdown() {
    dropdown.classList.remove('open');
    trigger.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');
  }

  /* ---- Events ---- */

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.contains('open') ? closeDropdown() : openDropdown();
  });

  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      dropdown.classList.contains('open') ? closeDropdown() : openDropdown();
    } else if (e.key === 'Escape') {
      closeDropdown();
      /* Bubble a custom event so inline-edit can restore the original value */
      wrapper.dispatchEvent(new CustomEvent('cs:escape', { bubbles: true }));
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!dropdown.classList.contains('open')) openDropdown();
      const next = Math.max(0, Math.min(
        selectEl.selectedIndex + (e.key === 'ArrowDown' ? 1 : -1),
        selectEl.options.length - 1
      ));
      selectEl.selectedIndex = next;
      updateTrigger();
      buildDropdown();
    }
  });

  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) closeDropdown();
  });

  /* MutationObserver refreshes the trigger when options are rebuilt externally */
  new MutationObserver(updateTrigger).observe(selectEl, { childList: true, attributes: true });

  /* Expose refresh on the element for post-reset calls */
  selectEl._csRefresh = updateTrigger;

  updateTrigger();

  return { refresh: updateTrigger, rebuild: buildDropdown };
}

/**
 * Enhance all <select> elements within a container.
 * Safe to call multiple times – already-enhanced elements are skipped.
 * @param {string|Element} [container] – CSS selector string or DOM element
 */
function enhanceAllSelects(container) {
  const root = typeof container === 'string'
    ? document.querySelector(container)
    : (container || document);
  if (!root) return;
  root.querySelectorAll('select').forEach(enhanceSelect);
}
