export function createTranslator(lang) {
  const isEn = lang === 'EN';
  return (ko, en) => (isEn ? en : ko);
}

export function toggleLang(lang) {
  return lang === 'EN' ? 'KO' : 'EN';
}
