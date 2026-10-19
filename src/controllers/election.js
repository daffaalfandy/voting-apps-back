import * as electionService from '../services/election.js';

export async function reset(_req, res) {
  res.json(await electionService.reset());
}
