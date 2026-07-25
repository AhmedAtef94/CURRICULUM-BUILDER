// Sort tree nodes by position then creation time.
export const byPos = (a, b) =>
  (a.position - b.position) || (a.created_at < b.created_at ? -1 : 1);

// Arabic-Egypt date like "22 يوليو 2026، 7:14 م" for a timestamptz string.
export function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d)) return '';
  return d.toLocaleString('ar-EG', {
    day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export function sortTree(lectures) {
  const t = [...(lectures || [])].sort(byPos);
  t.forEach((l) => {
    l.topics = (l.topics || []).sort(byPos);
    l.topics.forEach((tp) => {
      tp.chapters = (tp.chapters || []).sort(byPos);
      tp.chapters.forEach((c) => { c.questions = (c.questions || []).sort(byPos); });
    });
  });
  return t;
}
