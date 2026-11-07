import {randomUUID} from 'node:crypto';
export function record(overrides={}) {
  return {schemaVersion:1,eventId:randomUUID(),matchId:randomUUID(),round:1,mode:'points',
    aiPolicy:'match-and-goal-planning-v1',buildCommit:'development',
    startedAt:'2026-11-07T00:00:00.000Z',finishedAt:'2026-11-07T00:01:00.000Z',durationMs:60000,
    turns:5,starter:'human',winner:'human',matchResult:null,
    human:{laidDown:true,goal:'2S',targetGoal:'2S',points:1,cardsRemaining:0,laydownTurn:3},
    ai:{laidDown:false,goal:null,targetGoal:null,points:0,cardsRemaining:8,laydownTurn:null},scores:{human:1,ai:0},...overrides};
}
