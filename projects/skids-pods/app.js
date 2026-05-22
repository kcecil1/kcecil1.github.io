/*
 * IEM SKID / POD Tracker - main UI / controller.
 *
 * Plain DOM + delegated event handlers, no framework. Render functions
 * rebuild the active tab/modal from current Store state. Designed to be
 * easy to extend: every section is a render function keyed by tab id.
 */

(function () {
  const $  = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function fmtDate(s) {
    if (!s) return '';
    const d = new Date(s);
    if (isNaN(d)) return s;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 1800);
  }

  function pillClass(prefix, value) {
    return prefix + '-' + String(value || '').toLowerCase().replace(/\s+/g, '-');
  }

  /* ------------------------------------------------------------------ */
  /* Progress math                                                       */
  /* ------------------------------------------------------------------ */

  function unitProgress(unit) {
    const seqs = Store.get().sequences[unit.category] || [];
    let total = 0, done = 0;
    seqs.forEach(sec => {
      sec.steps.forEach(step => {
        total++;
        const p = (unit.progress[sec.id] || {})[step.id];
        if (p && p.done) done++;
      });
    });
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
  }

  function sectionProgress(unit, section) {
    let total = section.steps.length, done = 0;
    section.steps.forEach(step => {
      const p = (unit.progress[section.id] || {})[step.id];
      if (p && p.done) done++;
    });
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
  }

  /* ------------------------------------------------------------------ */
  /* Tabs                                                                */
  /* ------------------------------------------------------------------ */

  let activeTab = 'dashboard';

  function renderTabs() {
    const s = Store.get();
    const seqCategories = Object.keys(s.sequences);
    const openIssues = s.units.reduce((n, u) => n + u.issues.filter(i => i.status !== 'Resolved').length, 0);
    const inboundOpen = s.partsIn.filter(p => p.status !== 'Installed' && p.status !== 'Delivered').length;
    const rmaOpen     = s.partsOut.filter(p => p.status !== 'Closed' && p.status !== 'Received at IEM').length;

    const tabs = [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'units',     label: 'Units (SKID/POD)', count: s.units.length },
      { id: 'issues',    label: 'Issues',           count: openIssues },
      { id: 'parts-in',  label: 'Parts Inbound',    count: inboundOpen },
      { id: 'parts-out', label: 'RMA / Outbound',   count: rmaOpen },
      ...seqCategories.map(cat => ({ id: 'tmpl:' + cat, label: cat + ' Sequences' })),
      { id: 'settings',  label: 'Settings' }
    ];

    const nav = $('#tabs');
    nav.innerHTML = tabs.map(t => `
      <button data-tab="${esc(t.id)}" class="${activeTab === t.id ? 'active' : ''}">
        ${esc(t.label)}${t.count != null ? `<span class="tab-count">${t.count}</span>` : ''}
      </button>
    `).join('');
  }

  function setTab(id) {
    activeTab = id;
    renderTabs();
    renderActive();
  }

  /* ------------------------------------------------------------------ */
  /* Main routing                                                        */
  /* ------------------------------------------------------------------ */

  function renderActive() {
    const main = $('#main');
    if (activeTab === 'dashboard')       main.innerHTML = renderDashboard();
    else if (activeTab === 'units')      main.innerHTML = renderUnitsList();
    else if (activeTab === 'issues')     main.innerHTML = renderIssuesView();
    else if (activeTab === 'parts-in')   main.innerHTML = renderPartsIn();
    else if (activeTab === 'parts-out')  main.innerHTML = renderPartsOut();
    else if (activeTab === 'settings')   main.innerHTML = renderSettings();
    else if (activeTab.startsWith('tmpl:')) {
      const cat = activeTab.slice(5);
      main.innerHTML = renderTemplates(cat);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Dashboard                                                           */
  /* ------------------------------------------------------------------ */

  function renderDashboard() {
    const s = Store.get();
    const u = s.units;

    const byCat = u.reduce((m, x) => (m[x.category] = (m[x.category] || 0) + 1, m), {});
    const byStatus = u.reduce((m, x) => (m[x.status] = (m[x.status] || 0) + 1, m), {});
    const openIssues = u.reduce((n, x) => n + x.issues.filter(i => i.status !== 'Resolved').length, 0);
    const inbound = s.partsIn.filter(p => p.status !== 'Installed').length;
    const rma     = s.partsOut.filter(p => p.status !== 'Closed').length;

    const recent = [...u].sort((a, b) => (b.dateUpdated || '').localeCompare(a.dateUpdated || '')).slice(0, 6);

    return `
      <div class="kpi-row">
        <div class="kpi accent"><div class="kpi-label">Total Units</div><div class="kpi-value">${u.length}</div></div>
        <div class="kpi blue"><div class="kpi-label">L3</div><div class="kpi-value">${byCat.L3 || 0}</div></div>
        <div class="kpi good"><div class="kpi-label">L4</div><div class="kpi-value">${byCat.L4 || 0}</div></div>
        <div class="kpi warn"><div class="kpi-label">Warranty</div><div class="kpi-value">${byCat.Warranty || 0}</div></div>
        <div class="kpi bad"><div class="kpi-label">Open Issues</div><div class="kpi-value">${openIssues}</div></div>
        <div class="kpi blue"><div class="kpi-label">Parts Inbound</div><div class="kpi-value">${inbound}</div></div>
        <div class="kpi warn"><div class="kpi-label">RMA Outbound</div><div class="kpi-value">${rma}</div></div>
      </div>

      <div class="panel">
        <h2>Recently Updated Units
          <div class="panel-actions">
            <button class="btn primary" data-action="new-unit">+ New Unit</button>
          </div>
        </h2>
        ${recent.length === 0
          ? `<div class="empty">No units yet. Click "+ New Unit" to start tracking a SKID, POD, or warranty job.</div>`
          : `<div class="grid">${recent.map(unitCardHTML).join('')}</div>`}
      </div>

      <div class="panel">
        <h2>Status Breakdown</h2>
        ${Object.keys(byStatus).length === 0
          ? `<div class="empty">No units yet.</div>`
          : `<table class="tbl">
              <thead><tr><th>Status</th><th>Count</th></tr></thead>
              <tbody>${Object.entries(byStatus).map(([k, v]) =>
                `<tr><td><span class="pill ${pillClass('status', k)}">${esc(k)}</span></td><td>${v}</td></tr>`
              ).join('')}</tbody>
            </table>`}
      </div>
    `;
  }

  function unitCardHTML(u) {
    const p = unitProgress(u);
    const openIss = u.issues.filter(i => i.status !== 'Resolved').length;
    const missing = u.missingParts.filter(x => x.status !== 'Received').length;
    return `
      <div class="unit-card" data-action="open-unit" data-id="${esc(u.id)}">
        <div class="uc-top">
          <div>
            <div class="uc-name">${esc(u.name)}</div>
            <div class="uc-meta">${esc(u.customer || '—')} · ${esc(u.site || 'No site')}</div>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px; align-items:flex-end;">
            <span class="pill ${pillClass('', u.kind.toLowerCase())}">${esc(u.kind)}</span>
            <span class="pill ${pillClass('', u.category.toLowerCase())}">${esc(u.category)}</span>
          </div>
        </div>
        <div class="uc-progress"><span style="width:${p.pct}%"></span></div>
        <div class="uc-stats">
          <div class="stat"><strong>${p.done}/${p.total}</strong> steps</div>
          <div class="stat"><strong>${openIss}</strong> open issue${openIss === 1 ? '' : 's'}</div>
          <div class="stat"><strong>${missing}</strong> missing part${missing === 1 ? '' : 's'}</div>
          <div class="stat" style="margin-left:auto;"><span class="pill ${pillClass('status', u.status)}">${esc(u.status)}</span></div>
        </div>
      </div>
    `;
  }

  /* ------------------------------------------------------------------ */
  /* Units list                                                          */
  /* ------------------------------------------------------------------ */

  let unitsFilter = { search: '', category: '', status: '' };

  function renderUnitsList() {
    const s = Store.get();
    const cats = Object.keys(s.sequences);
    const statuses = ['In Progress', 'On Hold', 'Blocked', 'Complete'];
    const filtered = s.units.filter(u => {
      const q = unitsFilter.search.trim().toLowerCase();
      if (q && ![u.name, u.customer, u.site, u.jobNumber, u.project].join(' ').toLowerCase().includes(q)) return false;
      if (unitsFilter.category && u.category !== unitsFilter.category) return false;
      if (unitsFilter.status && u.status !== unitsFilter.status) return false;
      return true;
    });

    return `
      <div class="panel">
        <h2>SKIDs / PODs
          <div class="panel-actions">
            <button class="btn primary" data-action="new-unit">+ New Unit</button>
          </div>
        </h2>
        <div class="section-toolbar">
          <input class="search" id="units-search" placeholder="Search name, customer, job #, site…" value="${esc(unitsFilter.search)}">
          <select id="units-cat">
            <option value="">All categories</option>
            ${cats.map(c => `<option value="${esc(c)}" ${c === unitsFilter.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}
          </select>
          <select id="units-status">
            <option value="">All statuses</option>
            ${statuses.map(c => `<option value="${esc(c)}" ${c === unitsFilter.status ? 'selected' : ''}>${esc(c)}</option>`).join('')}
          </select>
        </div>
        ${filtered.length === 0
          ? `<div class="empty">No units match. Try clearing filters or click "+ New Unit".</div>`
          : `<div class="grid">${filtered.map(unitCardHTML).join('')}</div>`}
      </div>
    `;
  }

  /* ------------------------------------------------------------------ */
  /* Issues (cross-unit view)                                            */
  /* ------------------------------------------------------------------ */

  function renderIssuesView() {
    const s = Store.get();
    const rows = [];
    s.units.forEach(u => {
      u.issues.forEach(i => rows.push({ unit: u, issue: i }));
    });
    rows.sort((a, b) => (b.issue.dateCreated || '').localeCompare(a.issue.dateCreated || ''));

    return `
      <div class="panel">
        <h2>All Issues (across every unit)</h2>
        ${rows.length === 0
          ? `<div class="empty">No issues logged yet. Open a unit and use its Issues tab to log one.</div>`
          : `<table class="tbl">
              <thead>
                <tr><th>Unit</th><th>Title</th><th>Severity</th><th>Status</th><th>Created</th><th>Resolved</th><th></th></tr>
              </thead>
              <tbody>
                ${rows.map(({ unit, issue }) => `
                  <tr>
                    <td>
                      <a href="#" data-action="open-unit" data-id="${esc(unit.id)}" style="color:var(--accent-2); text-decoration:none;">
                        ${esc(unit.name)}
                      </a>
                      <div style="font-size:11px; color:var(--text-dim);">${esc(unit.category)} · ${esc(unit.kind)}</div>
                    </td>
                    <td>${esc(issue.title)}</td>
                    <td><span class="pill ${pillClass('sev', issue.severity)}">${esc(issue.severity)}</span></td>
                    <td><span class="pill ${pillClass('iss', issue.status === 'Troubleshooting' ? 'trouble' : issue.status.toLowerCase())}">${esc(issue.status)}</span></td>
                    <td style="font-size:12px;">${esc(fmtDate(issue.dateCreated))}</td>
                    <td style="font-size:12px;">${esc(fmtDate(issue.dateResolved))}</td>
                    <td>
                      <div class="row-actions">
                        <button class="btn small" data-action="open-unit" data-id="${esc(unit.id)}" data-subtab="issues">Open</button>
                      </div>
                    </td>
                  </tr>`).join('')}
              </tbody>
            </table>`}
      </div>
    `;
  }

  /* ------------------------------------------------------------------ */
  /* Parts inbound                                                       */
  /* ------------------------------------------------------------------ */

  function unitOptions(selectedId) {
    return Store.get().units.map(u =>
      `<option value="${esc(u.id)}" ${u.id === selectedId ? 'selected' : ''}>${esc(u.name)} (${esc(u.category)})</option>`
    ).join('');
  }

  function renderPartsIn() {
    const s = Store.get();
    const statuses = ['Pending', 'Shipped', 'In Transit', 'Delivered', 'Installed'];
    return `
      <div class="panel">
        <h2>Replacement Parts Sent TO Site
          <span class="pill">tracking numbers, ETAs</span>
          <div class="panel-actions">
            <button class="btn primary" data-action="new-part-in">+ Log Inbound Part</button>
          </div>
        </h2>
        ${s.partsIn.length === 0
          ? `<div class="empty">Nothing inbound. Use "+ Log Inbound Part" when you ship a replacement to the field.</div>`
          : `<table class="tbl">
              <thead>
                <tr>
                  <th>For Unit</th>
                  <th>Part #</th>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Carrier</th>
                  <th>Tracking #</th>
                  <th>Shipped</th>
                  <th>ETA</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${s.partsIn.map(p => {
                  const u = s.units.find(x => x.id === p.unitId);
                  return `
                  <tr data-pin-id="${esc(p.id)}">
                    <td>${u ? `<a href="#" data-action="open-unit" data-id="${esc(u.id)}" style="color:var(--accent-2); text-decoration:none;">${esc(u.name)}</a>` : '<span style="color:var(--text-dim);">—</span>'}</td>
                    <td>${esc(p.partNumber)}</td>
                    <td>${esc(p.description)}</td>
                    <td>${esc(p.qty)}</td>
                    <td>${esc(p.carrier)}</td>
                    <td>${esc(p.trackingNumber)}</td>
                    <td style="font-size:12px;">${esc(fmtDate(p.shippedDate))}</td>
                    <td style="font-size:12px;">${esc(fmtDate(p.eta))}</td>
                    <td>
                      <select class="part-in-status" data-id="${esc(p.id)}">
                        ${statuses.map(st => `<option ${st === p.status ? 'selected' : ''}>${st}</option>`).join('')}
                      </select>
                    </td>
                    <td>
                      <div class="row-actions">
                        <button class="btn small" data-action="edit-part-in" data-id="${esc(p.id)}">Edit</button>
                        <button class="btn small danger" data-action="delete-part-in" data-id="${esc(p.id)}">Del</button>
                      </div>
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>`}
      </div>
    `;
  }

  /* ------------------------------------------------------------------ */
  /* Parts outbound / RMA                                                */
  /* ------------------------------------------------------------------ */

  function renderPartsOut() {
    const s = Store.get();
    const statuses = ['Pending Pickup', 'Shipped', 'In Transit', 'Received at IEM', 'Closed'];
    return `
      <div class="panel">
        <h2>RMA Parts Coming FROM Site
          <span class="pill">defective / removed, returning to IEM</span>
          <div class="panel-actions">
            <button class="btn primary" data-action="new-part-out">+ Log RMA / Outbound</button>
          </div>
        </h2>
        ${s.partsOut.length === 0
          ? `<div class="empty">No RMA records yet.</div>`
          : `<table class="tbl">
              <thead>
                <tr>
                  <th>From Unit</th>
                  <th>RMA #</th>
                  <th>Part #</th>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Carrier</th>
                  <th>Tracking #</th>
                  <th>Shipped</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${s.partsOut.map(p => {
                  const u = s.units.find(x => x.id === p.unitId);
                  return `
                  <tr data-pout-id="${esc(p.id)}">
                    <td>${u ? `<a href="#" data-action="open-unit" data-id="${esc(u.id)}" style="color:var(--accent-2); text-decoration:none;">${esc(u.name)}</a>` : '<span style="color:var(--text-dim);">—</span>'}</td>
                    <td>${esc(p.rmaNumber)}</td>
                    <td>${esc(p.partNumber)}</td>
                    <td>${esc(p.description)}</td>
                    <td>${esc(p.qty)}</td>
                    <td>${esc(p.carrier)}</td>
                    <td>${esc(p.trackingNumber)}</td>
                    <td style="font-size:12px;">${esc(fmtDate(p.shippedDate))}</td>
                    <td>
                      <select class="part-out-status" data-id="${esc(p.id)}">
                        ${statuses.map(st => `<option ${st === p.status ? 'selected' : ''}>${st}</option>`).join('')}
                      </select>
                    </td>
                    <td>
                      <div class="row-actions">
                        <button class="btn small" data-action="edit-part-out" data-id="${esc(p.id)}">Edit</button>
                        <button class="btn small danger" data-action="delete-part-out" data-id="${esc(p.id)}">Del</button>
                      </div>
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>`}
      </div>
    `;
  }

  /* ------------------------------------------------------------------ */
  /* Sequence template editor (modular - add/edit/delete sections+steps) */
  /* ------------------------------------------------------------------ */

  function renderTemplates(category) {
    const s = Store.get();
    const list = s.sequences[category] || [];
    return `
      <div class="panel">
        <h2>${esc(category)} Sequence Template
          <span class="pill">applied to every ${esc(category)} unit</span>
          <div class="panel-actions">
            <button class="btn" data-action="add-section" data-cat="${esc(category)}">+ Add Section</button>
            <button class="btn ghost" data-action="reset-sequences" title="Reset all categories to defaults from sequences.js">Reset to defaults</button>
          </div>
        </h2>
        <p style="font-size:12px; color:var(--text-dim); margin-top:-4px;">
          Edit the master checklist for ${esc(category)} work. Changes apply to existing and new units in this category.
          To add a brand-new category (e.g. a new product line), use Settings → Add Category, then it shows up as its own tab.
        </p>
        ${list.length === 0
          ? `<div class="empty">No sections yet. Add one to start the template.</div>`
          : list.map(sec => templateSectionHTML(category, sec)).join('')}
      </div>
    `;
  }

  function templateSectionHTML(category, sec) {
    return `
      <div class="seq-section open" data-section="${esc(sec.id)}">
        <div class="seq-head">
          <span class="caret"></span>
          <h3>${esc(sec.name)}</h3>
          <span class="seq-progress">${sec.steps.length} step${sec.steps.length === 1 ? '' : 's'}</span>
          <div style="display:flex; gap:6px;">
            <button class="btn small" data-action="rename-section" data-cat="${esc(category)}" data-id="${esc(sec.id)}">Rename</button>
            <button class="btn small danger" data-action="delete-section" data-cat="${esc(category)}" data-id="${esc(sec.id)}">Delete</button>
          </div>
        </div>
        <div class="seq-body">
          ${sec.steps.map(st => `
            <div class="step">
              <div class="step-body">
                <div class="step-text">
                  ${esc(st.text)}
                  ${st.required ? '<span class="req-tag">required</span>' : ''}
                </div>
                ${st.detail ? `<div class="step-detail">${esc(st.detail)}</div>` : ''}
              </div>
              <div class="row-actions">
                <button class="btn small" data-action="edit-step" data-cat="${esc(category)}" data-sec="${esc(sec.id)}" data-id="${esc(st.id)}">Edit</button>
                <button class="btn small danger" data-action="delete-step" data-cat="${esc(category)}" data-sec="${esc(sec.id)}" data-id="${esc(st.id)}">Del</button>
              </div>
            </div>
          `).join('')}
          <div style="padding-top:10px;">
            <button class="btn small" data-action="add-step" data-cat="${esc(category)}" data-sec="${esc(sec.id)}">+ Add Step</button>
          </div>
        </div>
      </div>
    `;
  }

  /* ------------------------------------------------------------------ */
  /* Settings                                                            */
  /* ------------------------------------------------------------------ */

  function renderSettings() {
    const s = Store.get();
    return `
      <div class="panel">
        <h2>Site / Project</h2>
        <div class="form-row">
          <label class="field">Site name
            <input id="meta-site" value="${esc(s.meta.siteName)}" placeholder="e.g. IEM West - Bay 4">
          </label>
          <label class="field">Active project
            <input id="meta-project" value="${esc(s.meta.projectName)}" placeholder="e.g. Q3 Data Center Build">
          </label>
        </div>
        <div class="form-actions">
          <button class="btn primary" data-action="save-meta">Save</button>
        </div>
      </div>

      <div class="panel">
        <h2>Sequence Categories
          <span class="pill">add new product lines here</span>
        </h2>
        <p style="font-size:12px; color:var(--text-dim);">
          Each category becomes a tab and a selectable type when creating units. Built-ins: L3, L4, Warranty.
        </p>
        <div class="form-row">
          <label class="field">New category name
            <input id="new-cat" placeholder="e.g. MV Switchgear">
          </label>
        </div>
        <div class="form-actions">
          <button class="btn primary" data-action="add-category">Add Category</button>
        </div>
        <table class="tbl" style="margin-top:14px;">
          <thead><tr><th>Category</th><th>Sections</th><th>Total Steps</th></tr></thead>
          <tbody>
            ${Object.entries(s.sequences).map(([cat, list]) => `
              <tr>
                <td>${esc(cat)}</td>
                <td>${list.length}</td>
                <td>${list.reduce((n, sec) => n + sec.steps.length, 0)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>

      <div class="panel">
        <h2>Backup / Restore</h2>
        <p style="font-size:12px; color:var(--text-dim);">
          Data lives in this browser's localStorage. Export a JSON backup any time, or import one to move data
          between machines or recover a previous state.
        </p>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn primary" data-action="export">Download JSON Backup</button>
          <button class="btn" data-action="import-pick">Import JSON…</button>
          <input type="file" id="import-file" accept="application/json,.json" style="display:none;">
          <button class="btn danger" data-action="reset-all">Reset Everything</button>
        </div>
        <p style="font-size:11px; color:var(--text-dim); margin-top:10px;">
          Last saved: ${esc(fmtDate(s.meta.lastSaved)) || 'never'}
        </p>
      </div>
    `;
  }

  /* ------------------------------------------------------------------ */
  /* Unit detail modal                                                   */
  /* ------------------------------------------------------------------ */

  let modalUnitId = null;
  let modalSubTab = 'overview';

  function openUnit(id, subTab) {
    modalUnitId = id;
    modalSubTab = subTab || 'overview';
    renderModal();
    $('#modal-backdrop').classList.add('show');
  }

  function closeModal() {
    $('#modal-backdrop').classList.remove('show');
    modalUnitId = null;
  }

  function renderModal() {
    const s = Store.get();
    const u = s.units.find(x => x.id === modalUnitId);
    if (!u) { closeModal(); return; }
    const cats = Object.keys(s.sequences);
    const p = unitProgress(u);

    const body = `
      <div class="modal">
        <h2>
          ${esc(u.name)}
          <span class="pill ${pillClass('', u.kind.toLowerCase())}">${esc(u.kind)}</span>
          <span class="pill ${pillClass('', u.category.toLowerCase())}">${esc(u.category)}</span>
          <span class="pill ${pillClass('status', u.status)}">${esc(u.status)}</span>
          <button class="modal-close" data-action="close-modal" aria-label="Close">×</button>
        </h2>

        <div class="sub-tabs" id="modal-subtabs">
          <button data-sub="overview" class="${modalSubTab === 'overview' ? 'active' : ''}">Overview</button>
          <button data-sub="sequence" class="${modalSubTab === 'sequence' ? 'active' : ''}">Sequence (${p.done}/${p.total})</button>
          <button data-sub="issues"   class="${modalSubTab === 'issues'   ? 'active' : ''}">Issues (${u.issues.length})</button>
          <button data-sub="missing"  class="${modalSubTab === 'missing'  ? 'active' : ''}">Missing Parts (${u.missingParts.length})</button>
          <button data-sub="parts"    class="${modalSubTab === 'parts'    ? 'active' : ''}">Parts In/Out</button>
        </div>

        <div id="modal-body">${modalBodyHTML(u, cats)}</div>
      </div>
    `;
    $('#modal-backdrop').innerHTML = body;
  }

  function modalBodyHTML(u, cats) {
    if (modalSubTab === 'overview')  return overviewHTML(u, cats);
    if (modalSubTab === 'sequence')  return sequenceHTML(u);
    if (modalSubTab === 'issues')    return issuesHTML(u);
    if (modalSubTab === 'missing')   return missingHTML(u);
    if (modalSubTab === 'parts')     return unitPartsHTML(u);
    return '';
  }

  function overviewHTML(u, cats) {
    const statuses = ['In Progress', 'On Hold', 'Blocked', 'Complete'];
    return `
      <div class="form-row">
        <label class="field">Unit name
          <input data-edit="name" value="${esc(u.name)}">
        </label>
        <label class="field">Type
          <select data-edit="kind">
            <option ${u.kind === 'SKID' ? 'selected' : ''}>SKID</option>
            <option ${u.kind === 'POD'  ? 'selected' : ''}>POD</option>
          </select>
        </label>
        <label class="field">Category
          <select data-edit="category">
            ${cats.map(c => `<option ${c === u.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}
          </select>
        </label>
        <label class="field">Status
          <select data-edit="status">
            ${statuses.map(c => `<option ${c === u.status ? 'selected' : ''}>${esc(c)}</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="form-row">
        <label class="field">Job number
          <input data-edit="jobNumber" value="${esc(u.jobNumber)}">
        </label>
        <label class="field">Project
          <input data-edit="project" value="${esc(u.project)}">
        </label>
        <label class="field">Customer
          <input data-edit="customer" value="${esc(u.customer)}">
        </label>
        <label class="field">Site / location
          <input data-edit="site" value="${esc(u.site)}">
        </label>
      </div>
      <label class="field">Notes
        <textarea data-edit="notes">${esc(u.notes)}</textarea>
      </label>
      <div class="form-actions">
        <button class="btn danger" data-action="delete-unit">Delete Unit</button>
        <button class="btn primary" data-action="save-unit">Save Changes</button>
      </div>
      <p style="font-size:11px; color:var(--text-dim);">
        Created ${esc(fmtDate(u.dateCreated))} · Updated ${esc(fmtDate(u.dateUpdated))}
      </p>
    `;
  }

  function sequenceHTML(u) {
    const seqs = Store.get().sequences[u.category] || [];
    if (seqs.length === 0) {
      return `<div class="empty">
        No template sections defined for category "${esc(u.category)}". Add some in the ${esc(u.category)} Sequences tab.
      </div>`;
    }
    return seqs.map(sec => {
      const sp = sectionProgress(u, sec);
      return `
        <div class="seq-section open" data-section="${esc(sec.id)}">
          <div class="seq-head" data-action="toggle-section">
            <span class="caret"></span>
            <h3>${esc(sec.name)}</h3>
            <span class="seq-progress">${sp.done}/${sp.total}</span>
            <div class="seq-bar"><span style="width:${sp.pct}%"></span></div>
          </div>
          <div class="seq-body">
            ${sec.steps.length === 0
              ? `<div class="empty">No steps in this section yet. Add steps in the ${esc(u.category)} Sequences template.</div>`
              : sec.steps.map(st => stepRowHTML(u, sec, st)).join('')}
          </div>
        </div>`;
    }).join('');
  }

  function stepRowHTML(u, sec, st) {
    const p = (u.progress[sec.id] || {})[st.id] || {};
    const checked = p.done ? 'checked' : '';
    const noteVal = p.note || '';
    const byVal   = p.by || '';
    return `
      <div class="step" data-step="${esc(st.id)}" data-sec="${esc(sec.id)}">
        <input type="checkbox" class="step-check" ${checked}>
        <div class="step-body">
          <div class="step-text ${p.done ? 'done' : ''}">
            ${esc(st.text)}
            ${st.required ? '<span class="req-tag">required</span>' : ''}
          </div>
          ${st.detail ? `<div class="step-detail">${esc(st.detail)}</div>` : ''}
          <div class="step-meta">
            ${p.done && p.at ? `Completed ${esc(fmtDate(p.at))} ${p.by ? 'by ' + esc(p.by) : ''}` : '<span style="opacity:0.6;">Not done</span>'}
          </div>
          <div class="form-row" style="margin-top:6px;">
            <label class="field" style="margin-bottom:0;">Signed off by
              <input class="step-by" value="${esc(byVal)}" placeholder="Initials / name">
            </label>
            <label class="field" style="margin-bottom:0;">Note
              <input class="step-note" value="${esc(noteVal)}" placeholder="Optional note">
            </label>
          </div>
        </div>
      </div>
    `;
  }

  function issuesHTML(u) {
    const severities = ['Low', 'Medium', 'High', 'Critical'];
    const statuses = ['Open', 'Troubleshooting', 'Resolved'];
    return `
      <div class="panel" style="background:var(--bg-elev-2); margin-bottom:14px;">
        <h2 style="font-size:13px;">Log a new issue</h2>
        <div class="form-row">
          <label class="field">Title
            <input id="new-iss-title" placeholder="Short summary">
          </label>
          <label class="field">Severity
            <select id="new-iss-sev">${severities.map(x => `<option>${x}</option>`).join('')}</select>
          </label>
          <label class="field">Status
            <select id="new-iss-status">${statuses.map(x => `<option>${x}</option>`).join('')}</select>
          </label>
        </div>
        <label class="field">Description
          <textarea id="new-iss-desc" placeholder="What went wrong, what was tried, where to look next…"></textarea>
        </label>
        <div class="form-actions">
          <button class="btn primary" data-action="add-issue">+ Add Issue</button>
        </div>
      </div>

      ${u.issues.length === 0
        ? `<div class="empty">No issues yet for this unit.</div>`
        : u.issues.map(i => `
          <div class="panel" style="background:var(--bg-elev-2);" data-iss="${esc(i.id)}">
            <h2 style="font-size:13px;">
              ${esc(i.title)}
              <span class="pill ${pillClass('sev', i.severity)}">${esc(i.severity)}</span>
              <span class="pill ${pillClass('iss', i.status === 'Troubleshooting' ? 'trouble' : i.status.toLowerCase())}">${esc(i.status)}</span>
              <div class="panel-actions">
                <button class="btn small danger" data-action="delete-issue" data-id="${esc(i.id)}">Delete</button>
              </div>
            </h2>
            <label class="field">Description / troubleshooting log
              <textarea class="iss-desc" data-id="${esc(i.id)}">${esc(i.description)}</textarea>
            </label>
            <label class="field">Resolution (fill when resolved)
              <textarea class="iss-res" data-id="${esc(i.id)}">${esc(i.resolution)}</textarea>
            </label>
            <div class="form-row">
              <label class="field">Severity
                <select class="iss-sev" data-id="${esc(i.id)}">
                  ${severities.map(x => `<option ${x === i.severity ? 'selected' : ''}>${x}</option>`).join('')}
                </select>
              </label>
              <label class="field">Status
                <select class="iss-status" data-id="${esc(i.id)}">
                  ${statuses.map(x => `<option ${x === i.status ? 'selected' : ''}>${x}</option>`).join('')}
                </select>
              </label>
            </div>
            <div class="form-actions">
              <button class="btn primary" data-action="save-issue" data-id="${esc(i.id)}">Save</button>
            </div>
            <p style="font-size:11px; color:var(--text-dim);">
              Logged ${esc(fmtDate(i.dateCreated))}${i.dateResolved ? ' · Resolved ' + esc(fmtDate(i.dateResolved)) : ''}
            </p>
          </div>
        `).join('')}
    `;
  }

  function missingHTML(u) {
    const statuses = ['Needed', 'Ordered', 'Received'];
    return `
      <div class="panel" style="background:var(--bg-elev-2); margin-bottom:14px;">
        <h2 style="font-size:13px;">Add missing part</h2>
        <div class="form-row">
          <label class="field">Part #
            <input id="new-miss-pn">
          </label>
          <label class="field">Description
            <input id="new-miss-desc">
          </label>
          <label class="field">Qty
            <input id="new-miss-qty" type="number" min="1" value="1">
          </label>
          <label class="field">Needed by
            <input id="new-miss-by" type="date">
          </label>
          <label class="field">Status
            <select id="new-miss-status">${statuses.map(x => `<option>${x}</option>`).join('')}</select>
          </label>
        </div>
        <label class="field">Notes
          <textarea id="new-miss-notes" placeholder="Source, vendor, urgency, etc."></textarea>
        </label>
        <div class="form-actions">
          <button class="btn primary" data-action="add-missing">+ Add Missing Part</button>
        </div>
      </div>

      ${u.missingParts.length === 0
        ? `<div class="empty">No missing parts logged for this unit.</div>`
        : `<table class="tbl">
            <thead><tr><th>Part #</th><th>Description</th><th>Qty</th><th>Needed By</th><th>Status</th><th>Notes</th><th></th></tr></thead>
            <tbody>
              ${u.missingParts.map(p => `
                <tr data-miss="${esc(p.id)}">
                  <td><input class="miss-pn"   data-id="${esc(p.id)}" value="${esc(p.partNumber)}"></td>
                  <td><input class="miss-desc" data-id="${esc(p.id)}" value="${esc(p.description)}"></td>
                  <td><input class="miss-qty"  data-id="${esc(p.id)}" type="number" min="1" value="${esc(p.qty)}" style="width:60px;"></td>
                  <td><input class="miss-by"   data-id="${esc(p.id)}" type="date" value="${esc(p.neededBy)}"></td>
                  <td>
                    <select class="miss-status" data-id="${esc(p.id)}">
                      ${statuses.map(x => `<option ${x === p.status ? 'selected' : ''}>${x}</option>`).join('')}
                    </select>
                  </td>
                  <td><input class="miss-notes" data-id="${esc(p.id)}" value="${esc(p.notes)}"></td>
                  <td>
                    <div class="row-actions">
                      <button class="btn small" data-action="save-missing" data-id="${esc(p.id)}">Save</button>
                      <button class="btn small danger" data-action="delete-missing" data-id="${esc(p.id)}">Del</button>
                    </div>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>`}
    `;
  }

  function unitPartsHTML(u) {
    const s = Store.get();
    const inbound = s.partsIn.filter(p => p.unitId === u.id);
    const outbound = s.partsOut.filter(p => p.unitId === u.id);

    return `
      <div class="panel" style="background:var(--bg-elev-2);">
        <h2 style="font-size:13px;">Parts being sent TO site for this unit
          <div class="panel-actions">
            <button class="btn small primary" data-action="new-part-in" data-unit="${esc(u.id)}">+ Inbound</button>
          </div>
        </h2>
        ${inbound.length === 0
          ? `<div class="empty">None.</div>`
          : `<table class="tbl">
              <thead><tr><th>Part #</th><th>Description</th><th>Qty</th><th>Carrier</th><th>Tracking</th><th>Status</th></tr></thead>
              <tbody>${inbound.map(p => `
                <tr><td>${esc(p.partNumber)}</td><td>${esc(p.description)}</td><td>${esc(p.qty)}</td>
                <td>${esc(p.carrier)}</td><td>${esc(p.trackingNumber)}</td>
                <td><span class="pill ${pillClass('part', p.status.toLowerCase().split(' ')[0])}">${esc(p.status)}</span></td></tr>`).join('')}
              </tbody>
            </table>`}
      </div>
      <div class="panel" style="background:var(--bg-elev-2);">
        <h2 style="font-size:13px;">RMA parts being sent FROM site for this unit
          <div class="panel-actions">
            <button class="btn small primary" data-action="new-part-out" data-unit="${esc(u.id)}">+ Outbound</button>
          </div>
        </h2>
        ${outbound.length === 0
          ? `<div class="empty">None.</div>`
          : `<table class="tbl">
              <thead><tr><th>RMA #</th><th>Part #</th><th>Description</th><th>Qty</th><th>Carrier</th><th>Tracking</th><th>Status</th></tr></thead>
              <tbody>${outbound.map(p => `
                <tr><td>${esc(p.rmaNumber)}</td><td>${esc(p.partNumber)}</td><td>${esc(p.description)}</td><td>${esc(p.qty)}</td>
                <td>${esc(p.carrier)}</td><td>${esc(p.trackingNumber)}</td>
                <td><span class="pill ${pillClass('part', p.status.toLowerCase().split(' ')[0])}">${esc(p.status)}</span></td></tr>`).join('')}
              </tbody>
            </table>`}
      </div>
    `;
  }

  /* ------------------------------------------------------------------ */
  /* Small "create new unit" dialog (reuses modal area)                  */
  /* ------------------------------------------------------------------ */

  function openNewUnitForm() {
    const cats = Object.keys(Store.get().sequences);
    const html = `
      <div class="modal">
        <h2>New Unit
          <button class="modal-close" data-action="close-modal">×</button>
        </h2>
        <div class="form-row">
          <label class="field">Name<input id="nu-name" placeholder="e.g. SKID-104 / POD-A2"></label>
          <label class="field">Type
            <select id="nu-kind"><option>SKID</option><option>POD</option></select>
          </label>
          <label class="field">Category
            <select id="nu-cat">${cats.map(c => `<option>${esc(c)}</option>`).join('')}</select>
          </label>
        </div>
        <div class="form-row">
          <label class="field">Job #<input id="nu-job"></label>
          <label class="field">Project<input id="nu-proj"></label>
          <label class="field">Customer<input id="nu-cust"></label>
          <label class="field">Site<input id="nu-site"></label>
        </div>
        <label class="field">Notes<textarea id="nu-notes"></textarea></label>
        <div class="form-actions">
          <button class="btn" data-action="close-modal">Cancel</button>
          <button class="btn primary" data-action="save-new-unit">Create</button>
        </div>
      </div>
    `;
    $('#modal-backdrop').innerHTML = html;
    $('#modal-backdrop').classList.add('show');
  }

  function openPartInForm(existingId, unitIdHint) {
    const s = Store.get();
    const p = existingId ? s.partsIn.find(x => x.id === existingId) : null;
    const statuses = ['Pending', 'Shipped', 'In Transit', 'Delivered', 'Installed'];
    const html = `
      <div class="modal">
        <h2>${p ? 'Edit Inbound Part' : 'New Inbound Part'}
          <button class="modal-close" data-action="close-modal">×</button>
        </h2>
        <div class="form-row">
          <label class="field">For unit
            <select id="pi-unit"><option value="">(unassigned)</option>${unitOptions(p ? p.unitId : unitIdHint)}</select>
          </label>
          <label class="field">Part #<input id="pi-pn" value="${esc(p ? p.partNumber : '')}"></label>
          <label class="field">Qty<input id="pi-qty" type="number" min="1" value="${esc(p ? p.qty : 1)}"></label>
        </div>
        <label class="field">Description<input id="pi-desc" value="${esc(p ? p.description : '')}"></label>
        <div class="form-row">
          <label class="field">Carrier<input id="pi-carrier" value="${esc(p ? p.carrier : '')}" placeholder="UPS, FedEx, freight…"></label>
          <label class="field">Tracking #<input id="pi-track" value="${esc(p ? p.trackingNumber : '')}"></label>
          <label class="field">Shipped<input id="pi-ship" type="date" value="${esc(p ? p.shippedDate : '')}"></label>
          <label class="field">ETA<input id="pi-eta" type="date" value="${esc(p ? p.eta : '')}"></label>
          <label class="field">Status
            <select id="pi-status">${statuses.map(x => `<option ${p && p.status === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
          </label>
        </div>
        <label class="field">Notes<textarea id="pi-notes">${esc(p ? p.notes : '')}</textarea></label>
        <div class="form-actions">
          <button class="btn" data-action="close-modal">Cancel</button>
          <button class="btn primary" data-action="save-part-in" data-id="${esc(existingId || '')}">Save</button>
        </div>
      </div>
    `;
    $('#modal-backdrop').innerHTML = html;
    $('#modal-backdrop').classList.add('show');
  }

  function openPartOutForm(existingId, unitIdHint) {
    const s = Store.get();
    const p = existingId ? s.partsOut.find(x => x.id === existingId) : null;
    const statuses = ['Pending Pickup', 'Shipped', 'In Transit', 'Received at IEM', 'Closed'];
    const html = `
      <div class="modal">
        <h2>${p ? 'Edit RMA / Outbound' : 'New RMA / Outbound'}
          <button class="modal-close" data-action="close-modal">×</button>
        </h2>
        <div class="form-row">
          <label class="field">From unit
            <select id="po-unit"><option value="">(unassigned)</option>${unitOptions(p ? p.unitId : unitIdHint)}</select>
          </label>
          <label class="field">RMA #<input id="po-rma" value="${esc(p ? p.rmaNumber : '')}"></label>
          <label class="field">Part #<input id="po-pn" value="${esc(p ? p.partNumber : '')}"></label>
          <label class="field">Qty<input id="po-qty" type="number" min="1" value="${esc(p ? p.qty : 1)}"></label>
        </div>
        <label class="field">Description<input id="po-desc" value="${esc(p ? p.description : '')}"></label>
        <label class="field">Reason / failure mode<input id="po-reason" value="${esc(p ? p.reason : '')}"></label>
        <div class="form-row">
          <label class="field">Carrier<input id="po-carrier" value="${esc(p ? p.carrier : '')}"></label>
          <label class="field">Tracking #<input id="po-track" value="${esc(p ? p.trackingNumber : '')}"></label>
          <label class="field">Shipped<input id="po-ship" type="date" value="${esc(p ? p.shippedDate : '')}"></label>
          <label class="field">Status
            <select id="po-status">${statuses.map(x => `<option ${p && p.status === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
          </label>
        </div>
        <label class="field">Notes<textarea id="po-notes">${esc(p ? p.notes : '')}</textarea></label>
        <div class="form-actions">
          <button class="btn" data-action="close-modal">Cancel</button>
          <button class="btn primary" data-action="save-part-out" data-id="${esc(existingId || '')}">Save</button>
        </div>
      </div>
    `;
    $('#modal-backdrop').innerHTML = html;
    $('#modal-backdrop').classList.add('show');
  }

  /* ------------------------------------------------------------------ */
  /* Event delegation                                                    */
  /* ------------------------------------------------------------------ */

  function bindEvents() {
    // Tab clicks
    $('#tabs').addEventListener('click', e => {
      const btn = e.target.closest('button[data-tab]');
      if (btn) setTab(btn.dataset.tab);
    });

    // Filters on units list
    document.addEventListener('input', e => {
      if (e.target.id === 'units-search') { unitsFilter.search = e.target.value; renderActive(); requestAnimationFrame(() => { const el = $('#units-search'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }); }
    });
    document.addEventListener('change', e => {
      if (e.target.id === 'units-cat')    { unitsFilter.category = e.target.value; renderActive(); }
      if (e.target.id === 'units-status') { unitsFilter.status   = e.target.value; renderActive(); }

      if (e.target.classList && e.target.classList.contains('part-in-status')) {
        Store.updatePartIn(e.target.dataset.id, { status: e.target.value });
        toast('Updated');
      }
      if (e.target.classList && e.target.classList.contains('part-out-status')) {
        Store.updatePartOut(e.target.dataset.id, { status: e.target.value });
        toast('Updated');
      }
    });

    // Master click delegate (entire app body + modal)
    document.addEventListener('click', e => {
      // Sub-tab buttons (in the unit modal) - handled before the data-action gate.
      const subBtn = e.target.closest('button[data-sub]');
      if (subBtn) {
        modalSubTab = subBtn.dataset.sub;
        renderModal();
        return;
      }

      const target = e.target.closest('[data-action]');
      if (!target) {
        // Toggle sequence section open/closed in unit modal
        const head = e.target.closest('.seq-section .seq-head');
        if (head && !e.target.closest('button')) head.parentElement.classList.toggle('open');
        return;
      }
      const action = target.dataset.action;
      const id = target.dataset.id;
      e.preventDefault();

      switch (action) {
        case 'new-unit':       openNewUnitForm(); break;
        case 'save-new-unit':  saveNewUnit(); break;
        case 'open-unit':      openUnit(id, target.dataset.subtab); break;
        case 'close-modal':    closeModal(); break;
        case 'save-unit':      saveModalUnit(); break;
        case 'delete-unit':    confirmDeleteUnit(); break;

        case 'add-issue':      addIssueFromForm(); break;
        case 'save-issue':     saveIssue(id); break;
        case 'delete-issue':   if (confirm('Delete this issue?')) { Store.deleteIssue(modalUnitId, id); renderModal(); toast('Issue deleted'); } break;

        case 'add-missing':    addMissingFromForm(); break;
        case 'save-missing':   saveMissing(id); break;
        case 'delete-missing': if (confirm('Delete this missing part?')) { Store.deleteMissingPart(modalUnitId, id); renderModal(); toast('Removed'); } break;

        case 'new-part-in':    openPartInForm(null, target.dataset.unit || ''); break;
        case 'edit-part-in':   openPartInForm(id); break;
        case 'save-part-in':   savePartIn(id); break;
        case 'delete-part-in': if (confirm('Delete this inbound part record?')) { Store.deletePartIn(id); renderActive(); toast('Deleted'); } break;

        case 'new-part-out':    openPartOutForm(null, target.dataset.unit || ''); break;
        case 'edit-part-out':   openPartOutForm(id); break;
        case 'save-part-out':   savePartOut(id); break;
        case 'delete-part-out': if (confirm('Delete this RMA record?')) { Store.deletePartOut(id); renderActive(); toast('Deleted'); } break;

        case 'add-section':    addSection(target.dataset.cat); break;
        case 'rename-section': renameSection(target.dataset.cat, id); break;
        case 'delete-section': if (confirm('Delete this section and all its steps?')) { Store.deleteSequenceSection(target.dataset.cat, id); renderActive(); toast('Section deleted'); } break;

        case 'add-step':       addStep(target.dataset.cat, target.dataset.sec); break;
        case 'edit-step':      editStep(target.dataset.cat, target.dataset.sec, id); break;
        case 'delete-step':    if (confirm('Delete this step?')) { Store.deleteSequenceStep(target.dataset.cat, target.dataset.sec, id); renderActive(); toast('Step deleted'); } break;

        case 'reset-sequences':if (confirm('Reset ALL sequence templates to the defaults defined in sequences.js? Unit progress is kept.')) { Store.resetSequencesToDefault(); renderActive(); toast('Sequences reset'); } break;

        case 'save-meta':      saveMeta(); break;
        case 'add-category':   addCategoryFromForm(); break;
        case 'export':         doExport(); break;
        case 'import-pick':    $('#import-file').click(); break;
        case 'reset-all':      if (confirm('Erase EVERYTHING (units, parts, sequences, settings)? This cannot be undone.')) { Store.resetAll(); renderTabs(); renderActive(); toast('All data cleared'); } break;
      }

    });

    // Backdrop click closes modal
    $('#modal-backdrop').addEventListener('click', e => {
      if (e.target.id === 'modal-backdrop') closeModal();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeModal();
    });

    // Sub-tab buttons (data-sub) - handled in main click delegate above.

    // Import file input
    document.addEventListener('change', e => {
      if (e.target.id === 'import-file' && e.target.files.length) {
        const f = e.target.files[0];
        const reader = new FileReader();
        reader.onload = () => {
          try {
            Store.importJSON(reader.result);
            toast('Import complete');
            renderTabs();
            renderActive();
          } catch (err) {
            alert('Could not import: ' + err.message);
          }
        };
        reader.readAsText(f);
      }
    });
  }

  /* ---------- Form save helpers ---------- */

  function saveNewUnit() {
    Store.addUnit({
      name:      $('#nu-name').value.trim() || 'New Unit',
      kind:      $('#nu-kind').value,
      category:  $('#nu-cat').value,
      jobNumber: $('#nu-job').value.trim(),
      project:   $('#nu-proj').value.trim(),
      customer:  $('#nu-cust').value.trim(),
      site:      $('#nu-site').value.trim(),
      notes:     $('#nu-notes').value.trim()
    });
    closeModal();
    renderTabs();
    renderActive();
    toast('Unit created');
  }

  function saveModalUnit() {
    const patch = {};
    $$('[data-edit]', $('#modal-backdrop')).forEach(el => { patch[el.dataset.edit] = el.value; });
    Store.updateUnit(modalUnitId, patch);
    renderTabs();
    renderModal();
    renderActive();
    toast('Saved');
  }

  function confirmDeleteUnit() {
    if (!confirm('Delete this unit and all of its issues, missing parts, and parts records?')) return;
    Store.deleteUnit(modalUnitId);
    closeModal();
    renderTabs();
    renderActive();
    toast('Unit deleted');
  }

  function addIssueFromForm() {
    Store.addIssue(modalUnitId, {
      title:       $('#new-iss-title').value.trim(),
      severity:    $('#new-iss-sev').value,
      status:      $('#new-iss-status').value,
      description: $('#new-iss-desc').value.trim()
    });
    renderModal();
    renderTabs();
    toast('Issue added');
  }

  function saveIssue(issueId) {
    const root = $('#modal-backdrop');
    const desc   = $(`.iss-desc[data-id="${issueId}"]`, root).value;
    const res    = $(`.iss-res[data-id="${issueId}"]`, root).value;
    const sev    = $(`.iss-sev[data-id="${issueId}"]`, root).value;
    const status = $(`.iss-status[data-id="${issueId}"]`, root).value;
    Store.updateIssue(modalUnitId, issueId, { description: desc, resolution: res, severity: sev, status });
    renderModal();
    renderTabs();
    toast('Issue saved');
  }

  function addMissingFromForm() {
    Store.addMissingPart(modalUnitId, {
      partNumber:  $('#new-miss-pn').value.trim(),
      description: $('#new-miss-desc').value.trim(),
      qty:         $('#new-miss-qty').value,
      neededBy:    $('#new-miss-by').value,
      status:      $('#new-miss-status').value,
      notes:       $('#new-miss-notes').value.trim()
    });
    renderModal();
    toast('Part added');
  }

  function saveMissing(partId) {
    const root = $('#modal-backdrop');
    Store.updateMissingPart(modalUnitId, partId, {
      partNumber:  $(`.miss-pn[data-id="${partId}"]`, root).value,
      description: $(`.miss-desc[data-id="${partId}"]`, root).value,
      qty:         $(`.miss-qty[data-id="${partId}"]`, root).value,
      neededBy:    $(`.miss-by[data-id="${partId}"]`, root).value,
      status:      $(`.miss-status[data-id="${partId}"]`, root).value,
      notes:       $(`.miss-notes[data-id="${partId}"]`, root).value
    });
    toast('Saved');
  }

  function savePartIn(existingId) {
    const payload = {
      unitId: $('#pi-unit').value,
      partNumber: $('#pi-pn').value.trim(),
      qty: $('#pi-qty').value,
      description: $('#pi-desc').value.trim(),
      carrier: $('#pi-carrier').value.trim(),
      trackingNumber: $('#pi-track').value.trim(),
      shippedDate: $('#pi-ship').value,
      eta: $('#pi-eta').value,
      status: $('#pi-status').value,
      notes: $('#pi-notes').value.trim()
    };
    if (existingId) Store.updatePartIn(existingId, payload);
    else Store.addPartIn(payload);
    closeModal();
    renderTabs();
    renderActive();
    toast('Saved');
  }

  function savePartOut(existingId) {
    const payload = {
      unitId: $('#po-unit').value,
      rmaNumber: $('#po-rma').value.trim(),
      partNumber: $('#po-pn').value.trim(),
      qty: $('#po-qty').value,
      description: $('#po-desc').value.trim(),
      reason: $('#po-reason').value.trim(),
      carrier: $('#po-carrier').value.trim(),
      trackingNumber: $('#po-track').value.trim(),
      shippedDate: $('#po-ship').value,
      status: $('#po-status').value,
      notes: $('#po-notes').value.trim()
    };
    if (existingId) Store.updatePartOut(existingId, payload);
    else Store.addPartOut(payload);
    closeModal();
    renderTabs();
    renderActive();
    toast('Saved');
  }

  function addSection(cat) {
    const name = prompt('Section name?');
    if (!name) return;
    Store.addSequenceSection(cat, name);
    renderActive();
  }

  function renameSection(cat, id) {
    const sec = Store.get().sequences[cat].find(s => s.id === id);
    const name = prompt('Rename section', sec.name);
    if (!name) return;
    Store.renameSequenceSection(cat, id, name);
    renderActive();
  }

  function addStep(cat, secId) {
    const text = prompt('New step text?');
    if (!text) return;
    const req = confirm('Mark as REQUIRED to complete the unit? OK = required, Cancel = optional');
    Store.addSequenceStep(cat, secId, { text, required: req });
    renderActive();
  }

  function editStep(cat, secId, stepId) {
    const sec = Store.get().sequences[cat].find(s => s.id === secId);
    const st = sec.steps.find(x => x.id === stepId);
    const text = prompt('Step text', st.text);
    if (text == null) return;
    const detail = prompt('Help text / detail (optional)', st.detail || '');
    const req = confirm('Mark as REQUIRED? OK = required, Cancel = optional');
    Store.updateSequenceStep(cat, secId, stepId, { text, detail: detail || '', required: req });
    renderActive();
  }

  function saveMeta() {
    Store.get().meta.siteName = $('#meta-site').value;
    Store.get().meta.projectName = $('#meta-project').value;
    Store.save();
    toast('Saved');
  }

  function addCategoryFromForm() {
    const name = $('#new-cat').value.trim();
    if (!name) return;
    Store.addCategory(name);
    renderTabs();
    renderActive();
    toast('Category added');
  }

  function doExport() {
    const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'iem-skids-pods-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('Backup downloaded');
  }

  /* ------------------------------------------------------------------ */
  /* Sequence step interactions (per unit, in the modal)                 */
  /* ------------------------------------------------------------------ */

  document.addEventListener('change', e => {
    const stepRow = e.target.closest('.step[data-step]');
    if (!stepRow || !modalUnitId) return;
    const stepId = stepRow.dataset.step;
    const secId  = stepRow.dataset.sec;
    if (e.target.classList.contains('step-check')) {
      Store.setStep(modalUnitId, secId, stepId, {
        done: e.target.checked,
        at: e.target.checked ? new Date().toISOString() : null,
        by: $('.step-by', stepRow).value || ''
      });
      renderModal();
    }
  });

  document.addEventListener('input', e => {
    const stepRow = e.target.closest('.step[data-step]');
    if (!stepRow || !modalUnitId) return;
    const stepId = stepRow.dataset.step;
    const secId  = stepRow.dataset.sec;
    if (e.target.classList.contains('step-by')) {
      Store.setStep(modalUnitId, secId, stepId, { by: e.target.value });
    } else if (e.target.classList.contains('step-note')) {
      Store.setStep(modalUnitId, secId, stepId, { note: e.target.value });
    }
  });

  /* ------------------------------------------------------------------ */
  /* Boot                                                                */
  /* ------------------------------------------------------------------ */

  document.addEventListener('DOMContentLoaded', () => {
    Store.load();
    bindEvents();
    renderTabs();
    renderActive();
  });
})();
