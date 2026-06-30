#!/usr/bin/env node
/**
 * CLI tool to manage subscription plans and custom device limits
 * for self-hosted TechYzer instances.
 *
 * Usage:
 *   node scripts/manage-plans.js list
 *   node scripts/manage-plans.js add <id> <display_name> <max_devices> [max_storage_mb]
 *   node scripts/manage-plans.js delete <id>
 */

const path = require('path');
const SERVER_DIR = path.resolve(__dirname, '..', 'server');
const resolveFromServer = (name) => require.resolve(name, { paths: [SERVER_DIR] });
const Database = require(resolveFromServer('better-sqlite3'));
const config = require(path.join(SERVER_DIR, 'config'));

const db = new Database(config.dbPath);
db.pragma('foreign_keys = ON');

const args = process.argv.slice(2);
const command = args[0];

if (!command || !['list', 'add', 'delete'].includes(command)) {
  console.log(`
Usage:
  node scripts/manage-plans.js list
  node scripts/manage-plans.js add <id> <display_name> <max_devices> [max_storage_mb]
  node scripts/manage-plans.js delete <id>

Examples:
  node scripts/manage-plans.js list
  node scripts/manage-plans.js add agency-5 "Agency (5 Screens)" 5 2048
  node scripts/manage-plans.js delete agency-5
  `);
  process.exit(0);
}

if (command === 'list') {
  const plans = db.prepare('SELECT * FROM plans ORDER BY sort_order ASC').all();
  console.log('\n--- Current Subscription Plans ---');
  plans.forEach(p => {
    const devices = p.max_devices === -1 ? 'Unlimited' : p.max_devices;
    const storage = p.max_storage_mb === -1 ? 'Unlimited' : `${p.max_storage_mb} MB`;
    console.log(`ID: ${p.id.padEnd(12)} | Name: ${p.display_name.padEnd(25)} | Max Screens: ${String(devices).padEnd(10)} | Max Storage: ${storage}`);
  });
  console.log('');
  process.exit(0);
}

if (command === 'add') {
  const id = args[1];
  const displayName = args[2];
  const maxDevices = parseInt(args[3], 10);
  const maxStorage = parseInt(args[4], 10) || 2048; // default to 2GB

  if (!id || !displayName || isNaN(maxDevices)) {
    console.error('Error: id, display_name, and max_devices are required.');
    process.exit(1);
  }

  const existing = db.prepare('SELECT id FROM plans WHERE id = ?').get(id);
  if (existing) {
    console.log(`Updating existing plan: ${id}`);
    db.prepare('UPDATE plans SET display_name = ?, max_devices = ?, max_storage_mb = ? WHERE id = ?')
      .run(displayName, maxDevices, maxStorage, id);
    console.log('Plan updated successfully.');
  } else {
    const maxOrder = db.prepare('SELECT MAX(sort_order) as max_order FROM plans').get().max_order || 0;
    db.prepare(`
      INSERT INTO plans (id, name, display_name, max_devices, max_storage_mb, remote_control, remote_url, priority_support, sort_order)
      VALUES (?, ?, ?, ?, ?, 1, 1, 1, ?)
    `).run(id, id.toLowerCase(), displayName, maxDevices, maxStorage, maxOrder + 1);
    console.log(`Plan "${displayName}" created successfully with a limit of ${maxDevices} screens.`);
  }
  process.exit(0);
}

if (command === 'delete') {
  const id = args[1];
  if (!id) {
    console.error('Error: plan ID required.');
    process.exit(1);
  }

  const inUse = db.prepare('SELECT COUNT(*) as count FROM users WHERE plan_id = ?').get(id).count;
  if (inUse > 0) {
    console.error(`Error: Cannot delete plan "${id}" because it is currently assigned to ${inUse} user(s).`);
    process.exit(1);
  }

  db.prepare('DELETE FROM plans WHERE id = ?').run(id);
  console.log(`Plan "${id}" deleted successfully.`);
  process.exit(0);
}
