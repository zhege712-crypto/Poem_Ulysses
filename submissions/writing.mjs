import '../writing-info.js';
export const writing = globalThis.PoemWriting;
export function storedWriting(value) { return writing.normalize(typeof value === 'string' ? JSON.parse(value || '{}') : value); }

async function snapshots(env, poems) {
  const ids = [...new Set(poems.map(p => p.writingRevision).filter(Boolean))], rows = new Map();
  // D1 limits a statement to 100 bound parameters. Batch reads also keep a
  // whole-library edit within the Worker's subrequest allowance.
  for (let offset = 0; offset < ids.length; offset += 90) {
    const batch = ids.slice(offset, offset + 90);
    const result = await env.DB.prepare('SELECT revision,poem_id,data FROM poem_writing WHERE revision IN (' + batch.map(() => '?').join(',') + ')').bind(...batch).all();
    for (const row of result.results) rows.set(row.revision, row);
  }
  return rows;
}

// Called only inside authenticated workflows. No endpoint resolves a revision
// pointer directly; partner access still requires the fixed poem ownership.
export async function hydrateWriting(env, poems) {
  const rows = await snapshots(env, poems);
  for (const poem of poems) {
    if (poem.writingRevision) {
      const row = rows.get(poem.writingRevision);
      if (!row || row.poem_id !== poem.id) throw new Error('写作信息暂时无法读取，请联系维护者恢复私有记录；未保存任何修改。');
      poem.writing = storedWriting(row.data);
    } else if (poem.writing) poem.writing = writing.normalize({ ...poem.writing, public: true });
  }
  return poems;
}

// Persist privately first, then let GitHub's file SHA atomically select the
// active revision. Network failure/409 leaves a harmless private orphan.
export async function projectWriting(env, poems) {
  const output = [], statements = [], rows = await snapshots(env, poems);
  for (const original of poems) {
    const poem = { ...original }, value = writing.normalize(poem.writing);
    if (writing.text(value) || value.public || poem.writingRevision) {
      const old = rows.get(poem.writingRevision);
      if (old && old.poem_id !== poem.id) throw new Error('作品与写作信息的版本不匹配，请刷新核对。');
      const serialized = JSON.stringify(value);
      if (!old || old.data !== serialized) {
        poem.writingRevision = crypto.randomUUID();
        statements.push(env.DB.prepare('INSERT INTO poem_writing (revision,poem_id,data,created_at) VALUES (?,?,?,?)').bind(poem.writingRevision, poem.id, serialized, new Date().toISOString()));
      }
    }
    delete poem.writing;
    const visible = writing.publicValue(value);
    if (visible) poem.writing = visible;
    output.push(poem);
  }
  if (statements.length === 1) await statements[0].run();
  else for (let offset = 0; offset < statements.length; offset += 90) await env.DB.batch(statements.slice(offset, offset + 90));
  return output;
}

// Grace period also protects in-flight writes and uncertain network results.
// Only current public pointers remain addressable through authenticated reads.
export async function cleanupWriting(env, poems) {
  const active = new Set(poems.map(p => p.writingRevision).filter(Boolean));
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
  const rows = (await env.DB.prepare('SELECT revision FROM poem_writing WHERE created_at<?').bind(cutoff).all()).results;
  const obsolete = rows.map(row => row.revision).filter(id => !active.has(id));
  for (let offset = 0; offset < obsolete.length; offset += 90) {
    const batch = obsolete.slice(offset, offset + 90);
    await env.DB.prepare('DELETE FROM poem_writing WHERE revision IN (' + batch.map(() => '?').join(',') + ')').bind(...batch).run();
  }
  // A deleted poem cannot finish an open revision. Clean its aged private
  // proposal/history too, without racing a recent save or changing a live poem.
  const poemIds = new Set(poems.map(p => p.id));
  const revisions = (await env.DB.prepare("SELECT id,poem_id,updated_at FROM partner_revisions WHERE status IN ('draft','submitted','publishing') AND updated_at<?").bind(cutoff).all()).results;
  for (const row of revisions) if (!poemIds.has(row.poem_id)) {
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare("DELETE FROM partner_revision_history WHERE revision_id=? AND EXISTS (SELECT 1 FROM partner_revisions WHERE id=? AND updated_at=? AND status IN ('draft','submitted','publishing'))").bind(row.id,row.id,row.updated_at),
      env.DB.prepare("UPDATE partner_revisions SET status='withdrawn',data='',base_data='',decided_at=?,updated_at=? WHERE id=? AND updated_at=? AND status IN ('draft','submitted','publishing')").bind(now,now,row.id,row.updated_at)
    ]);
  }
}
