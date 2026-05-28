{
  "name": "curvescout-com",
  "version": "1.4.6",
  "private": true,
  "scripts": {
    "test": "node scripts/validate.mjs && node scripts/search_audit.mjs && node scripts/deployment_audit_curvescout_v141.mjs && node scripts/runtime_transfer_audit_curvescout_v141.mjs && node scripts/roadbook_restore_audit_v141.mjs && node --check app.js"
  }
}
