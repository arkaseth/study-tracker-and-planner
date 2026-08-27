export const dayMs = 86400000;

export const iso = (date = new Date()) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);

export const addDays = (date, days) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

export const daysBetween = (a, b) =>
  Math.max(
    0,
    Math.ceil((new Date(b + "T00:00") - new Date(a + "T00:00")) / dayMs),
  );

export const formatDate = (date) =>
  new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(date + "T12:00"));
