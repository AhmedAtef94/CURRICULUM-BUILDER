import { useState } from 'react';
import { sb } from '../supabaseClient';
import { useUI } from '../context/UIContext';
import { roleLabel } from '../lib/constants';
import { vName, vPass, vPass2, mapAuthError } from '../lib/validation';

export default function ProfileModal({ profile, onClose, onSaved }) {
  const ui = useUI();
  const [name, setName] = useState(profile.full_name || '');
  const [err, setErr] = useState({});
  const [saving, setSaving] = useState(false);

  // Password change is its own transaction — collapsed until asked for, and
  // gated on the current password so a walk-up on an open session can't do it.
  const [pwOpen, setPwOpen] = useState(false);
  const [cur, setCur] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  function closePw() {
    setPwOpen(false);
    setCur(''); setPass(''); setPass2('');
    setErr((p) => ({ ...p, cur: '', pass: '', pass2: '' }));
  }

  async function changePassword() {
    const e = { cur: cur ? '' : 'اكتب كلمة المرور الحالية', pass: vPass(pass), pass2: vPass2(pass2, pass) };
    if (!e.pass && pass === cur) e.pass = 'كلمة المرور الجديدة لازم تكون مختلفة عن الحالية';
    setErr((p) => ({ ...p, ...e }));
    if (e.cur || e.pass || e.pass2) return;

    setPwSaving(true);
    try {
      // Re-authenticate: Supabase has no built-in "verify current password".
      const { error: authErr } = await sb.auth.signInWithPassword({ email: profile.email, password: cur });
      if (authErr) {
        setErr((p) => ({ ...p, cur: 'كلمة المرور الحالية غير صحيحة' }));
        return;
      }
      const { error } = await sb.auth.updateUser({ password: pass });
      if (error) throw error;
      ui.toast('تم تغيير كلمة المرور ✓', 'success');
      closePw();
    } catch (ex) {
      ui.toast('خطأ: ' + mapAuthError(ex.message || String(ex)), 'error');
    } finally {
      setPwSaving(false);
    }
  }

  async function save() {
    const e = { name: vName(name) };
    setErr(e);
    if (e.name) return;

    setSaving(true);
    try {
      const nameChanged = name.trim() !== (profile.full_name || '');
      if (nameChanged) {
        const { error } = await sb.from('profiles').update({ full_name: name.trim() }).eq('id', profile.id);
        if (error) throw error;
        await sb.auth.updateUser({ data: { full_name: name.trim() } });
      }
      ui.toast('تم حفظ التغييرات ✓', 'success');
      await onSaved();
    } catch (ex) {
      ui.toast('خطأ: ' + (ex.message || ex), 'error');
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop-x" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box sm">
        <h2>الملف الشخصي</h2>

        <div className="field">
          <label>البريد الإلكتروني</label>
          <input value={profile.email || ''} disabled style={{ opacity: 0.7 }} />
          <div className="muted" style={{ marginTop: 4 }}>الدور: {roleLabel(profile.role)}</div>
        </div>

        <div className="field">
          <label>الاسم بالكامل</label>
          <input className={err.name ? 'invalid' : ''} value={name} onChange={(e) => { setName(e.target.value); setErr({ ...err, name: '' }); }} />
          {err.name && <div className="field-err">{err.name}</div>}
        </div>

        <div className="pw-section">
          {!pwOpen ? (
            <div className="pw-row">
              <div>
                <div className="pw-row-label">كلمة المرور</div>
                <div className="muted">••••••••</div>
              </div>
              <button className="btn btn-slate btn-sm" onClick={() => setPwOpen(true)}>تغيير</button>
            </div>
          ) : (
            <>
              <div className="pw-row-label" style={{ marginBottom: 12 }}>تغيير كلمة المرور</div>
              <div className="field">
                <label>كلمة المرور الحالية</label>
                <input type="password" className={err.cur ? 'invalid' : ''} value={cur} autoComplete="current-password"
                  onChange={(e) => { setCur(e.target.value); setErr({ ...err, cur: '' }); }} />
                {err.cur && <div className="field-err">{err.cur}</div>}
              </div>
              <div className="field">
                <label>كلمة المرور الجديدة</label>
                <input type="password" className={err.pass ? 'invalid' : ''} placeholder="8 أحرف + حروف وأرقام"
                  value={pass} autoComplete="new-password"
                  onChange={(e) => { setPass(e.target.value); setErr({ ...err, pass: '' }); }} />
                {err.pass && <div className="field-err">{err.pass}</div>}
              </div>
              <div className="field">
                <label>تأكيد كلمة المرور الجديدة</label>
                <input type="password" className={err.pass2 ? 'invalid' : ''} value={pass2} autoComplete="new-password"
                  onChange={(e) => { setPass2(e.target.value); setErr({ ...err, pass2: '' }); }} />
                {err.pass2 && <div className="field-err">{err.pass2}</div>}
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn btn-slate btn-sm" onClick={closePw} disabled={pwSaving}>إلغاء</button>
                <button className="btn btn-yellow btn-sm" onClick={changePassword} disabled={pwSaving}>
                  {pwSaving ? 'جارٍ التغيير…' : 'تغيير كلمة المرور'}
                </button>
              </div>
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn btn-slate" onClick={onClose}>إغلاق</button>
          <button className="btn btn-yellow" onClick={save} disabled={saving}>{saving ? 'جارٍ الحفظ…' : 'حفظ التغييرات'}</button>
        </div>
      </div>
    </div>
  );
}
