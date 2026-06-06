/**
 * ExocadParser — lit et structure les fichiers exocad
 * Formats supportés : .constructionInfo (XML), .3ox (ZIP+XML), .xml
 */
const ExocadParser = (() => {

  /**
   * Point d'entrée principal.
   * Retourne { xmlDoc, xmlString, groups, metadata }
   */
  async function parse(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    let xmlString;

    if (ext === '3ox') {
      xmlString = await read3ox(file);
    } else {
      xmlString = await readText(file);
    }

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'application/xml');

    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      throw new Error('Fichier XML invalide : ' + parseError.textContent.slice(0, 120));
    }

    const groups  = extractGroups(xmlDoc);
    const metadata = extractMetadata(xmlDoc, file);

    return { xmlDoc, xmlString, groups, metadata };
  }

  /** Lit le fichier comme texte */
  function readText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Impossible de lire le fichier'));
      reader.readAsText(file);
    });
  }

  /** .3ox = ZIP — on cherche le premier XML à l'intérieur */
  async function read3ox(file) {
    // Tentative de lecture directe comme XML (certains .3ox sont juste XML)
    try {
      const text = await readText(file);
      const p = new DOMParser();
      const d = p.parseFromString(text, 'application/xml');
      if (!d.querySelector('parsererror')) return text;
    } catch (_) {}

    throw new Error(
      'Les fichiers .3ox compressés nécessitent une extraction manuelle.\n' +
      'Renommez le fichier en .zip, extrayez le XML à l\'intérieur, puis chargez-le ici.'
    );
  }

  /**
   * Extrait les paramètres en groupes thématiques depuis le XML.
   * Stratégie : parcours récursif des éléments, regroupement par tag parent.
   */
  function extractGroups(xmlDoc) {
    const root = xmlDoc.documentElement;
    const groups = {};

    function walk(node, path) {
      // Attributs du nœud courant
      if (node.attributes && node.attributes.length > 0) {
        const groupName = node.tagName || 'Racine';
        if (!groups[groupName]) groups[groupName] = [];

        for (const attr of node.attributes) {
          groups[groupName].push({
            id: `${path}@${attr.name}`,
            path,
            tag: node.tagName,
            attribute: attr.name,
            originalValue: attr.value,
            currentValue: attr.value,
            type: inferType(attr.value),
          });
        }
      }

      // Contenu texte pur (feuille)
      if (node.childNodes.length === 1 && node.firstChild.nodeType === 3) {
        const text = node.firstChild.nodeValue.trim();
        if (text) {
          const groupName = node.parentNode ? node.parentNode.tagName : 'Racine';
          if (!groups[groupName]) groups[groupName] = [];
          groups[groupName].push({
            id: `${path}#text`,
            path,
            tag: node.tagName,
            attribute: null,
            originalValue: text,
            currentValue: text,
            type: inferType(text),
          });
        }
      }

      // Récursion sur les enfants éléments
      for (const child of node.children || []) {
        walk(child, path ? `${path} > ${child.tagName}` : child.tagName);
      }
    }

    walk(root, root.tagName);
    return groups;
  }

  /** Infère le type de valeur pour affichage intelligent */
  function inferType(value) {
    if (value === 'true' || value === 'false') return 'boolean';
    if (/^-?\d+(\.\d+)?$/.test(value)) return 'number';
    if (/^#[0-9a-fA-F]{3,8}$/.test(value)) return 'color';
    return 'string';
  }

  /** Métadonnées globales du fichier */
  function extractMetadata(xmlDoc, file) {
    const root = xmlDoc.documentElement;
    const allAttrs = xmlDoc.querySelectorAll('*');
    let attrCount = 0;
    for (const el of allAttrs) attrCount += el.attributes.length;

    return {
      fileName: file.name,
      fileSize: formatSize(file.size),
      rootTag: root.tagName,
      totalElements: allAttrs.length,
      totalAttributes: attrCount,
      version: root.getAttribute('version') || root.getAttribute('Version') || '—',
      software: root.getAttribute('software') || root.getAttribute('Software') || 'exocad',
    };
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' o';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
    return (bytes / (1024 * 1024)).toFixed(2) + ' Mo';
  }

  /**
   * Applique les modifications à l'xmlDoc en mémoire,
   * puis sérialise en string propre.
   */
  function applyChanges(xmlDoc, changes) {
    // changes = [{ id, path, attribute, newValue }]
    for (const change of changes) {
      const pathParts = change.path.split(' > ');
      const nodes = findNodesByPath(xmlDoc.documentElement, pathParts, 0);

      for (const node of nodes) {
        if (change.attribute) {
          node.setAttribute(change.attribute, change.newValue);
        } else {
          if (node.firstChild && node.firstChild.nodeType === 3) {
            node.firstChild.nodeValue = change.newValue;
          }
        }
      }
    }

    return serialize(xmlDoc);
  }

  function findNodesByPath(node, parts, depth) {
    if (depth >= parts.length) return [];
    if (node.tagName !== parts[depth]) return [];
    if (depth === parts.length - 1) return [node];

    const results = [];
    for (const child of node.children || []) {
      results.push(...findNodesByPath(child, parts, depth + 1));
    }
    return results;
  }

  function serialize(xmlDoc) {
    const s = new XMLSerializer();
    let str = s.serializeToString(xmlDoc);
    // Ajoute une déclaration XML propre si absente
    if (!str.startsWith('<?xml')) {
      str = '<?xml version="1.0" encoding="UTF-8"?>\n' + str;
    }
    return prettifyXml(str);
  }

  /** Formatage XML avec indentation */
  function prettifyXml(xml) {
    let result = '';
    let indent = 0;
    const tab = '  ';

    xml = xml.replace(/>\s*</g, '><');

    for (let i = 0; i < xml.length; i++) {
      const c = xml[i];

      if (c === '<') {
        const isClose   = xml[i + 1] === '/';
        const isSelf    = xml.indexOf('>', i) > -1 && xml.slice(i, xml.indexOf('>', i) + 1).endsWith('/>');
        const isComment = xml.slice(i, i + 4) === '<!--';
        const isDecl    = xml.slice(i, i + 2) === '<?';

        if (isClose) indent = Math.max(0, indent - 1);

        result += '\n' + tab.repeat(indent) + '<';

        if (!isClose && !isSelf && !isComment && !isDecl) indent++;
        if (isSelf) indent = Math.max(0, indent - 1);
      } else if (c === '>') {
        result += '>';
      } else {
        result += c;
      }
    }

    return result.trim();
  }

  return { parse, applyChanges, serialize, prettifyXml };
})();
