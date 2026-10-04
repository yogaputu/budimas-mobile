export const toLocalDateInputValue = (dateObj = new Date()) => {
  const date = dateObj instanceof Date ? dateObj : new Date(dateObj);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const parseLocalDateInput = (value) => {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date(text);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
};

export const addDaysToDateInput = (value, days) => {
  const date = parseLocalDateInput(value);
  date.setDate(date.getDate() + Number(days || 0));
  return toLocalDateInputValue(date);
};

export const dateInputToLocalDateTime = (value, sourceTime = new Date()) => {
  if (!value) return '';
  const date = parseLocalDateInput(value);
  if (Number.isNaN(date.getTime())) return '';
  const time = sourceTime instanceof Date ? sourceTime : new Date(sourceTime);
  date.setHours(time.getHours(), time.getMinutes(), time.getSeconds(), 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};
