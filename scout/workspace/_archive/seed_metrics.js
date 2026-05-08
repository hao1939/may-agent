import { getDb } from '../../../src/db.js';

async function seedScoutMetrics() {
  const db = getDb();
  
  const metrics = [
    {
      id: 'scout.research_artifacts_produced',
      owner: 'scout',
      name: 'Research Artifacts Produced',
      description: 'Number of research artifacts produced by scout',
      value: 0,
      target: 5
    },
    {
      id: 'scout.findings_cited',
      owner: 'scout',
      name: 'Findings Cited',
      description: 'Number of scout findings cited by other agents',
      value: 0,
      target: 2
    }
  ];
  
  for (const m of metrics) {
    db.prepare(`
      INSERT OR REPLACE INTO metrics (id, owner, name, description, value, target, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(m.id, m.owner, m.name, m.description, m.value, m.target);
  }
  
  console.log('Scout metrics seeded.');
}

seedScoutMetrics().catch(console.error);
