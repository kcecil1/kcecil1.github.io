/*
 * Storage layer for the SKID/POD tracker.
 *
 * Data lives in localStorage under a single key as one JSON blob, so
 * import/export is just stringify/parse. Schema versioning lets future
 * field additions migrate gracefully without losing existing data.
 */

const STORAGE_KEY = 'iem-skids-pods-tracker:v1';
const SCHEMA_VERSION = 1;

const Store = (() => {
  let state = null;
  const listeners = new Set();

  function emptyState() {
    // Deep-clone defaults so editing them in the UI does not mutate the source file.
    const seq = JSON.parse(JSON.stringify(window.DEFAULT_SEQUENCES || {}));
    return {
      schema: SCHEMA_VERSION,
      meta: {
        siteName: '',
        projectName: '',
        lastSaved: null
      },
      sequences: seq,
      units: [],
      partsIn: [],
      partsOut: []
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) { state = emptyState(); return; }
      const parsed = JSON.parse(raw);
      state = migrate(parsed);
    } catch (err) {
      console.error('Failed to load saved data, resetting.', err);
      state = emptyState();
    }
  }

  function migrate(data) {
    // Forward-compatible: fill in any missing top-level keys.
    const base = emptyState();
    const merged = { ...base, ...data };
    merged.meta = { ...base.meta, ...(data.meta || {}) };
    // If user has never edited sequences, refresh from defaults so new
    // template steps added in code automatically show up.
    if (!data.sequences || Object.keys(data.sequences).length === 0) {
      merged.sequences = base.sequences;
    }
    merged.units = data.units || [];
    merged.partsIn = data.partsIn || [];
    merged.partsOut = data.partsOut || [];
    merged.schema = SCHEMA_VERSION;
    return merged;
  }

  function save() {
    state.meta.lastSaved = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    listeners.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } });
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function get() { return state; }

  function uid(prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  /* ---------- Units (SKIDs / PODs) ---------- */

  function addUnit(partial) {
    const unit = {
      id: uid('unit'),
      name: partial.name || 'New Unit',
      kind: partial.kind || 'SKID',           // SKID | POD
      category: partial.category || 'L3',     // L3 | L4 | Warranty | (custom)
      project: partial.project || '',
      jobNumber: partial.jobNumber || '',
      customer: partial.customer || '',
      site: partial.site || '',
      status: partial.status || 'In Progress',
      dateCreated: new Date().toISOString(),
      dateUpdated: new Date().toISOString(),
      notes: partial.notes || '',
      progress: {},                           // { [sequenceId]: { [stepId]: { done, by, at, note } } }
      issues: [],
      missingParts: []
    };
    state.units.unshift(unit);
    save();
    return unit;
  }

  function updateUnit(id, patch) {
    const u = state.units.find(x => x.id === id);
    if (!u) return;
    Object.assign(u, patch, { dateUpdated: new Date().toISOString() });
    save();
  }

  function deleteUnit(id) {
    state.units = state.units.filter(u => u.id !== id);
    // Also clear associated parts records, since they reference the unit.
    state.partsIn = state.partsIn.filter(p => p.unitId !== id);
    state.partsOut = state.partsOut.filter(p => p.unitId !== id);
    save();
  }

  function setStep(unitId, sequenceId, stepId, patch) {
    const u = state.units.find(x => x.id === unitId);
    if (!u) return;
    u.progress[sequenceId] = u.progress[sequenceId] || {};
    const cur = u.progress[sequenceId][stepId] || {};
    u.progress[sequenceId][stepId] = { ...cur, ...patch };
    u.dateUpdated = new Date().toISOString();
    save();
  }

  /* ---------- Issues (per-unit log) ---------- */

  function addIssue(unitId, partial) {
    const u = state.units.find(x => x.id === unitId);
    if (!u) return;
    u.issues.unshift({
      id: uid('iss'),
      title: partial.title || 'New issue',
      description: partial.description || '',
      severity: partial.severity || 'Medium',
      status: partial.status || 'Open',         // Open | Troubleshooting | Resolved
      resolution: partial.resolution || '',
      dateCreated: new Date().toISOString(),
      dateResolved: null
    });
    u.dateUpdated = new Date().toISOString();
    save();
  }

  function updateIssue(unitId, issueId, patch) {
    const u = state.units.find(x => x.id === unitId);
    if (!u) return;
    const iss = u.issues.find(i => i.id === issueId);
    if (!iss) return;
    Object.assign(iss, patch);
    if (patch.status === 'Resolved' && !iss.dateResolved) iss.dateResolved = new Date().toISOString();
    if (patch.status && patch.status !== 'Resolved') iss.dateResolved = null;
    u.dateUpdated = new Date().toISOString();
    save();
  }

  function deleteIssue(unitId, issueId) {
    const u = state.units.find(x => x.id === unitId);
    if (!u) return;
    u.issues = u.issues.filter(i => i.id !== issueId);
    save();
  }

  /* ---------- Missing parts (per-unit) ---------- */

  function addMissingPart(unitId, partial) {
    const u = state.units.find(x => x.id === unitId);
    if (!u) return;
    u.missingParts.unshift({
      id: uid('miss'),
      partNumber: partial.partNumber || '',
      description: partial.description || '',
      qty: Number(partial.qty) || 1,
      neededBy: partial.neededBy || '',
      status: partial.status || 'Needed',       // Needed | Ordered | Received
      notes: partial.notes || '',
      dateCreated: new Date().toISOString()
    });
    save();
  }

  function updateMissingPart(unitId, partId, patch) {
    const u = state.units.find(x => x.id === unitId);
    if (!u) return;
    const p = u.missingParts.find(x => x.id === partId);
    if (!p) return;
    Object.assign(p, patch);
    save();
  }

  function deleteMissingPart(unitId, partId) {
    const u = state.units.find(x => x.id === unitId);
    if (!u) return;
    u.missingParts = u.missingParts.filter(p => p.id !== partId);
    save();
  }

  /* ---------- Parts inbound (replacements being sent TO site) ---------- */

  function addPartIn(partial) {
    state.partsIn.unshift({
      id: uid('pin'),
      unitId: partial.unitId || '',
      partNumber: partial.partNumber || '',
      description: partial.description || '',
      qty: Number(partial.qty) || 1,
      carrier: partial.carrier || '',
      trackingNumber: partial.trackingNumber || '',
      shippedDate: partial.shippedDate || '',
      eta: partial.eta || '',
      status: partial.status || 'Pending',      // Pending | Shipped | In Transit | Delivered | Installed
      notes: partial.notes || '',
      dateCreated: new Date().toISOString()
    });
    save();
  }

  function updatePartIn(id, patch) {
    const p = state.partsIn.find(x => x.id === id);
    if (!p) return;
    Object.assign(p, patch);
    save();
  }

  function deletePartIn(id) {
    state.partsIn = state.partsIn.filter(p => p.id !== id);
    save();
  }

  /* ---------- Parts outbound (RMA parts being sent FROM site) ---------- */

  function addPartOut(partial) {
    state.partsOut.unshift({
      id: uid('pout'),
      unitId: partial.unitId || '',
      partNumber: partial.partNumber || '',
      description: partial.description || '',
      qty: Number(partial.qty) || 1,
      rmaNumber: partial.rmaNumber || '',
      reason: partial.reason || '',
      carrier: partial.carrier || '',
      trackingNumber: partial.trackingNumber || '',
      shippedDate: partial.shippedDate || '',
      status: partial.status || 'Pending Pickup', // Pending Pickup | Shipped | In Transit | Received at IEM | Closed
      notes: partial.notes || '',
      dateCreated: new Date().toISOString()
    });
    save();
  }

  function updatePartOut(id, patch) {
    const p = state.partsOut.find(x => x.id === id);
    if (!p) return;
    Object.assign(p, patch);
    save();
  }

  function deletePartOut(id) {
    state.partsOut = state.partsOut.filter(p => p.id !== id);
    save();
  }

  /* ---------- Sequence editing (modular templates) ---------- */

  function addSequenceSection(category, name) {
    state.sequences[category] = state.sequences[category] || [];
    state.sequences[category].push({
      id: uid('seq'),
      name: name || 'New Section',
      steps: []
    });
    save();
  }

  function renameSequenceSection(category, sequenceId, newName) {
    const sec = (state.sequences[category] || []).find(s => s.id === sequenceId);
    if (!sec) return;
    sec.name = newName;
    save();
  }

  function deleteSequenceSection(category, sequenceId) {
    state.sequences[category] = (state.sequences[category] || []).filter(s => s.id !== sequenceId);
    save();
  }

  function addSequenceStep(category, sequenceId, step) {
    const sec = (state.sequences[category] || []).find(s => s.id === sequenceId);
    if (!sec) return;
    sec.steps.push({
      id: uid('step'),
      text: step.text || 'New step',
      required: !!step.required,
      detail: step.detail || ''
    });
    save();
  }

  function updateSequenceStep(category, sequenceId, stepId, patch) {
    const sec = (state.sequences[category] || []).find(s => s.id === sequenceId);
    if (!sec) return;
    const st = sec.steps.find(s => s.id === stepId);
    if (!st) return;
    Object.assign(st, patch);
    save();
  }

  function deleteSequenceStep(category, sequenceId, stepId) {
    const sec = (state.sequences[category] || []).find(s => s.id === sequenceId);
    if (!sec) return;
    sec.steps = sec.steps.filter(s => s.id !== stepId);
    save();
  }

  function addCategory(name) {
    if (!name || state.sequences[name]) return;
    state.sequences[name] = [];
    save();
  }

  /* ---------- Import / Export ---------- */

  function exportJSON() {
    return JSON.stringify(state, null, 2);
  }

  function importJSON(text) {
    const parsed = JSON.parse(text);
    state = migrate(parsed);
    save();
  }

  function resetAll() {
    state = emptyState();
    save();
  }

  function resetSequencesToDefault() {
    state.sequences = JSON.parse(JSON.stringify(window.DEFAULT_SEQUENCES || {}));
    save();
  }

  return {
    load, save, subscribe, get, uid,
    addUnit, updateUnit, deleteUnit, setStep,
    addIssue, updateIssue, deleteIssue,
    addMissingPart, updateMissingPart, deleteMissingPart,
    addPartIn, updatePartIn, deletePartIn,
    addPartOut, updatePartOut, deletePartOut,
    addSequenceSection, renameSequenceSection, deleteSequenceSection,
    addSequenceStep, updateSequenceStep, deleteSequenceStep,
    addCategory,
    exportJSON, importJSON, resetAll, resetSequencesToDefault
  };
})();

window.Store = Store;
