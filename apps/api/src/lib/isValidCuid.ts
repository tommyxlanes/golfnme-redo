/**
 * src/lib/isValidCuid.ts
 *
 * Replaces isValidObjectId.ts now that the schema uses cuid() instead of MongoDB ObjectIds.
 *
 * cuid format: starts with 'c', followed by ~24 alphanumeric chars
 * cuid2 format: starts with any lowercase letter, ~24 chars
 *
 * Used in friend.service.ts to decide whether a lookup string
 * should be tried as an ID before falling back to username search.
 */
export function isValidId(id: string): boolean {
  // cuid  — c + 24 alphanumeric chars
  // cuid2 — 24-28 lowercase alphanumeric chars
  return /^[a-z][a-z0-9]{20,30}$/.test(id);
}
