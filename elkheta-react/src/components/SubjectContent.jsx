import { useEffect, useMemo, useState, useCallback } from 'react';
import { sb } from '../supabaseClient';
import { useUI } from '../context/UIContext';
import { sortTree, fmtDate } from '../lib/helpers';
import { GRADE_BADGE, TERM_LABEL } from '../lib/constants';
import QuestionModal from './QuestionModal';
import AssignModal from './AssignModal';

// New nodes need the empty child array their sub-items will render from.
const CHILD_KEY = { lectures: 'topics', topics: 'chapters', chapters: 'questions', questions: null };
const PARENT_FK = { topics: 'lecture_id', chapters: 'topic_id', questions: 'chapter_id' };

// Immutable tree edits so a single save doesn't refetch the whole subject.
function insertNode(tree, table, row) {
  const node = CHILD_KEY[table] ? { ...row, [CHILD_KEY[table]]: [] } : { ...row };
  if (table === 'lectures') return [...tree, node];
  const fk = PARENT_FK[table];
  const walk = (nodes, parentTable) =>
    nodes.map((n) => {
      if (parentTable === childParentOf(table) && n.id === row[fk]) {
        const key = CHILD_KEY[parentTable];
        return { ...n, [key]: [...n[key], node] };
      }
      const key = CHILD_KEY[parentTable];
      return key && n[key] ? { ...n, [key]: walk(n[key], childOf(parentTable)) } : n;
    });
  return walk(tree, 'lectures');
}
function updateNode(tree, table, row) {
  const walk = (nodes, t) =>
    nodes.map((n) => {
      const next = t === table && n.id === row.id ? { ...n, ...row } : n;
      const key = CHILD_KEY[t];
      return key && next[key] ? { ...next, [key]: walk(next[key], childOf(t)) } : next;
    });
  return walk(tree, 'lectures');
}
function deleteNode(tree, table, id) {
  const walk = (nodes, t) => {
    const filtered = t === table ? nodes.filter((n) => n.id !== id) : nodes;
    return filtered.map((n) => {
      const key = CHILD_KEY[t];
      return key && n[key] ? { ...n, [key]: walk(n[key], childOf(t)) } : n;
    });
  };
  return walk(tree, 'lectures');
}
// Every node id in the tree, for the fold-everything toggle and the initial state.
const allIds = (tree) =>
  tree.flatMap((l) => [
    l.id,
    ...l.topics.flatMap((tp) => [
      tp.id,
      ...tp.chapters.flatMap((c) => [c.id, ...c.questions.map((q) => q.id)]),
    ]),
  ]);

// "added <date> — by <name>". Rows created before the created_by migration
// simply have no name, so that half is left off rather than faked.
function Meta({ node, verb = 'أُضيف' }) {
  if (!node.created_at) return null;
  return (
    <div className="added-date">
      🕓 {verb}: {fmtDate(node.created_at)}
      {node.created_by_name && <> — بواسطة <b>{node.created_by_name}</b></>}
    </div>
  );
}

const ORDER = ['lectures', 'topics', 'chapters', 'questions'];
const childOf = (t) => ORDER[ORDER.indexOf(t) + 1];
const childParentOf = (table) => ORDER[ORDER.indexOf(table) - 1];

export default function SubjectContent({ subject, canEdit, isContentManager, canAssign, onBack, onEditSubject, onDeleteSubject }) {
  const ui = useUI();
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [qModal, setQModal] = useState(null); // { chapterId, question }
  const [assignOpen, setAssignOpen] = useState(false);

  const loadTree = useCallback(async () => {
    setLoading(true);
    const { data, error } = await sb
      .from('lectures')
      .select('*, topics(*, chapters(*, questions(*)))')
      .eq('subject_id', subject.id);
    if (error) { ui.toast('تحميل المحتوى: ' + error.message, 'error'); setLoading(false); return; }
    const sorted = sortTree(data);
    setTree(sorted);
    // Everything starts folded: the subject opens as a short list of lecture
    // titles, and images only load for whatever the user chooses to open.
    setCollapsed(new Set(allIds(sorted)));
    setLoading(false);
  }, [subject.id, ui]);

  useEffect(() => { loadTree(); }, [loadTree]);

  const isC = (id) => collapsed.has(id);
  const toggle = (id) => setCollapsed((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const everyId = useMemo(() => allIds(tree), [tree]);
  const allCollapsed = everyId.length > 0 && everyId.every((id) => collapsed.has(id));
  const toggleEverything = () => setCollapsed(allCollapsed ? new Set() : new Set(everyId));

  // Fold every question in a chapter at once; the button flips once they all are.
  const allQCollapsed = (c) => c.questions.length > 0 && c.questions.every((q) => collapsed.has(q.id));
  const toggleAllQuestions = (c) => {
    const open = allQCollapsed(c);
    setCollapsed((p) => {
      const n = new Set(p);
      c.questions.forEach((q) => (open ? n.delete(q.id) : n.add(q.id)));
      return n;
    });
  };

  // ---- CRUD — patch local state instead of refetching the whole tree ----
  async function ins(table, row, ctx) {
    const { data, error } = await sb.from(table).insert(row).select().single();
    if (error) return ui.toast(ctx + ': ' + error.message, 'error');
    setTree((t) => insertNode(t, table, data));
    // Whatever you just created opens, and stays open until you fold it,
    // reload, or leave the subject.
    setCollapsed((p) => { const n = new Set(p); n.delete(data.id); return n; });
  }
  async function upd(table, id, row, ctx) {
    const { data, error } = await sb.from(table).update(row).eq('id', id).select().single();
    if (error) return ui.toast(ctx + ': ' + error.message, 'error');
    setTree((t) => updateNode(t, table, data));
  }
  async function del(table, id, label) {
    const ok = await ui.confirm({ title: 'تأكيد الحذف', message: `حذف ${label}؟`, danger: true });
    if (!ok) return;
    const { error } = await sb.from(table).delete().eq('id', id);
    if (error) return ui.toast('حذف: ' + error.message, 'error');
    setTree((t) => deleteNode(t, table, id));
  }
  const askTitle = (title, label, def = '') => ui.prompt({ title, label, defaultValue: def, validate: (v) => (v.trim() ? '' : 'العنوان مطلوب') });

  const addLecture = async () => { const t = await askTitle('محاضرة جديدة', 'عنوان المحاضرة'); if (t) ins('lectures', { subject_id: subject.id, title: t.trim(), position: tree.length }, 'إضافة محاضرة'); };
  const editLecture = async (l) => { const t = await askTitle('تعديل المحاضرة', 'العنوان', l.title); if (t) upd('lectures', l.id, { title: t.trim() }, 'تعديل'); };
  const addTopic = async (l) => { const t = await askTitle('موضوع جديد', 'عنوان الموضوع'); if (t) ins('topics', { lecture_id: l.id, title: t.trim(), position: l.topics.length }, 'إضافة موضوع'); };
  const editTopic = async (tp) => { const t = await askTitle('تعديل الموضوع', 'العنوان', tp.title); if (t) upd('topics', tp.id, { title: t.trim() }, 'تعديل'); };
  const addChapter = async (tp) => { const t = await askTitle('فصل جديد', 'عنوان الفصل'); if (t) ins('chapters', { topic_id: tp.id, title: t.trim(), position: tp.chapters.length }, 'إضافة فصل'); };
  const editChapter = async (c) => { const t = await askTitle('تعديل الفصل', 'العنوان', c.title); if (t) upd('chapters', c.id, { title: t.trim() }, 'تعديل'); };
  const setChapterTime = async (c) => {
    const s = await ui.prompt({ title: 'توقيت الفصل', label: 'وقت البداية', defaultValue: c.start_time || '', placeholder: 'مثال: 0:00' });
    if (s === null) return;
    const e = await ui.prompt({ title: 'توقيت الفصل', label: 'وقت النهاية', defaultValue: c.end_time || '', placeholder: 'مثال: 12:30' });
    if (e === null) return;
    upd('chapters', c.id, { start_time: s, end_time: e }, 'تعديل الوقت');
  };

  const badges = [GRADE_BADGE[subject.grade], TERM_LABEL[subject.term]].filter(Boolean).join(' • ');

  return (
    <>
      <div className="brand-header">
        <div><h1>{subject.name}</h1><div className="sub">{badges || 'الدروس والأسئلة'}</div></div>
      </div>

      <div className="subject-content-head">
        <button className="back-btn" onClick={onBack}>→ كل المواد</button>
        <div style={{ flex: 1, fontWeight: 800, fontSize: '1.1rem' }}>{subject.name}</div>
        {(isContentManager || canAssign) && (
          <div className="btn-group-x">
            {canAssign && <button className="btn btn-slate btn-xs" onClick={() => setAssignOpen(true)}>👤 إسناد لعضو</button>}
            {isContentManager && <button className="btn btn-soft-edit btn-xs" onClick={onEditSubject}>تعديل المادة</button>}
            {isContentManager && <button className="btn btn-soft-danger btn-xs" onClick={onDeleteSubject}>حذف المادة</button>}
          </div>
        )}
      </div>

      {(canEdit || tree.length > 0) && (
        <div className="btn-group-x" style={{ marginBottom: 18, alignItems: 'center' }}>
          {canEdit && <button className="btn btn-yellow" style={{ padding: '12px 26px' }} onClick={addLecture}>+ محاضرة جديدة</button>}
          {tree.length > 0 && (
            <button className="btn btn-slate" style={{ padding: '12px 20px' }} onClick={toggleEverything}>
              {allCollapsed ? '▼ فتح الكل' : '▲ طي الكل'}
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="empty-state"><div className="loader-dots"><span /><span /><span /></div></div>
      ) : tree.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">{canEdit ? '📝' : '📭'}</div>
          <div className="empty-title">{canEdit ? 'المادة فاضية' : 'لا يوجد محتوى بعد'}</div>
          <div className="empty-sub">{canEdit ? 'ابدأ ببناء المنهج — أضف أول محاضرة.' : 'لسه ماتضافش محتوى في المادة دي.'}</div>
        </div>
      ) : (
        tree.map((lec, i) => (
          <div className="lecture-card" key={lec.id}>
            <div className="clickable-header lecture-header-box">
              <div onClick={() => toggle(lec.id)} style={{ flexGrow: 1 }}>
                <h2>محاضرة {i + 1}: {lec.title} {isC(lec.id) ? '▼' : '▲'}</h2>
                <Meta node={lec} verb="أُضيفت" />
              </div>
              {canEdit && (
                <div className="btn-group-x">
                  <button className="btn btn-soft-edit btn-xs" onClick={() => editLecture(lec)}>تعديل</button>
                  <button className="btn btn-soft-danger btn-xs" onClick={() => del('lectures', lec.id, 'المحاضرة وكل محتواها')}>حذف</button>
                </div>
              )}
            </div>
            {!isC(lec.id) && (
              <div className="collapsible">
                {canEdit && <button className="btn btn-yellow btn-xs" style={{ margin: '10px 0 0' }} onClick={() => addTopic(lec)}>+ موضوع</button>}
                {lec.topics.map((tp) => (
                  <div className="topic-box" key={tp.id}>
                    <div className="clickable-header">
                      <div onClick={() => toggle(tp.id)} style={{ flexGrow: 1 }}>
                        <h3>موضوع: {tp.title} {isC(tp.id) ? '▼' : '▲'}</h3>
                        <Meta node={tp} />
                      </div>
                      {canEdit && (
                        <div className="btn-group-x">
                          <button className="btn btn-soft-edit btn-xs" onClick={() => editTopic(tp)}>تعديل</button>
                          <button className="btn btn-soft-danger btn-xs" onClick={() => del('topics', tp.id, 'الموضوع وكل محتواه')}>×</button>
                        </div>
                      )}
                    </div>
                    {!isC(tp.id) && (
                      <div className="collapsible">
                        {canEdit && <button className="btn btn-slate btn-xs" style={{ marginBottom: 10 }} onClick={() => addChapter(tp)}>+ فصل</button>}
                        {tp.chapters.map((c) => (
                          <div className="chapter-box" key={c.id}>
                            <div className="clickable-header">
                              <div onClick={() => toggle(c.id)} style={{ flexGrow: 1 }}>
                                <h4>
                                  {c.title}{' '}
                                  {(c.start_time || c.end_time) && (
                                    <span className="time-tag">⏱ {c.start_time || '...'} - {c.end_time || '...'}</span>
                                  )}{' '}
                                  {isC(c.id) ? '▼' : '▲'}
                                </h4>
                                <Meta node={c} />
                              </div>
                              {canEdit && (
                                <div className="btn-group-x">
                                  <button className="btn btn-slate btn-xs" onClick={() => setChapterTime(c)}>الوقت</button>
                                  <button className="btn btn-soft-edit btn-xs" onClick={() => editChapter(c)}>✎</button>
                                  <button className="btn btn-soft-danger btn-xs" onClick={() => del('chapters', c.id, 'الفصل وكل أسئلته')}>×</button>
                                </div>
                              )}
                            </div>
                            {!isC(c.id) && (
                              <div className="collapsible">
                                <div className="btn-group-x" style={{ marginBottom: 4 }}>
                                  {canEdit && <button className="btn btn-yellow btn-xs" onClick={() => setQModal({ chapterId: c.id, question: null })}>+ سؤال</button>}
                                  {c.questions.length > 0 && (
                                    <button className="btn btn-slate btn-xs" onClick={() => toggleAllQuestions(c)}>
                                      {allQCollapsed(c) ? '▼ فتح كل الأسئلة' : '▲ طي كل الأسئلة'}
                                    </button>
                                  )}
                                </div>
                                {c.questions.map((q, qi) => (
                                  <Question key={q.id} q={q} num={qi + 1} canEdit={canEdit}
                                    collapsed={isC(q.id)} onToggle={() => toggle(q.id)}
                                    onEdit={() => setQModal({ chapterId: c.id, question: q })}
                                    onDelete={() => del('questions', q.id, 'السؤال')} />
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}

      {assignOpen && <AssignModal subject={subject} onClose={() => setAssignOpen(false)} />}

      {qModal && (
        <QuestionModal
          subjectId={subject.id}
          chapterId={qModal.chapterId}
          question={qModal.question}
          onClose={() => setQModal(null)}
          onSaved={(saved, editing) => {
            setQModal(null);
            setTree((t) => (editing ? updateNode(t, 'questions', saved) : insertNode(t, 'questions', saved)));
            // Show the result — a just-saved question (and its image) stays open.
            setCollapsed((p) => { const n = new Set(p); n.delete(saved.id); return n; });
          }}
          nextPosition={
            (tree.flatMap((l) => l.topics).flatMap((t) => t.chapters).find((c) => c.id === qModal.chapterId)?.questions.length) || 0
          }
        />
      )}
    </>
  );
}

function Question({ q, num, canEdit, collapsed, onToggle, onEdit, onDelete }) {
  const opts = q.options || [];
  // Text is optional, so fall back to something meaningful for the folded row.
  const title = q.q?.trim() || (q.img ? 'سؤال بصورة' : 'سؤال بدون نص');
  return (
    <div className="question-item">
      <div className="q-head">
        <div className="q-head-main" onClick={onToggle} title={collapsed ? 'فتح السؤال' : 'طي السؤال'}>
          <span className="q-caret">{collapsed ? '▼' : '▲'}</span>
          <span className="q-num">{num}</span>
          <span className={'q-tag ' + (q.type === 'essay' ? 'tag-essay' : 'tag-mcq')}>{q.type.toUpperCase()}</span>
          <span className={'q-title' + (q.q?.trim() ? '' : ' placeholder')}>{title}</span>
        </div>
        {canEdit && (
          <div className="btn-group-x">
            <button className="btn btn-soft-edit btn-xs" onClick={onEdit}>تعديل</button>
            <button className="btn btn-soft-danger btn-xs" onClick={onDelete}>×</button>
          </div>
        )}
      </div>
      {!collapsed && (
        <>
      <Meta node={q} />
      {q.img && (
        <div className="question-img-wrap">
          {/* Off-screen questions shouldn't block the first paint. */}
          <img src={q.img} className="question-img" alt="" loading="lazy" decoding="async" />
          <a className="btn btn-xs" style={{ background: '#10b981', color: '#fff' }} href={q.img} target="_blank" rel="noreferrer">تحميل الصورة</a>
        </div>
      )}
      {q.type === 'essay' ? (
        <div className="ans-box"><strong>الإجابة النموذجية:</strong> {q.a}</div>
      ) : (
        <div style={{ marginTop: 10 }}>
          {['A', 'B', 'C', 'D'].map((L, i) => (
            <div key={L} className={'opt-row' + (q.correct === L ? ' correct' : '')}>
              <span className="opt-check">✓</span>
              <span className="opt-letter">{L}</span>
              <span className={'opt-text' + (opts[i] ? '' : ' empty')}>{opts[i] || '—'}</span>
            </div>
          ))}
        </div>
      )}
        </>
      )}
    </div>
  );
}
