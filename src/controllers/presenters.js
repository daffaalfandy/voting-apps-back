export function toPublicUser(user, votedAt) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    hasVoted: votedAt !== null,
    votedAt,
    createdAt: user.createdAt,
  };
}

export function toPublicCandidate(candidate) {
  return { id: candidate.id, name: candidate.name, isWriteIn: candidate.isWriteIn };
}

export function toPublicVote(vote) {
  return { candidate: toPublicCandidate(vote.candidate), createdAt: vote.createdAt };
}
