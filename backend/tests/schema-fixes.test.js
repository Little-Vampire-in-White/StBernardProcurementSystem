const test = require('node:test');
const assert = require('node:assert/strict');

const uploads = require('../src/services/uploads');
const migration = require('../scripts/migrate-chat-interactions');

test('upload paths are normalized without duplicating the uploads root', () => {
  assert.equal(uploads.normalizeStoredUploadPath('uploads/users/example.jpg'), 'uploads/users/example.jpg');
  assert.equal(uploads.normalizeStoredUploadPath('users/example.jpg'), 'uploads/users/example.jpg');
  assert.equal(uploads.normalizeStoredUploadPath('/uploads/users/example.jpg'), 'uploads/users/example.jpg');
});

test('chat schema migration checks for missing reaction tables and required columns', async () => {
  const calls = [];
  const connection = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (Array.isArray(params) && params[0] === 'chat_messages' && Array.isArray(params)) {
        if (params[1] === 'reply_to_id') return [[{ count: 0 }]];
        if (params[1] === 'attachments') return [[{ count: 0 }]];
      }
      if (Array.isArray(params) && params[0] === 'chat_reactions') return [[{ count: 0 }]];
      return [[{ count: 1 }]];
    },
  };

  await migration.ensureChatSchema(connection);

  assert.ok(calls.some((call) => Array.isArray(call.params) && call.params.includes('chat_reactions')));
  assert.ok(calls.some((call) => Array.isArray(call.params) && call.params.includes('reply_to_id')));
  assert.ok(calls.some((call) => Array.isArray(call.params) && call.params.includes('attachments')));
});
