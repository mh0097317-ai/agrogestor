export function inviteRedirect(value: string | null) {
  return value && /^\/equipe\/convite\/[A-Za-z0-9_-]{43}$/.test(value)
    ? value
    : null;
}
