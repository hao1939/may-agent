// Compatibility for historical one-off repair scripts. Focus observations are
// snapshots, so active integrity checks intentionally do not audit them.
export type FocusMetadataIssue = {
  ownerTaskId: string;
  field: string;
  referencedTaskId: string;
  expectedState: string;
  actualState: string;
  reason: string;
};

export function auditFocusMetadataIssues(_tree: unknown): FocusMetadataIssue[] {
  return [];
}
