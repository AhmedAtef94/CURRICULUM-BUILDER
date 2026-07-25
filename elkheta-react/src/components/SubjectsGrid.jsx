import { useState, useEffect } from 'react';
import { GRADES, TERMS, GRADE_BADGE, TERM_LABEL } from '../lib/constants';

const PER_PAGE_OPTIONS = [10, 25, 50];

// Page numbers to render: first, last, and a window around the current page.
// Gaps collapse into '…' so 40 pages never spill into 40 buttons.
function pageWindow(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const around = [current - 1, current, current + 1].filter((n) => n > 1 && n < total);
  const out = [1, ...around, total];
  return out.flatMap((n, i) => (i > 0 && n - out[i - 1] > 1 ? ['…', n] : [n]));
}

function Empty({ icon, title, sub, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      <div className="empty-sub">{sub}</div>
      {action}
    </div>
  );
}

export default function SubjectsGrid({ subjects, counts, canEdit, isContentManager, onOpen, onAdd, onEdit }) {
  const [search, setSearch] = useState('');
  const [grade, setGrade] = useState('');
  const [term, setTerm] = useState('');
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);

  const list = subjects.filter((s) => {
    if (search && !(s.name || '').toLowerCase().includes(search.toLowerCase())) return false;
    if (grade && s.grade !== grade) return false;
    if (term && s.term !== term) return false;
    return true;
  });

  const pageCount = Math.max(1, Math.ceil(list.length / perPage));
  // Filters can shrink the list under the current page — snap back into range.
  useEffect(() => { if (page > pageCount) setPage(1); }, [page, pageCount]);

  const start = (page - 1) * perPage;
  const pageItems = list.slice(start, start + perPage);

  const toolbar = (
    <div className="subjects-toolbar">
      <div className="search-box">
        <input placeholder="ابحث عن مادة..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>
      <select className="filter-select" value={grade} onChange={(e) => { setGrade(e.target.value); setPage(1); }}>
        <option value="">كل السنوات</option>
        {GRADES.map((g) => <option key={g.code} value={g.code}>{GRADE_BADGE[g.code]}</option>)}
      </select>
      <select className="filter-select" value={term} onChange={(e) => { setTerm(e.target.value); setPage(1); }}>
        <option value="">كل الترمات</option>
        {TERMS.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
      </select>
      {isContentManager && <button className="btn btn-yellow" style={{ padding: '12px 22px' }} onClick={onAdd}>＋ مادة جديدة</button>}
    </div>
  );

  return (
    <>
      <div className="brand-header">
        <div><h1>Subjects</h1><div className="sub">أدر موادك ودروسك</div></div>
      </div>
      {toolbar}

      {subjects.length === 0 ? (
        isContentManager ? (
          <Empty icon="✨" title="لسه مفيش مواد" sub="ابدأ ببناء المنهج — أضف أول مادة دراسية."
            action={<button className="btn btn-yellow" style={{ padding: '12px 26px' }} onClick={onAdd}>+ أضف أول مادة</button>} />
        ) : (
          <Empty icon="🔒" title="لا توجد مواد متاحة لك" sub="لسه مفيش مواد متخصصة لحسابك. تواصل مع مسؤول النظام." />
        )
      ) : list.length === 0 ? (
        <Empty icon="🔎" title="لا توجد نتائج" sub="غيّر كلمة البحث أو الفلاتر." />
      ) : (
        <>
        <div className="subjects-grid">
          {pageItems.map((s) => {
            const editable = canEdit(s.id);
            const color = s.color || '#facc15';
            return (
              <div className="subject-card" key={s.id}>
                <div className="sc-head">
                  <div className="sc-icon" style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}>
                    {editable ? '📘' : '🔒'}
                  </div>
                  <div className="sc-title">{s.name}</div>
                  {/* Renaming a subject hits `subjects` — content managers only. */}
                  {isContentManager && <button className="sc-edit" title="تعديل" onClick={() => onEdit(s)}>✎</button>}
                </div>
                <div className="sc-badges">
                  {s.grade && <span className="badge-grade">{GRADE_BADGE[s.grade] || s.grade}</span>}
                  {s.term && <span className="badge-term">{TERM_LABEL[s.term] || s.term}</span>}
                  {!s.grade && !s.term && <span className="badge-grade">بدون تصنيف</span>}
                </div>
                <div className="sc-lessons">🎓 {counts[s.id] || 0} محاضرة</div>
                <div className="sc-divider" />
                <button className="btn-manage" onClick={() => onOpen(s)}>{editable ? 'إدارة الدروس' : 'عرض الدروس'}</button>
              </div>
            );
          })}
        </div>

        {/* Only worth showing once the list actually outgrows one page. */}
        {list.length > PER_PAGE_OPTIONS[0] && (
          <div className="pagination">
            <div className="pg-info">
              عرض <b>{start + 1}–{start + pageItems.length}</b> من <b>{list.length}</b> مادة
            </div>

            {pageCount > 1 && (
              <div className="pg-controls">
                <button className="pg-btn pg-arrow" disabled={page === 1} onClick={() => setPage(page - 1)}>‹ السابق</button>
                {pageWindow(page, pageCount).map((n, i) =>
                  n === '…'
                    ? <span key={`gap${i}`} className="pg-gap">…</span>
                    : <button key={n} className={`pg-btn pg-num${n === page ? ' active' : ''}`} onClick={() => setPage(n)}>{n}</button>
                )}
                <button className="pg-btn pg-arrow" disabled={page === pageCount} onClick={() => setPage(page + 1)}>التالي ›</button>
              </div>
            )}

            <select className="pg-select" value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}>
              {PER_PAGE_OPTIONS.map((n) => <option key={n} value={n}>{n} في الصفحة</option>)}
            </select>
          </div>
        )}
        </>
      )}
    </>
  );
}
