/*
 * Default sequence templates for IEM Switchboard L3, L4, and Warranty work.
 *
 * To add a new sequence section, push another object into one of the arrays
 * below, or add a new top-level key (e.g. CustomShop) and it will appear as
 * a selectable category in the unit form and as its own tab automatically.
 *
 * Each step:
 *   id     unique within the sequence
 *   text   display label
 *   detail (optional) hover/help text shown under the step
 *   required (optional) if true, unit cannot be marked Complete until done
 */

const DEFAULT_SEQUENCES = {
  L3: [
    {
      id: 'l3-receiving',
      name: 'Receiving & Pre-Build',
      description: 'Material verification and pre-build sign-off for L3 switchboards.',
      steps: [
        { id: 'rx-bom',        text: 'BOM verified against shop order',          required: true },
        { id: 'rx-sections',   text: 'Section count / dimensions verified',      required: true },
        { id: 'rx-finish',     text: 'Paint / finish inspected, no damage',      detail: 'Document any shipping damage with photos.' },
        { id: 'rx-tags',       text: 'Nameplates and serial tags present',       required: true },
        { id: 'rx-drawings',   text: 'Approved drawings on file (rev verified)', required: true }
      ]
    },
    {
      id: 'l3-mechanical',
      name: 'Mechanical Assembly',
      steps: [
        { id: 'mech-align',    text: 'Sections joined and aligned, torque verified',    required: true },
        { id: 'mech-bus',      text: 'Main bus installed, torqued and torque-marked',   required: true },
        { id: 'mech-ground',   text: 'Ground bus installed and bonded',                 required: true },
        { id: 'mech-barriers', text: 'Barriers, shutters, and covers installed' },
        { id: 'mech-devices',  text: 'Breakers / fusible switches mounted and secured', required: true }
      ]
    },
    {
      id: 'l3-electrical',
      name: 'Electrical / Wiring',
      steps: [
        { id: 'elec-control',  text: 'Control wiring per schematic, point-to-point checked', required: true },
        { id: 'elec-meter',    text: 'Metering / CTs / PTs wired and phase verified',         required: true },
        { id: 'elec-comm',     text: 'Communication wiring (Modbus / Ethernet) landed' },
        { id: 'elec-label',    text: 'All wires labeled per drawing',                          required: true },
        { id: 'elec-tighten',  text: 'All terminations torqued and torque-striped',            required: true }
      ]
    },
    {
      id: 'l3-test',
      name: 'Test & QC',
      steps: [
        { id: 'qc-megger',     text: 'Megger / insulation resistance test passed',   required: true },
        { id: 'qc-hipot',      text: 'Hi-pot test passed (where required)' },
        { id: 'qc-cont',       text: 'Continuity / phase rotation verified',         required: true },
        { id: 'qc-func',       text: 'Functional test of breakers / interlocks',     required: true },
        { id: 'qc-meter',      text: 'Meter / display power-up and config verified' },
        { id: 'qc-paperwork',  text: 'Test report signed and filed',                 required: true }
      ]
    },
    {
      id: 'l3-ship',
      name: 'Pack & Ship',
      steps: [
        { id: 'ship-clean',    text: 'Final clean / debris removed' },
        { id: 'ship-doors',    text: 'Doors latched and locked' },
        { id: 'ship-crate',    text: 'Crated / shrink-wrapped per spec',            required: true },
        { id: 'ship-bol',      text: 'BOL prepared and shipping tag attached',      required: true },
        { id: 'ship-photos',   text: 'Shipping photos archived' }
      ]
    }
  ],

  L4: [
    {
      id: 'l4-receiving',
      name: 'Receiving & Pre-Build',
      description: 'L4 integration adds paralleling / automation / customer witness scope on top of L3.',
      steps: [
        { id: 'rx-bom',        text: 'BOM verified against shop order',                    required: true },
        { id: 'rx-sections',   text: 'Section count / dimensions verified',                required: true },
        { id: 'rx-genset',     text: 'Genset / source interface drawings reviewed' },
        { id: 'rx-controls',   text: 'PLC / HMI / paralleling controls staged',            required: true },
        { id: 'rx-fw',         text: 'Firmware versions captured for all intelligent devices' },
        { id: 'rx-drawings',   text: 'Approved drawings + sequence of operation on file',  required: true }
      ]
    },
    {
      id: 'l4-mechanical',
      name: 'Mechanical Assembly',
      steps: [
        { id: 'mech-align',    text: 'Sections joined and aligned',                  required: true },
        { id: 'mech-bus',      text: 'Main bus + tie bus installed and torqued',     required: true },
        { id: 'mech-ground',   text: 'Ground bus + equipment grounding verified',    required: true },
        { id: 'mech-arcflash', text: 'Arc-flash labels applied' },
        { id: 'mech-devices',  text: 'Power devices (ACB / MCCB) mounted',           required: true }
      ]
    },
    {
      id: 'l4-controls',
      name: 'Controls & Integration',
      steps: [
        { id: 'ctrl-plc',      text: 'PLC mounted, powered, program loaded',                  required: true },
        { id: 'ctrl-hmi',      text: 'HMI mounted, configured, screens loaded',               required: true },
        { id: 'ctrl-genctl',   text: 'Genset / paralleling controller config verified',       required: true },
        { id: 'ctrl-network',  text: 'Network switches / managed Ethernet configured' },
        { id: 'ctrl-comm',     text: 'Modbus / EtherNet-IP / BACnet maps verified' },
        { id: 'ctrl-io',       text: 'I/O point-to-point checked end-to-end',                 required: true }
      ]
    },
    {
      id: 'l4-test',
      name: 'Test, FAT & Witness',
      steps: [
        { id: 'qc-megger',     text: 'Megger / insulation resistance passed',                 required: true },
        { id: 'qc-hipot',      text: 'Hi-pot passed where required' },
        { id: 'qc-protrelay',  text: 'Protective relay settings loaded and stamped',          required: true },
        { id: 'qc-seq',        text: 'Sequence of operation tested per SOO document',         required: true },
        { id: 'qc-parallel',   text: 'Paralleling / sync check test passed' },
        { id: 'qc-loadbank',   text: 'Load-bank test results documented' },
        { id: 'qc-witness',    text: 'Customer / 3rd-party witness test signed off' },
        { id: 'qc-report',     text: 'Full FAT report compiled and filed',                    required: true }
      ]
    },
    {
      id: 'l4-ship',
      name: 'Pack & Ship',
      steps: [
        { id: 'ship-restore',  text: 'Default config / setpoints restored before ship' },
        { id: 'ship-clean',    text: 'Final clean / debris removed' },
        { id: 'ship-crate',    text: 'Crated / shrink-wrapped per spec',                      required: true },
        { id: 'ship-spares',   text: 'Spare parts / keys / docs packaged with unit' },
        { id: 'ship-bol',      text: 'BOL prepared and shipping tag attached',                required: true },
        { id: 'ship-photos',   text: 'Shipping photos archived' }
      ]
    }
  ],

  Warranty: [
    {
      id: 'wty-intake',
      name: 'Intake & Triage',
      description: 'Warranty / field service work for IEM-built switchboards already in the field.',
      steps: [
        { id: 'in-ticket',     text: 'Warranty ticket / RMA opened in system',     required: true },
        { id: 'in-claim',      text: 'Customer claim documented (who/what/when)',  required: true },
        { id: 'in-asbuilt',    text: 'As-built drawings + serials pulled' },
        { id: 'in-priority',   text: 'Priority / SLA assigned',                    required: true }
      ]
    },
    {
      id: 'wty-diagnose',
      name: 'Diagnose & Root Cause',
      steps: [
        { id: 'dx-onsite',     text: 'Site visit scheduled / completed' },
        { id: 'dx-symptoms',   text: 'Symptoms reproduced and documented',                 required: true },
        { id: 'dx-rca',        text: 'Root cause analysis completed and recorded',         required: true },
        { id: 'dx-scope',      text: 'Scope of repair confirmed with customer' }
      ]
    },
    {
      id: 'wty-repair',
      name: 'Parts & Repair',
      steps: [
        { id: 'rep-parts',     text: 'Replacement parts identified and ordered',           required: true },
        { id: 'rep-rma',       text: 'Defective parts pulled and RMA tags applied' },
        { id: 'rep-install',   text: 'Replacement parts installed',                        required: true },
        { id: 'rep-retest',    text: 'Re-test / re-commission completed',                  required: true }
      ]
    },
    {
      id: 'wty-close',
      name: 'Closeout',
      steps: [
        { id: 'cl-signoff',    text: 'Customer sign-off obtained',                         required: true },
        { id: 'cl-rma-return', text: 'RMA parts returned to IEM with tracking' },
        { id: 'cl-report',     text: 'Warranty report filed (failure mode, hours, cost)',  required: true },
        { id: 'cl-followup',   text: 'Follow-up / 30-day check scheduled (if needed)' }
      ]
    }
  ]
};

// Exposed globally so app.js can read it without a module system.
window.DEFAULT_SEQUENCES = DEFAULT_SEQUENCES;
