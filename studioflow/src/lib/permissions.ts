const adminEntities = [
  "services",
  "professionals",
  "business",
  "settings",
  "payments",
];

/**
 * Mirrors workspace_mutation in the migration: professionals are read-only,
 * and catalog, team, business, settings and payments need owner/admin/manager.
 */
export function canMutateEntity(role: string | undefined, entity: string) {
  if (!role || role === "professional") return false;
  return (
    !adminEntities.includes(entity) ||
    ["owner", "admin", "manager"].includes(role)
  );
}
