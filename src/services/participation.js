import * as userRepository from '../repositories/users.js';
import * as voteRepository from '../repositories/votes.js';

export async function list() {
  const votes = await voteRepository.listRecent();
  const users = await userRepository.findByIds(votes.map((vote) => vote.user));
  const usersById = new Map(users.map((user) => [user.id, user]));

  return votes.flatMap((vote) => {
    const user = usersById.get(String(vote.user));
    return user ? [{ user, votedAt: vote.createdAt }] : [];
  });
}
