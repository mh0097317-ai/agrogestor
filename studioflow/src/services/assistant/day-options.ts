/** Day alternatives are commercial only when the caller has recent context. */
export function asksForDayOptions(text: string) {
  const value = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.!?]+$/g, "")
    .trim();
  return /^(?:e )?(?:(?:quais|que) (?:sao |seriam |tem |os |as )*(?:(?:outros|outras) )?(?:dias|datas)(?: (?:tem|voce tem|disponiveis|livres|para marcar|da semana))?|(?:tem|ha|voce tem|teria) (?:outros dias|outras datas)|(?:e )?(?:nos |os )?(?:outros dias|outras datas))$/.test(
    value,
  );
}
