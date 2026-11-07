export function titlesMatch(guess, title) {
  const normalize = (value) =>
    value
      .toLocaleLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  return normalize(guess) === normalize(title);
}
