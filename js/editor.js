/**
 * ExocadEditor — gère l'affichage et les modifications des paramètres
 */
const ExocadEditor = (() => {

  let _state = null; // { xmlDoc, xmlString, groups, metadata, changes: Map }

  /** Initialise l'éditeur avec les données parsées */
  function init(parsed) {
    _state = {
      ...parsed,
      changes: new Map(), // id -> { ...param, newValue }
    };
    renderAll();
  }

  function getState() { return _state; }

  /** Re-render complet */
  function renderAll() {
    renderParams(_state.groups);
    renderRaw(getCurrentXml());
    renderSummary(_state.metadata, _state.groups);
  }

  // ── Onglet Paramètres ──────────────────────────────────────────────

  function renderParams(groups, filterText = '') {
    const container = document.getElementById('params-container');
    container.innerHTML = '';

    const filter = filterText.toLowerCase().trim();
    let totalShown = 0;

    for (const [groupName, params] of Object.entries(groups)) {
      const filtered = filter
        ? params.filter(p =>
            p.attribute?.toLowerCase().includes(filter) ||
            p.tag.toLowerCase().includes(filter) ||
            p.currentValue.toLowerCase().includes(filter)
          )
        : params;

      if (filtered.length === 0) continue;
      totalShown += filtered.length;

      const section = document.createElement('div');
      section.className = 'param-group';
      section.innerHTML = `<div class="param-group-title">${escapeHtml(groupName)} <span style="font-weight:400;color:#888">(${filtered.length})</span></div>`;

      const grid = document.createElement('div');
      grid.className = 'param-grid';

      for (const param of filtered) {
        grid.appendChild(buildParamItem(param));
      }

      section.appendChild(grid);
      container.appendChild(section);
    }

    if (totalShown === 0) {
      container.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:32px">Aucun paramètre trouvé pour "<em>${escapeHtml(filterText)}</em>"</p>`;
    }
  }

  function buildParamItem(param) {
    const isModified = _state.changes.has(param.id);
    const currentVal = isModified ? _state.changes.get(param.id).newValue : param.currentValue;

    const item = document.createElement('div');
    item.className = `param-item${isModified ? ' modified' : ''}`;
    item.dataset.id = param.id;

    const label = param.attribute
      ? `${param.tag} <strong>@${escapeHtml(param.attribute)}</strong>`
      : `<strong>${escapeHtml(param.tag)}</strong> (contenu)`;

    item.innerHTML = `
      <div class="param-label">${label}</div>
      ${buildInput(param, currentVal)}
      <div class="param-path" title="${escapeHtml(param.path)}">${escapeHtml(shortenPath(param.path))}</div>
    `;

    // Listener sur l'input
    const input = item.querySelector('.param-input');
    if (input) {
      input.addEventListener('change', () => onParamChange(param, input.value, item, input));
      input.addEventListener('input',  () => {
        const changed = input.value !== param.originalValue;
        input.classList.toggle('changed', changed);
        item.classList.toggle('modified', changed);
      });
    }

    return item;
  }

  function buildInput(param, value) {
    if (param.type === 'boolean') {
      const checked = value === 'true' ? 'checked' : '';
      return `
        <select class="param-input">
          <option value="true"  ${value === 'true'  ? 'selected' : ''}>true</option>
          <option value="false" ${value === 'false' ? 'selected' : ''}>false</option>
        </select>
      `;
    }
    if (param.type === 'color') {
      return `
        <div style="display:flex;gap:6px;align-items:center">
          <input type="color" value="${escapeAttr(toHex6(value))}" style="width:36px;height:32px;padding:2px;border:1px solid var(--border);border-radius:4px;cursor:pointer" class="color-picker" />
          <input type="text" class="param-input" value="${escapeAttr(value)}" style="flex:1" />
        </div>
      `;
    }
    return `<input type="text" class="param-input" value="${escapeAttr(value)}" />`;
  }

  function onParamChange(param, newValue, item, input) {
    if (newValue === param.originalValue) {
      _state.changes.delete(param.id);
      item.classList.remove('modified');
      input.classList.remove('changed');
    } else {
      _state.changes.set(param.id, { ...param, newValue });
      item.classList.add('modified');
      input.classList.add('changed');
    }
    syncRawXml();
  }

  // ── Onglet XML brut ────────────────────────────────────────────────

  function renderRaw(xml) {
    document.getElementById('raw-xml').value = xml;
  }

  function syncRawXml() {
    document.getElementById('raw-xml').value = getCurrentXml();
  }

  function applyRawXml(xmlString) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlString, 'application/xml');
      if (doc.querySelector('parsererror')) throw new Error('XML invalide');

      _state.xmlDoc    = doc;
      _state.xmlString = xmlString;
      _state.changes   = new Map();
      _state.groups    = ExocadParser.parse ? _state.groups : {}; // conserver les groupes originaux

      // Re-parse complet depuis le nouveau XML
      const groups = {};
      function walk(node, path) {
        if (node.attributes && node.attributes.length > 0) {
          const g = node.tagName;
          if (!groups[g]) groups[g] = [];
          for (const attr of node.attributes) {
            groups[g].push({
              id: `${path}@${attr.name}`, path, tag: node.tagName,
              attribute: attr.name, originalValue: attr.value,
              currentValue: attr.value, type: inferType(attr.value),
            });
          }
        }
        for (const child of node.children || []) walk(child, path ? `${path} > ${child.tagName}` : child.tagName);
      }
      walk(doc.documentElement, doc.documentElement.tagName);
      _state.groups = groups;

      renderParams(groups);
      return true;
    } catch (e) {
      return false;
    }
  }

  // ── Onglet Résumé ──────────────────────────────────────────────────

  function renderSummary(metadata, groups) {
    const container = document.getElementById('summary-container');
    const paramCount = Object.values(groups).reduce((s, g) => s + g.length, 0);

    container.innerHTML = `
      <div class="summary-grid">
        <div class="summary-card"><div class="summary-value">${Object.keys(groups).length}</div><div class="summary-label">Groupes</div></div>
        <div class="summary-card"><div class="summary-value">${paramCount}</div><div class="summary-label">Paramètres</div></div>
        <div class="summary-card"><div class="summary-value">${metadata.totalElements}</div><div class="summary-label">Éléments XML</div></div>
        <div class="summary-card"><div class="summary-value">${metadata.fileSize}</div><div class="summary-label">Taille fichier</div></div>
      </div>
      <div class="summary-list">
        <h3>Informations générales</h3>
        ${row('Fichier', metadata.fileName)}
        ${row('Tag racine', metadata.rootTag)}
        ${row('Version', metadata.version)}
        ${row('Logiciel', metadata.software)}
      </div>
    `;
  }

  function row(k, v) {
    return `<div class="summary-row"><span class="key">${escapeHtml(k)}</span><span class="val">${escapeHtml(v)}</span></div>`;
  }

  // ── Export ────────────────────────────────────────────────────────

  function getCurrentXml() {
    if (_state.changes.size === 0) return _state.xmlString;
    const changesArr = Array.from(_state.changes.values()).map(c => ({
      id: c.id, path: c.path, attribute: c.attribute, newValue: c.newValue,
    }));
    return ExocadParser.applyChanges(_state.xmlDoc.cloneNode(true), changesArr);
  }

  function getChangesCount() { return _state?.changes.size ?? 0; }

  // ── Helpers ───────────────────────────────────────────────────────

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escapeAttr(s) { return String(s).replace(/"/g, '&quot;'); }

  function shortenPath(path) {
    const parts = path.split(' > ');
    if (parts.length <= 3) return path;
    return parts[0] + ' > … > ' + parts.slice(-2).join(' > ');
  }

  function inferType(value) {
    if (value === 'true' || value === 'false') return 'boolean';
    if (/^-?\d+(\.\d+)?$/.test(value)) return 'number';
    if (/^#[0-9a-fA-F]{3,8}$/.test(value)) return 'color';
    return 'string';
  }

  function toHex6(value) {
    if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
    if (/^#[0-9a-fA-F]{3}$/.test(value)) {
      return '#' + value.slice(1).split('').map(c => c + c).join('');
    }
    return '#000000';
  }

  return { init, getState, renderParams, renderRaw, applyRawXml, getCurrentXml, getChangesCount };
})();
