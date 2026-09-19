require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
const { query } = require('../../config/db');

async function migrate() {
  console.log('--- Starting Migration: Enforce Single Group Per Student Per Assignment ---');

  // 1. Add assignment_id to assignment_group_members if not present
  console.log('1. Ensuring assignment_id column exists on assignment_group_members...');
  await query(`
    ALTER TABLE assignment_group_members
    ADD COLUMN IF NOT EXISTS assignment_id INT REFERENCES assignments(id) ON DELETE CASCADE;
  `);

  // 2. Backfill assignment_id from assignment_groups
  console.log('2. Backfilling assignment_id from assignment_groups...');
  const backfillRes = await query(`
    UPDATE assignment_group_members agm
    SET assignment_id = ag.assignment_id
    FROM assignment_groups ag
    WHERE agm.group_id = ag.id AND agm.assignment_id IS NULL;
  `);
  console.log(`   Updated ${backfillRes.rowCount || 0} rows.`);

  // 3. Remove any potential duplicate rows before creating unique index (keeping lowest ID)
  console.log('3. Cleaning any legacy duplicates if present...');
  await query(`
    DELETE FROM assignment_group_members a
    USING assignment_group_members b
    WHERE a.id > b.id
      AND a.assignment_id = b.assignment_id
      AND a.student_id = b.student_id;
  `);

  // 4. Create Unique Index on (assignment_id, student_id)
  console.log('4. Creating unique index uq_agm_assignment_student (assignment_id, student_id)...');
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_agm_assignment_student
    ON assignment_group_members (assignment_id, student_id);
  `);

  // 5. Create Trigger function to auto-populate assignment_id if not passed in INSERT
  console.log('5. Ensuring trigger auto-sets assignment_id on assignment_group_members...');
  await query(`
    CREATE OR REPLACE FUNCTION trg_set_assignment_group_member_assignment_id()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.assignment_id IS NULL THEN
        SELECT assignment_id INTO NEW.assignment_id
        FROM assignment_groups
        WHERE id = NEW.group_id;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await query(`
    DROP TRIGGER IF EXISTS set_assignment_group_member_assignment_id ON assignment_group_members;
  `);

  await query(`
    CREATE TRIGGER set_assignment_group_member_assignment_id
    BEFORE INSERT OR UPDATE ON assignment_group_members
    FOR EACH ROW
    EXECUTE FUNCTION trg_set_assignment_group_member_assignment_id();
  `);

  console.log('✅ Migration completed successfully! Physical single-group constraint active in database.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
