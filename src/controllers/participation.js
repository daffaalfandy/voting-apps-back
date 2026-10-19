import * as participationService from '../services/participation.js';
import { toPublicParticipant } from './presenters.js';

export async function list(_req, res) {
  const participants = await participationService.list();
  res.json({ participants: participants.map(toPublicParticipant) });
}
