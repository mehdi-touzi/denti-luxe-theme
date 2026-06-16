/**
 * app.js — contrôleur principal de l'application Denti-Luxe
 */
(function () {
  'use strict';

  // ── Éléments DOM ──────────────────────────────────────────────────
  const dropZone     = document.getElementById('drop-zone');
  const fileInput    = document.getElementById('file-input');
  const editorPanel  = document.getElementById('editor-panel');
  const fileName     = document.getElementById('file-name');
  const fileType     = document.getElementById('file-type');
  const btnReset     = document.getElementById('btn-reset');
  const btnDownload  = document.getElementById('btn-download');
  const btnCopyXml   = document.getElementById('btn-copy-xml');
  const btnApplyRaw  = document.getElementById('btn-apply-raw');
  const paramSearch  = document.getElementById('param-search');
  const tabBtns      = document.querySelectorAll('.tab-btn');
  const rawXmlArea   = document.getElementById('raw-xml');

  let currentFile = null;

  // ── Drag & Drop ───────────────────────────────────────────────────
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) loadFile(fileInput.files[0]);
  });

  // ── Charger le fichier d'exemple (intégré, aucun réseau requis) ────
  const EXAMPLE_XML = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<ConstructionInfo version="3.5" software="exocad DentalCAD" date="2024-01-15">',
    '  <Patient name="Dupont Jean" id="PAT-001" dateOfBirth="1975-03-22" />',
    '  <Order labOrderId="CMD-2024-0042" clinicName="Cabinet Sourire Plus" dentistName="Dr. Martin" />',
    '  <Jaw jaw="upper" toothSystem="FDI">',
    '    <ToothRange from="14" to="14">',
    '      <ToothRestoration toothNumber="14" restorationKind="crown" material="ZrO2" shade="A2">',
    '        <CrownParameters marginHeight="0.5" wallThickness="0.8" occlusalThickness="1.2" minThickness="0.4" smoothingIterations="10" useAnatomy="true" copyAnatomy="false" anatomyCopyFactor="0.7" />',
    '        <Spacer value="0.05" marginAreaSpacer="0.0" />',
    '        <CementGap value="0.08" />',
    '        <Offset occlusal="0.0" vestibular="0.0" lingual="0.0" mesial="0.0" distal="0.0" />',
    '      </ToothRestoration>',
    '    </ToothRange>',
    '    <ToothRange from="15" to="15">',
    '      <ToothRestoration toothNumber="15" restorationKind="crown" material="ZrO2" shade="A3">',
    '        <CrownParameters marginHeight="0.5" wallThickness="0.8" occlusalThickness="1.2" minThickness="0.4" smoothingIterations="10" useAnatomy="true" copyAnatomy="false" anatomyCopyFactor="0.7" />',
    '        <Spacer value="0.05" marginAreaSpacer="0.0" />',
    '        <CementGap value="0.08" />',
    '      </ToothRestoration>',
    '    </ToothRange>',
    '  </Jaw>',
    '  <Milling>',
    '    <MillingParameters blockName="IPS e.max CAD" blockColor="A2-HT" millingStrategy="highSpeed" />',
    '    <MinObjectSize value="0.3" />',
    '  </Milling>',
    '  <OutputSettings>',
    '    <Export format="STL" resolution="high" units="mm" />',
    '    <Files saveConstructionFile="true" saveStl="true" />',
    '  </OutputSettings>',
    '</ConstructionInfo>'
  ].join('\n');

  const btnExample = document.getElementById('btn-example');
  if (btnExample) {
    btnExample.addEventListener('click', () => {
      try {
        const file = new File([EXAMPLE_XML], 'exemple_couronne.constructionInfo', { type: 'application/xml' });
        loadFile(file);
      } catch (err) {
        showToast("Impossible de charger l'exemple : " + err.message, 'error', 6000);
      }
    });
  }

  // ── Chargement du fichier ─────────────────────────────────────────
  async function loadFile(file) {
    currentFile = file;
    showToast('Chargement de ' + file.name + '…', 'info');

    try {
      const parsed = await ExocadParser.parse(file);
      ExocadEditor.init(parsed);

      fileName.textContent = file.name;
      fileType.textContent = `${file.type || 'XML / exocad'} — ${formatSize(file.size)}`;

      dropZone.classList.add('hidden');
      editorPanel.classList.remove('hidden');

      showToast(`Fichier chargé — ${parsed.metadata.totalAttributes} paramètres trouvés`, 'success');
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error', 6000);
      console.error(err);
    }
  }

  // ── Réinitialiser ─────────────────────────────────────────────────
  btnReset.addEventListener('click', () => {
    editorPanel.classList.add('hidden');
    dropZone.classList.remove('hidden');
    fileInput.value = '';
    currentFile = null;
    switchTab('params');
  });

  // ── Télécharger ───────────────────────────────────────────────────
  btnDownload.addEventListener('click', () => {
    const xml = ExocadEditor.getCurrentXml();
    const n   = ExocadEditor.getChangesCount();

    const baseName = currentFile ? currentFile.name.replace(/\.[^.]+$/, '') : 'exocad_export';
    const ext      = currentFile ? (currentFile.name.split('.').pop() || 'xml') : 'xml';
    const outName  = `${baseName}_corrigé.${ext}`;

    downloadText(xml, outName, 'application/xml');
    showToast(`Fichier téléchargé (${n} modification${n !== 1 ? 's' : ''})`, 'success');
  });

  // ── Copier XML ────────────────────────────────────────────────────
  btnCopyXml.addEventListener('click', () => {
    navigator.clipboard.writeText(rawXmlArea.value).then(() => {
      showToast('XML copié dans le presse-papiers', 'success');
    });
  });

  // ── Appliquer XML brut ────────────────────────────────────────────
  btnApplyRaw.addEventListener('click', () => {
    const ok = ExocadEditor.applyRawXml(rawXmlArea.value);
    if (ok) {
      showToast('XML appliqué — paramètres mis à jour', 'success');
    } else {
      showToast('XML invalide — vérifiez la syntaxe', 'error');
    }
  });

  // ── Recherche de paramètres ───────────────────────────────────────
  let searchTimer = null;
  paramSearch.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const state = ExocadEditor.getState();
      if (state) ExocadEditor.renderParams(state.groups, paramSearch.value);
    }, 200);
  });

  // ── Onglets ───────────────────────────────────────────────────────
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  function switchTab(tabName) {
    tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
    document.querySelectorAll('.tab-content').forEach(tc => {
      const isActive = tc.id === `tab-${tabName}`;
      tc.classList.toggle('hidden', !isActive);
    });

    if (tabName === 'raw') {
      const state = ExocadEditor.getState();
      if (state) ExocadEditor.renderRaw(ExocadEditor.getCurrentXml());
    }
  }

  // ── Raccourci clavier ─────────────────────────────────────────────
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (currentFile) btnDownload.click();
    }
  });

  // ── Utilitaires ───────────────────────────────────────────────────
  function showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'fadeOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  function downloadText(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' o';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
    return (bytes / (1024 * 1024)).toFixed(2) + ' Mo';
  }

  // Exposer showToast globalement pour debug
  window.DentiLuxe = { showToast };
})();
