export function canMutateEntity(role: string | undefined, entity: string) {
  if (!role) return false;
  return (
    !["services", "professionals", "business", "settings", "payments"].includes(
      entity,
    ) || ["owner", "admin", "manager"].includes(role)
  );
}
