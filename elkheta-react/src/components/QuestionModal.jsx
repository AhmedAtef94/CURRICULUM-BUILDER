import { useState } from 'react';
import { sb } from '../supabaseClient';
import { useUI } from '../context/UIContext';

export default function QuestionModal({ subjectId, chapterId, question, onClose, onSaved, nextPosition }) {
  const ui = useUI();
  const editing = !!question;
  const [type, setType] = useState(question?.type || 'essay');
  const [text, setText] = useState(question?.q || '');
  const [answer, setAnswer] = useState(question?.a || '');
  const [opts, setOpts] = useState(question?.options?.length ? question.options : ['', '', '', '']);
  const [correct, setCorrect] = useState(question?.correct || '');
  const [imgFile, setImgFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState({}); // { text, answer, options }
  const clear = (k) => setErr((p) => (p[k] ? { ...p, [k]: '' } : p));

  const setOpt = (i, v) => setOpts((p) => p.map((x, idx) => (idx === i ? v : x)));
  const hasImage = !!imgFile || !!question?.img;

  async function uploadImage(file) {
    const path = `${subjectId}/${chapterId}-${file.name}`.replace(/\s+/g, '_');
    const { error } = await sb.storage.from('question-images').upload(path, file, { upsert: true });
    if (error) throw error;
    return sb.storage.from('question-images').getPublicUrl(path).data.publicUrl;
  }

  async function save() {
    // Errors land under the field that caused them and stay until fixed.
    const e = {};
    // Text stays optional, but a question has to *be* something: either the
    // text or an attached image. Both empty means an empty question.
    if (!text.trim() && !hasImage) e.text = 'اكتب نص السؤال أو أرفق صورة — مينفعش السؤال يبقى فاضي';

    // Marking which choice is correct is enough — the choice texts themselves
    // are optional (they often live in the attached image).
    if (type === 'essay') {
      if (!answer.trim()) e.answer = 'الإجابة النموذجية مطلوبة';
    } else if (!correct) {
      e.options = 'علّم على الإجابة الصحيحة';
    }

    setErr(e);
    if (Object.keys(e).some((k) => e[k])) return;
    setSaving(true);
    try {
      let img = question?.img || '';
      if (imgFile) img = await uploadImage(imgFile);
      const payload = { type, q: text.trim(), img };
      if (type === 'essay') { payload.a = answer; payload.options = []; payload.correct = ''; }
      else { payload.options = opts; payload.correct = (correct || '').toUpperCase(); payload.a = ''; }

      let saved;
      if (editing) {
        const { data, error } = await sb.from('questions').update(payload).eq('id', question.id).select().single();
        if (error) throw error;
        saved = data;
      } else {
        const { data, error } = await sb.from('questions').insert({ ...payload, chapter_id: chapterId, position: nextPosition }).select().single();
        if (error) throw error;
        saved = data;
      }
      ui.toast('تم حفظ السؤال', 'success');
      onSaved(saved, editing);
    } catch (e) {
      ui.toast('حفظ السؤال: ' + (e.message || e), 'error');
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop-x" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <h2>{editing ? 'تعديل السؤال' : 'سؤال جديد'}</h2>

        <div className="field">
          <label>نوع السؤال</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="essay">سؤال مقالي</option>
            <option value="mcq">اختيار من متعدد (MCQ)</option>
          </select>
        </div>

        <div className="field">
          <label>نص السؤال {hasImage ? '(اختياري — فيه صورة)' : ''}</label>
          <textarea rows="3" className={err.text ? 'invalid' : ''} value={text}
            onChange={(e) => { setText(e.target.value); clear('text'); }} />
          {err.text && <div className="field-err">{err.text}</div>}
        </div>

        <div className="field">
          <label>إرفاق صورة (اختياري)</label>
          <input type="file" accept="image/*" onChange={(e) => { setImgFile(e.target.files[0]); clear('text'); }} />
          {question?.img && <div className="muted">صورة مرفقة حاليًا ✓ (ارفع صورة جديدة للاستبدال)</div>}
        </div>

        {type === 'essay' ? (
          <div className="field">
            <label>الإجابة النموذجية</label>
            <textarea rows="4" className={err.answer ? 'invalid' : ''} value={answer}
              onChange={(e) => { setAnswer(e.target.value); clear('answer'); }} />
            {err.answer && <div className="field-err">{err.answer}</div>}
          </div>
        ) : (
          <>
            <div className="field">
              <label>الاختيارات — علّم على الإجابة الصحيحة</label>
              {['A', 'B', 'C', 'D'].map((L, i) => (
                <div key={L} className={'opt-row' + (correct === L ? ' correct' : '')}>
                  <span
                    className="opt-check"
                    role="checkbox"
                    tabIndex={0}
                    aria-checked={correct === L}
                    aria-label={'الإجابة الصحيحة هي ' + L}
                    title="علّم كإجابة صحيحة"
                    style={{ cursor: 'pointer' }}
                    onClick={() => { setCorrect(correct === L ? '' : L); clear('options'); }}
                    onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setCorrect(correct === L ? '' : L); clear('options'); } }}
                  >✓</span>
                  <span className="opt-letter">{L}</span>
                  <input className="opt-input" placeholder={'الاختيار ' + L} value={opts[i]}
                    onChange={(e) => { setOpt(i, e.target.value); clear('options'); }} />
                </div>
              ))}
              {err.options && <div className="field-err">{err.options}</div>}
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn btn-slate" onClick={onClose}>إلغاء</button>
          <button className="btn btn-yellow" onClick={save} disabled={saving}>{saving ? 'جارٍ الحفظ…' : 'حفظ'}</button>
        </div>
      </div>
    </div>
  );
}
