'use strict';

const { MongoClient } = require('mongodb');

const URI = 'mongodb+srv://j7479476_db_user:TkzuvfAOUwaTztb7@cluster0.m6ookor.mongodb.net/test';

async function dropIndex() {
  const client = new MongoClient(URI);
  try {
    await client.connect();
    console.log('✅ Connected');

    const db = client.db('test');
    await db.collection('users').dropIndex('phoneNumber_1');
    console.log('✅ Dropped phoneNumber_1 index');

  } catch (err) {
    if (err.message.includes('index not found')) {
      console.log('ℹ️  Index already gone — nothing to drop.');
    } else {
      console.error('❌ Error:', err.message);
    }
  } finally {
    await client.close();
  }
}

dropIndex();