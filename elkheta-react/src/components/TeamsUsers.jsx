import { useEffect, useState, useCallback } from 'react';
import { sb } from '../supabaseClient';
import { useUI } from '../context/UIContext';
import { byPos } from '../lib/helpers';
import { ROLES, roleLabel } from '../lib/constants';
import { vName, vEmail, vPass } from '../lib/validation';

export default function TeamsUsers({ me }) {
  const ui = useUI();
  const [users, setUsers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [assignMap, setAssignMap] = useState({}); // userId -> Set(subjectId)
  const [loading, setLoading] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', pass: '', role: 'viewer', subs: [] });
  const [invalid, setInvalid] = useState({});
  const [msg, setMsg] = useState({ text: '', err: false });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: us }, { data: subs }, { data: assigns }] = await Promise.all([
      sb.from('profiles').select('*'),
      sb.from('subjects').select('*'),
      sb.from('user_subjects').select('*'),
    ]);
    const map = {};
    (assigns || []).forEach((a) => { (map[a.user_id] ||= new Set()).add(a.subject_id); });
    setUsers((us || []).sort((a, b) => (a.email || '').localeCompare(b.email || '')));
    setSubjects((subs || []).sort(byPos));
    setAssignMap(map);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createUser() {
    const errs = { name: vName(form.name), email: vEmail(form.email), pass: vPass(form.pass) };
    setInvalid(errs);
    const fieldName = { name: 'الاسم', email: 'البريد الإلكتروني', pass: 'كلمة المرور' };
    const bad = Object.keys(errs).find((k) => errs[k]);
    if (bad) { setMsg({ text: `⚠️ ${fieldName[bad]}: ${errs[bad]}`, err: true }); return; }
    setBusy(true); setMsg({ text: 'جارٍ الإنشاء…', err: false });
    try {
      const { data, error } = await sb.functions.invoke('create-user', {
        body: { email: form.email.trim(), password: form.pass, full_name: form.name.trim(), role: form.role, subject_ids: form.subs },
      });
      if (error) throw error;
      if (data?.error) { setMsg({ text: '⚠️ ' + data.error, err: true }); setBusy(false); return; }
      setForm({ name: '', email: '', pass: '', role: 'viewer', subs: [] });
      setInvalid({}); setMsg({ text: '', err: false }); setShowAdd(false);
      await load();
    } catch (e) {
      setMsg({ text: '⚠️ فشل الإنشاء: ' + (e.message || e) + ' — اتأكد إن الـ Edge Function متعملها Deploy.', err: true });
    } finally { setBusy(false); }
  }

  async function resetPassword(u) {
    const np = await ui.prompt({
      title: 'إعادة تعيين كلمة المرور',
      label: `كلمة المرور الجديدة لـ ${u.email}`,
      inputType: 'text',
      placeholder: '8 أحرف على الأقل + حروف وأرقام',
      validate: (v) => vPass(v),
    });
    if (np === null) return;
    try {
      const { data, error } = await sb.functions.invoke('create-user', { body: { action: 'reset', user_id: u.id, password: np } });
      if (error) throw error;
      if (data?.error) return ui.toast('خطأ: ' + data.error, 'error');
      await ui.alert({ title: 'تم تغيير كلمة المرور ✓', message: `اليوزر: ${u.email}\n\nكلمة المرور الجديدة:\n${np}\n\nشاركها معه — ويقدر يغيّرها بنفسه بعد كده.` });
    } catch (e) {
      ui.toast('فشل التغيير: ' + (e.message || e) + ' — اتأكد إنك عملت Re-deploy للـ Edge Function.', 'error');
    }
  }

  async function deleteUserConfirmed(u) {
    const ok = await ui.confirm({
      title: 'حذف اليوزر',
      message: `حذف: ${u.email}\n\n⚠️ ده هيحذف حسابه وكل صلاحياته نهائيًا ومش هينفع تراجع فيه.`,
      danger: true, confirmText: 'حذف نهائي',
    });
    if (!ok) return;
    try {
      const { data, error } = await sb.functions.invoke('create-user', { body: { action: 'delete', user_id: u.id } });
      if (error) throw error;
      if (data?.error) return ui.toast('خطأ: ' + data.error, 'error');
      ui.toast('تم حذف اليوزر', 'success');
      await load();
    } catch (e) {
      ui.toast('فشل الحذف: ' + (e.message || e) + ' — اتأكد إنك عملت Re-deploy للـ Edge Function.', 'error');
    }
  }

  async function changeRole(userId, role) {
    const { error } = await sb.from('profiles').update({ role }).eq('id', userId);
    if (error) return ui.toast('تغيير الدور: ' + error.message, 'error');
    await load();
  }

  async function toggleAssign(userId, subjectId, on) {
    if (on) {
      const { error } = await sb.from('user_subjects').insert({ user_id: userId, subject_id: subjectId });
      if (error) return ui.toast('إضافة تخصيص: ' + error.message, 'error');
    } else {
      const { error } = await sb.from('user_subjects').delete().eq('user_id', userId).eq('subject_id', subjectId);
      if (error) return ui.toast('إزالة تخصيص: ' + error.message, 'error');
    }
    await load();
  }

  const toggleFormSub = (id) =>
    setForm((p) => ({ ...p, subs: p.subs.includes(id) ? p.subs.filter((x) => x !== id) : [...p.subs, id] }));

  return (
    <>
      <div className="brand-header">
        <div><h1>Teams &amp; Users</h1><div className="sub">إدارة الفريق والصلاحيات</div></div>
      </div>

      {loading ? (
        <div className="empty-state"><div className="loader-dots"><span /><span /><span /></div></div>
      ) : (
        <div className="users-card">
          <div className="add-user-card">
            <button className="btn btn-yellow" onClick={() => setShowAdd((s) => !s)}>＋ إضافة يوزر جديد</button>
            {showAdd && (
              <div style={{ marginTop: 14 }}>
                <div className="au-grid">
                  <input placeholder="الاسم بالكامل" className={invalid.name ? 'invalid' : ''} value={form.name}
                    onChange={(e) => { setForm({ ...form, name: e.target.value }); setInvalid({ ...invalid, name: '' }); }} />
                  <input type="email" placeholder="البريد الإلكتروني" className={invalid.email ? 'invalid' : ''} value={form.email}
                    onChange={(e) => { setForm({ ...form, email: e.target.value }); setInvalid({ ...invalid, email: '' }); }} />
                  <input placeholder="كلمة المرور (8 أحرف + حروف وأرقام)" className={invalid.pass ? 'invalid' : ''} value={form.pass}
                    onChange={(e) => { setForm({ ...form, pass: e.target.value }); setInvalid({ ...invalid, pass: '' }); }} />
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    <option value="viewer">مشاهدة</option>
                    <option value="editor">عضو فريق</option>
                    <option value="admin">أدمن</option>
                    <option value="super_admin">سوبر أدمن</option>
                  </select>
                </div>
                {form.role === 'editor' && (
                  <div className="chk-row" style={{ marginTop: 10 }}>
                    {subjects.length === 0 ? <span className="muted">لا توجد مواد بعد</span> : subjects.map((s) => (
                      <label key={s.id}>
                        <input type="checkbox" checked={form.subs.includes(s.id)} onChange={() => toggleFormSub(s.id)} /> {s.name}
                      </label>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
                  <button className="btn btn-slate" onClick={createUser} disabled={busy}>إنشاء الحساب</button>
                  <span className={msg.err ? 'form-error' : 'muted'}>{msg.text}</span>
                </div>
              </div>
            )}
          </div>

          <table className="users-table">
            <thead>
              <tr><th>الاسم</th><th>الإيميل</th><th>الدور</th><th>المواد المخصصة</th><th></th></tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const mine = assignMap[u.id] || new Set();
                return (
                  <tr key={u.id}>
                    <td>{u.full_name || ''}</td>
                    <td>{u.email || ''}</td>
                    <td>
                      <select value={u.role} onChange={(e) => changeRole(u.id, e.target.value)}>
                        {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                      </select>
                    </td>
                    <td>
                      {u.role === 'editor' ? (
                        <div className="chk-row">
                          {subjects.length === 0 ? <span className="muted">لا مواد</span> : subjects.map((s) => (
                            <label key={s.id}>
                              <input type="checkbox" checked={mine.has(s.id)}
                                onChange={(e) => toggleAssign(u.id, s.id, e.target.checked)} /> {s.name}
                            </label>
                          ))}
                        </div>
                      ) : u.role === 'viewer' ? (
                        // Assignment only scopes editors. Point the admin at the
                        // one action that unlocks it instead of a dead dash.
                        <span className="muted">👁️ بيشوف كل المواد — غيّر الدور لـ «عضو فريق» عشان تسنده لمواد محددة</span>
                      ) : (
                        <span className="muted">— (الدور ده بيشوف الكل)</span>
                      )}
                    </td>
                    <td>
                      <div className="btn-group-x">
                        <button className="btn btn-slate btn-xs" title="تعيين كلمة مرور جديدة" onClick={() => resetPassword(u)}>🔑 كلمة السر</button>
                        {u.id !== me.id && <button className="btn btn-soft-danger btn-xs" onClick={() => deleteUserConfirmed(u)}>🗑 حذف</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
