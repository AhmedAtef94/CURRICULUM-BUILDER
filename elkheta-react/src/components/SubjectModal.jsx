import { useState } from 'react';
import { sb } from '../supabaseClient';
import { useUI } from '../context/UIContext';
import { SUBJECT_COLORS, SUBJECT_NAMES, GRADES, TERMS } from '../lib/constants';

export default function SubjectModal({ mode, subject, existingCount, onClose, onSaved }) {
  const ui = useUI();
  const [name, setName] = useState(subject?.name || '');
  const [grade, setGrade] = useState(subject?.grade || '');
  const [term, setTerm] = useState(subject?.term || '');
  const [color, setColor] = useState(subject?.color || '#facc15');
  const [saving, setSaving] = useState(false);

  // preserve an existing custom name that isn't in the fixed list
  const nameOptions = subject?.name && !SUBJECT_NAMES.includes(subject.name)
    ? [subject.name, ...SUBJECT_NAMES] : SUBJECT_NAMES;

  async function save() {
    if (!name.trim()) { ui.toast('اسم المادة مطلوب', 'error'); return; }
    setSaving(true);
    try {
      const payload = { name: name.trim(), color, grade: grade || null, term: term || null };
      if (mode === 'edit') {
        const { data, error } = await sb.from('subjects').update(payload).eq('id', subject.id).select().single();
        if (error) throw error;
        onSaved(data);
      } else {
        const { data, error } = await sb.from('subjects').insert({ ...payload, position: existingCount }).select().single();
        if (error) throw error;
        onSaved(data);
      }
    } catch (e) {
      ui.toast('حفظ المادة: ' + (e.message || e), 'error');
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop-x" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box sm">
        <h2>{mode === 'edit' ? 'تعديل المادة' : 'مادة جديدة'}</h2>

        <div className="field">
          <label>اسم المادة</label>
          <select value={name} onChange={(e) => setName(e.target.value)}>
            <option value="">— اختر المادة —</option>
            {nameOptions.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        <div className="field">
          <label>السنة الدراسية والترم</label>
          <div className="au-grid">
            <select value={grade} onChange={(e) => setGrade(e.target.value)}>
              <option value="">— اختر السنة —</option>
              {GRADES.map((g) => <option key={g.code} value={g.code}>{g.code} — {g.label}</option>)}
            </select>
            <select value={term} onChange={(e) => setTerm(e.target.value)}>
              <option value="">— اختر الترم —</option>
              {TERMS.map((t) => <option key={t.code} value={t.code}>{t.code} — {t.label}</option>)}
            </select>
          </div>
        </div>

        <div className="field">
          <label>لون المادة</label>
          <div className="color-swatches">
            {SUBJECT_COLORS.map((c) => (
              <span key={c} className={'swatch ' + (c === color ? 'sel' : '')}
                style={{ background: c }} onClick={() => setColor(c)} />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn btn-slate" onClick={onClose}>إلغاء</button>
          <button className="btn btn-yellow" onClick={save} disabled={saving}>{saving ? 'جارٍ الحفظ…' : 'حفظ'}</button>
        </div>
      </div>
    </div>
  );
}
