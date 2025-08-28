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
    if (stores.stores && stores.stores.length > 0) {
      storeId = stores.stores[0].id;
    } else {
      const created = await fga.createStore({ name: 'blog-store' });
      storeId = created.id;
    }
    fga.storeId = storeId;
    process.env.FGA_STORE_ID = storeId;
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
