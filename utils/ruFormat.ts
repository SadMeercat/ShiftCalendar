/** 167 → '167 ч', 7.5 → '7,5 ч'. */
export function formatHoursRu(hours: number): string {
  const r = Math.round(hours * 10) / 10;
  return `${String(r).replace('.', ',')} ч`;
}

const MONTHS_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

export function monthNameRu(month: number): string {
  return MONTHS_RU[month];
}
