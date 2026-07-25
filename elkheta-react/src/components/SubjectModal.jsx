import { useState } from 'react';
import { sb } from '../supabaseClient';
import { useUI } from '../context/UIContext';
import { SUBJECT_COLORS, SUBJECT_NAMES, GRADES, TERMS } from '../lib/constants';

export default function SubjectModal({ mode, subject, existingCount, subjects = [], onClose, onSaved }) {
  const ui = useUI();
  const [name, setName] = useState(subject?.name || '');
  const [grade, setGrade] = useState(subject?.grade || '');
  const [term, setTerm] = useState(subject?.term || '');
  const [color, setColor] = useState(subject?.color || '#facc15');
  const [err, setErr] = useState({}); // { name, grade, term }
  const [saving, setSaving] = useState(false);
  const clear = (k) => setErr((p) => (p[k] ? { ...p, [k]: '' } : p));

  // preserve an existing custom name that isn't in the fixed list
  const nameOptions = subject?.name && !SUBJECT_NAMES.includes(subject.name)
    ? [subject.name, ...SUBJECT_NAMES] : SUBJECT_NAMES;

  async function save() {
    // All three fields are required; colour always has a default.
    const e = {
      name: name.trim() ? '' : 'اختر اسم المادة',
      grade: grade ? '' : 'اختر السنة الدراسية',
      term: term ? '' : 'اختر الترم',
    };
    // Same name + grade + term = the same subject. Ignore the row being edited.
    if (!e.name && !e.grade && !e.term) {
      const dup = subjects.find((s) =>
        s.id !== subject?.id &&
        (s.name || '').trim() === name.trim() && s.grade === grade && s.term === term);
      if (dup) e.name = 'المادة دي موجودة بالفعل بنفس السنة والترم';
    }
    setErr(e);
    if (e.name || e.grade || e.term) return;

    setSaving(true);
    try {
      const payload = { name: name.trim(), color, grade, term };
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
          <select className={err.name ? 'invalid' : ''} value={name}
            onChange={(e) => { setName(e.target.value); clear('name'); }}>
            <option value="">— اختر المادة —</option>
            {nameOptions.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          {err.name && <div className="field-err">{err.name}</div>}
        </div>

        <div className="field">
          <label>السنة الدراسية والترم</label>
          <div className="au-grid">
            <select className={err.grade ? 'invalid' : ''} value={grade}
              onChange={(e) => { setGrade(e.target.value); clear('grade'); clear('name'); }}>
              <option value="">— اختر السنة —</option>
              {GRADES.map((g) => <option key={g.code} value={g.code}>{g.code} — {g.label}</option>)}
            </select>
            <select className={err.term ? 'invalid' : ''} value={term}
              onChange={(e) => { setTerm(e.target.value); clear('term'); clear('name'); }}>
              <option value="">— اختر الترم —</option>
              {TERMS.map((t) => <option key={t.code} value={t.code}>{t.code} — {t.label}</option>)}
            </select>
          </div>
          {(err.grade || err.term) && <div className="field-err">{err.grade || err.term}</div>}
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
