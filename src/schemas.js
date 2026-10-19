import { z } from 'zod';
import { normalizeName } from './models/candidate.js';

export const nameSchema = z
  .string({ error: 'Name is required' })
  .trim()
  .min(1, 'Name is required')
  .max(100, 'Name must be at most 100 characters');

export const emailSchema = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address'));

export const passwordSchema = z
  .string({ error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters');

export const candidateNameSchema = z
  .string({ error: 'Name is required' })
  .transform(normalizeName)
  .pipe(
    z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(80, 'Name must be at most 80 characters')
      .regex(/^[\p{L}\p{M} .'-]+$/u, "Use letters, spaces and . ' - only")
      .regex(/\p{L}/u, 'Include at least one letter'),
  );
