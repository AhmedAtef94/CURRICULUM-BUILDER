import { useEffect, useState } from 'react';
import { sb } from '../supabaseClient';
import { useUI } from '../context/UIContext';
import { roleLabel } from '../lib/constants';

// Assign THIS subject to team members. Only `editor` is listed: that is the one
// role scoped by assignment — it decides both what they see and what they can
// edit. Managers reach every subject, and viewers read everything already.
export default function AssignModal({ subject, onClose }) {
  const ui = useUI();
  const [editors, setEditors] = useState([]);
  const [picked, setPicked] = useState(() => new Set());
  const [initial, setInitial] = useState(() => new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [profs, rows] = await Promise.all([
        sb.from('profiles').select('id, full_name, email, role').eq('role', 'editor'),
        sb.from('user_subjects').select('user_id').eq('subject_id', subject.id),
      ]);
      if (!alive) return;
      const err = profs.error || rows.error;
      if (err) { ui.toast('تحميل المستخدمين: ' + err.message, 'error'); setLoading(false); return; }
      const have = new Set((rows.data || []).map((r) => r.user_id));
      setEditors((profs.data || []).sort((a, b) =>
        (a.full_name || a.email || '').localeCompare(b.full_name || b.email || '', 'ar')));
      setPicked(new Set(have));
      setInitial(have);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [subject.id, ui]);

  const toggle = (id) =>
    setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const added = [...picked].filter((id) => !initial.has(id));
  const removed = [...initial].filter((id) => !picked.has(id));
  const dirty = added.length > 0 || removed.length > 0;

  async function save() {
    if (!dirty) { onClose(); return; }
    setSaving(true);
    try {
      if (added.length) {
        const { error } = await sb.from('user_subjects')
          .insert(added.map((uid) => ({ user_id: uid, subject_id: subject.id })));
        if (error) throw error;
      }
      if (removed.length) {
        const { error } = await sb.from('user_subjects')
          .delete().eq('subject_id', subject.id).in('user_id', removed);
        if (error) throw error;
      }
      ui.toast('تم حفظ الإسناد ✓', 'success');
      onClose();
    } catch (e) {
      ui.toast('حفظ الإسناد: ' + (e.message || e), 'error');
      setSaving(false);
    }
  }

  const q = search.trim().toLowerCase();
  const list = q
    ? editors.filter((u) =>
        (u.full_name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q))
    : editors;

  return (
    <div className="modal-backdrop-x" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <h2>إسناد «{subject.name}»</h2>
        <div className="muted" style={{ marginBottom: 14 }}>
          أعضاء الفريق اللي يشوفوا المادة دي ويعدّلوا فيها. عضو الفريق مش بيشوف
          غير المواد المسندة له. الأدمن والمشاهدة بيوصلوا لكل المواد أصلًا.
        </div>

        {loading ? (
          <div className="empty-state"><div className="loader-dots"><span /><span /><span /></div></div>
        ) : editors.length === 0 ? (
          <div className="muted" style={{ padding: '10px 0' }}>
            لا يوجد أعضاء فريق (دور «عضو فريق») — أضفهم من صفحة Teams &amp; Users الأول.
          </div>
        ) : (
          <>
            {editors.length > 6 && (
              <div className="field">
                <input placeholder="ابحث بالاسم أو البريد…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            )}
            <div className="assign-list">
              {list.length === 0 ? (
                <div className="muted" style={{ padding: '10px 4px' }}>لا توجد نتائج</div>
              ) : list.map((u) => {
                const on = picked.has(u.id);
                return (
                  <div key={u.id} className={'assign-row' + (on ? ' on' : '')} onClick={() => toggle(u.id)}>
                    <span className="opt-check">✓</span>
                    <div className="assign-meta">
                      <div className="assign-name">
                        {u.full_name || u.email} <span className="assign-role">{roleLabel(u.role)}</span>
                      </div>
                      {u.full_name && <div className="assign-mail">{u.email}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="muted" style={{ marginTop: 10 }}>
              {picked.size} من {editors.length} مُسند
              {dirty && ` — ${added.length} إضافة، ${removed.length} إزالة (لسه ماتحفظتش)`}
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn btn-slate" onClick={onClose} disabled={saving}>إلغاء</button>
          <button className="btn btn-yellow" onClick={save} disabled={saving || loading}>
            {saving ? 'جارٍ الحفظ…' : 'حفظ'}
          </button>
        </div>
      </div>
    </div>
  );
}
