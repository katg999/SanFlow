export async function audit(client, actor, action, target = '') {
  await client.query('INSERT INTO audit_log(actor_id, actor_name, action, target) VALUES ($1, $2, $3, $4)', [
    actor?.id && /^[0-9a-f-]{36}$/.test(actor.id) ? actor.id : null,
    actor?.name ?? 'Anonymous',
    action,
    target,
  ]);
}
