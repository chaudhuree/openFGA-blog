// Load env
require('dotenv').config();

// Import OpenFGA SDK
const { OpenFgaClient } = require('@openfga/sdk');

// Import fs and path for reading model
const fs = require('fs');
const path = require('path');

// Create an FGA client instance
const fga = new OpenFgaClient({
  apiScheme: process.env.FGA_API_SCHEME || 'http',
  apiHost: `${process.env.FGA_API_HOST || 'localhost'}:${process.env.FGA_API_PORT || '8080'}`,
  storeId: process.env.FGA_STORE_ID || undefined,
});

// Helper: ensure store exists and model loaded
async function ensureFGAStoreAndModel() {
  // If store ID not provided, create or reuse the first one
  let storeId = process.env.FGA_STORE_ID;
  if (!storeId) {
    const stores = await fga.listStores({ pageSize: 1 });
    // console.log(stores);
    if (stores.stores && stores.stores.length > 0) {
      // console.log(stores.stores[0].id);
      storeId = stores.stores[0].id;
    } else {
      const created = await fga.createStore({ name: 'blog-store' });
      storeId = created.id;
    }
    fga.storeId = storeId;
    process.env.FGA_STORE_ID = storeId;
    // Ensure FGA_STORE_ID is persisted in the root .env
    // - If FGA_STORE_ID key exists with a non-empty value: leave as-is
    // - If key exists but empty: set to storeId
    // - If key does not exist: append it at the end
    const envPath = path.join(__dirname, '..', '..', '.env');
    const lineForStore = `FGA_STORE_ID=${storeId}`;
    try {
      if (fs.existsSync(envPath)) {
        const raw = fs.readFileSync(envPath, 'utf8');
        const lines = raw.split(/\r?\n/);
        let found = false;
        const updated = lines.map((line) => {
          const trimmed = line.trim();
          if (trimmed.startsWith('FGA_STORE_ID=')) {
            found = true;
            const current = trimmed.substring('FGA_STORE_ID='.length);
            // Only replace if empty
            if (current === '') {
              return lineForStore;
            }
            return line; // leave existing non-empty value
          }
          return line;
        });
        if (!found) {
          // Append with a newline if file is non-empty and does not end with a newline
          if (updated.length === 0 || updated[updated.length - 1] !== '') {
            updated.push(lineForStore);
          } else {
            // file already ends with a newline represented by a trailing empty element
            updated[updated.length - 1] = lineForStore;
            updated.push('');
          }
        }
        fs.writeFileSync(envPath, updated.join('\n'));
      } else {
        // Create a new .env with the store id
        fs.writeFileSync(envPath, `${lineForStore}\n`);
      }
    } catch (e) {
      console.warn('Failed to persist FGA_STORE_ID to .env:', e?.message || e);
    }
    console.log('Using FGA store:', storeId);
  }

  // Load and write the auth model
  const modelPath = path.join(__dirname, '..', 'openfga', 'model.json');
  const model = JSON.parse(fs.readFileSync(modelPath, 'utf8'));
  // Explicitly pass schema_version and type_definitions (SDK expects these top-level fields)
  const version = model.schema_version || '1.1';
  const payload = {
    // Include both just in case of SDK mapping differences
    schema_version: version,
    schemaVersion: version,
    type_definitions: model.type_definitions || [],
  };
  // Debug (trim to avoid noisy logs)
  console.log('Posting FGA model (truncated):', JSON.stringify(payload).slice(0, 400));
  await fga.writeAuthorizationModel(payload);
  console.log('FGA model loaded.');
}

// Helper: tuple helpers
function userObj(userId) {
  return `user:${userId}`;
}
function postObj(postId) {
  return `post:${postId}`;
}

module.exports = { fga, ensureFGAStoreAndModel, userObj, postObj };
