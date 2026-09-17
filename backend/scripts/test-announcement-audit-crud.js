const { query } = require('../src/config/db');

async function testCrud() {
  console.log('Testing Announcements and Audit CRUD...');

  // 1. Announcements
  const aRes = await query(
    `INSERT INTO announcements (title, content, target_audience)
     VALUES ($1, $2, $3)
     RETURNING *`,
    ['Initial Announcement', 'Initial content', 'ALL']
  );
  const ann = aRes.rows[0];
  console.log('1. Created Announcement ID:', ann.id);

  const uRes = await query(
    `UPDATE announcements
     SET title = $1, content = $2, target_audience = $3
     WHERE id = $4
     RETURNING *`,
    ['Updated Announcement Title', 'Updated content description', 'TEACHERS', ann.id]
  );
  console.log('2. Updated Announcement Title:', uRes.rows[0].title, 'Target:', uRes.rows[0].target_audience);

  await query('DELETE FROM announcements WHERE id = $1', [ann.id]);
  console.log('3. Deleted Announcement successfully.');

  // 2. Audit Logs
  const alRes = await query(
    `INSERT INTO audit_logs (action, entity_type, entity_id, details)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    ['TEST_USER_ACTION', 'USER', '101', JSON.stringify({ note: 'Initial record' })]
  );
  const log = alRes.rows[0];
  console.log('4. Created Audit Log ID:', log.id);

  const uLogRes = await query(
    `UPDATE audit_logs
     SET action = $1, details = $2
     WHERE id = $3
     RETURNING *`,
    ['MODIFIED_USER_ACTION', JSON.stringify({ note: 'Modified record' }), log.id]
  );
  console.log('5. Updated Audit Log Action:', uLogRes.rows[0].action);

  await query('DELETE FROM audit_logs WHERE id = $1', [log.id]);
  console.log('6. Deleted Audit Log successfully.');

  console.log('\n✔ All Database CRUD operations for Announcements & Audit passed!');
  process.exit(0);
}

testCrud().catch((err) => {
  console.error('Error during CRUD test:', err);
  process.exit(1);
});
