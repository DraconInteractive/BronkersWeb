import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,chmodSync} from 'node:fs';
import {dirname} from 'node:path';

export class RoundStore {
  constructor(filename) {
    if(filename!==':memory:')mkdirSync(dirname(filename),{recursive:true,mode:0o700});
    this.db=new DatabaseSync(filename);
    if(filename!==':memory:')chmodSync(filename,0o600);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS rounds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,event_id TEXT NOT NULL UNIQUE,
        match_id TEXT NOT NULL,round_number INTEGER NOT NULL,received_at TEXT NOT NULL,
        mode TEXT NOT NULL,ai_policy TEXT NOT NULL,build_commit TEXT NOT NULL,winner TEXT NOT NULL,
        human_laid INTEGER NOT NULL,ai_laid INTEGER NOT NULL,human_points INTEGER NOT NULL,ai_points INTEGER NOT NULL,
        payload TEXT NOT NULL,UNIQUE(match_id,round_number));
      CREATE INDEX IF NOT EXISTS rounds_policy_mode ON rounds(ai_policy,mode,id);`);
    this.find=this.db.prepare('SELECT id,received_at,payload FROM rounds WHERE event_id=? OR (match_id=? AND round_number=?)');
    this.insert=this.db.prepare(`INSERT OR IGNORE INTO rounds
      (event_id,match_id,round_number,received_at,mode,ai_policy,build_commit,winner,human_laid,ai_laid,human_points,ai_points,payload)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  }
  save(record) {
    const body=JSON.stringify(record),args=[record.eventId,record.matchId,record.round];
    const before=this.find.get(...args);
    let changes=0;
    if(!before)changes=this.insert.run(record.eventId,record.matchId,record.round,new Date().toISOString(),record.mode,
      record.aiPolicy,record.buildCommit,record.winner,Number(record.human.laidDown),Number(record.ai.laidDown),record.human.points,record.ai.points,body).changes;
    const row=before??this.find.get(...args);
    if(row.payload!==body){const error=new Error('Round already recorded with different data');error.status=409;throw error;}
    return {id:row.id,eventId:record.eventId,receivedAt:row.received_at,duplicate:changes===0};
  }
  rounds({after=0,through,limit=100,mode=null,aiPolicy=null}={}) {
    const snapshotThrough=through??this.db.prepare('SELECT COALESCE(MAX(id),0) AS id FROM rounds').get().id;
    const rows=this.db.prepare(`SELECT id,received_at,payload FROM rounds WHERE id>? AND id<=?
      AND (? IS NULL OR mode=?) AND (? IS NULL OR ai_policy=?) ORDER BY id LIMIT ?`).all(after,snapshotThrough,mode,mode,aiPolicy,aiPolicy,limit+1);
    const hasMore=rows.length>limit,selected=rows.slice(0,limit);
    return {schemaVersion:1,snapshotThrough,hasMore,nextAfter:hasMore?selected.at(-1).id:snapshotThrough,
      rounds:selected.map(r=>({id:r.id,receivedAt:r.received_at,...JSON.parse(r.payload)}))};
  }
  stats({mode=null,aiPolicy=null}={}) {
    const fields=`COUNT(*) AS rounds,COUNT(DISTINCT match_id) AS observedMatches,
      COALESCE(SUM(winner='human'),0) AS humanWins,COALESCE(SUM(winner='ai'),0) AS aiWins,
      COALESCE(SUM(human_laid=0),0) AS humanBombed,COALESCE(SUM(ai_laid=0),0) AS aiBombed,
      AVG(human_points) AS meanHumanPoints,AVG(ai_points) AS meanAiPoints,
      MIN(received_at) AS firstReceivedAt,MAX(received_at) AS lastReceivedAt`;
    const where='WHERE (? IS NULL OR mode=?) AND (? IS NULL OR ai_policy=?)';
    const args=[mode,mode,aiPolicy,aiPolicy];
    return {schemaVersion:1,generatedAt:new Date().toISOString(),
      totals:this.db.prepare(`SELECT ${fields} FROM rounds ${where}`).get(...args),
      groups:this.db.prepare(`SELECT mode,ai_policy AS aiPolicy,build_commit AS buildCommit,${fields}
        FROM rounds ${where} GROUP BY mode,ai_policy,build_commit ORDER BY mode,ai_policy,build_commit`).all(...args)};
  }
  close(){this.db.close();}
}
