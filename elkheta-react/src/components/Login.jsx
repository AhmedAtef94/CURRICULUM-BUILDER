import { useState } from 'react';
import { sb } from '../supabaseClient';
import { vName, vEmail, vPass, vPass2, mapAuthError } from '../lib/validation';

export default function Login() {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [f, setF] = useState({ name: '', email: '', pass: '', pass2: '' });
  const [e, setE] = useState({}); // field errors
  const [msg, setMsg] = useState({ text: '', kind: '' });
  const isSignup = mode === 'signup';

  const set = (k, v) => {
    setF((p) => ({ ...p, [k]: v }));
    // live validation
    setE((p) => {
      const n = { ...p };
      if (k === 'name') n.name = vName(v);
      if (k === 'email') n.email = vEmail(v);
      if (k === 'pass') n.pass = isSignup ? vPass(v) : (v ? '' : 'كلمة المرور مطلوبة');
      if (k === 'pass2') n.pass2 = vPass2(v, f.pass);
      return n;
    });
  };

  const cls = (k) => (e[k] ? 'invalid' : f[k] ? 'valid' : '');

  const toggle = (ev) => {
    ev.preventDefault();
    setMode(isSignup ? 'signin' : 'signup');
    setE({}); setMsg({ text: '', kind: '' });
  };

  async function signIn() {
    const errs = { email: vEmail(f.email), pass: f.pass ? '' : 'كلمة المرور مطلوبة' };
    setE(errs);
    if (errs.email || errs.pass) return setMsg({ text: 'راجِع الحقول المميّزة بالأحمر', kind: 'err' });
    setMsg({ text: 'جارٍ الدخول…', kind: '' });
    const { error } = await sb.auth.signInWithPassword({ email: f.email.trim(), password: f.pass });
    if (error) return setMsg({ text: 'فشل الدخول: ' + mapAuthError(error.message), kind: 'err' });
    setMsg({ text: 'تم ✓', kind: 'ok' });
  }

  async function signUp() {
    const errs = { name: vName(f.name), email: vEmail(f.email), pass: vPass(f.pass), pass2: vPass2(f.pass2, f.pass) };
    setE(errs);
    if (errs.name || errs.email || errs.pass || errs.pass2)
      return setMsg({ text: 'راجِع الحقول المميّزة بالأحمر', kind: 'err' });
    setMsg({ text: 'جارٍ إنشاء الحساب…', kind: '' });
    const { data, error } = await sb.auth.signUp({
      email: f.email.trim(), password: f.pass,
      options: { data: { full_name: f.name.trim() }, emailRedirectTo: window.location.href },
    });
    if (error) return setMsg({ text: 'فشل الإنشاء: ' + mapAuthError(error.message), kind: 'err' });
    if (data.session) setMsg({ text: 'تم إنشاء الحساب ✓', kind: 'ok' });
    else setMsg({ text: 'تم الإنشاء ✓ — راجع بريدك لتأكيد الحساب ثم سجّل الدخول.', kind: 'ok' });
  }

  async function forgot(ev) {
    ev.preventDefault();
    const err = vEmail(f.email);
    setE((p) => ({ ...p, email: err }));
    if (err) return setMsg({ text: 'اكتب بريدًا صحيحًا أولًا ثم اضغط «نسيت كلمة المرور»', kind: 'err' });
    setMsg({ text: 'جارٍ إرسال رابط الاستعادة…', kind: '' });
    const { error } = await sb.auth.resetPasswordForEmail(f.email.trim(), { redirectTo: window.location.href });
    if (error) return setMsg({ text: 'خطأ: ' + mapAuthError(error.message), kind: 'err' });
    setMsg({ text: 'تم إرسال رابط استعادة كلمة المرور إلى بريدك ✓', kind: 'ok' });
  }

  const submit = () => (isSignup ? signUp() : signIn());

  return (
    <div className="login-screen">
      <div className="login-card">
        <img src="/new-logo.png" alt="Elkheta" className="login-logo" />
        <h2>Elkheta Curriculum</h2>
        <p className="muted">{isSignup ? 'أنشئ حسابًا جديدًا' : 'سجّل الدخول للمتابعة'}</p>

        {isSignup && (
          <>
            <input placeholder="الاسم بالكامل" className={cls('name')} value={f.name}
              onChange={(ev) => set('name', ev.target.value)} autoComplete="name" />
            <div className="field-err">{e.name || ''}</div>
          </>
        )}

        <input type="email" placeholder="البريد الإلكتروني" className={cls('email')} value={f.email}
          onChange={(ev) => set('email', ev.target.value)} autoComplete="username" />
        <div className="field-err">{e.email || ''}</div>

        <input type="password" placeholder="كلمة المرور" className={cls('pass')} value={f.pass}
          onChange={(ev) => set('pass', ev.target.value)} autoComplete={isSignup ? 'new-password' : 'current-password'}
          onKeyDown={(ev) => ev.key === 'Enter' && !isSignup && submit()} />
        <div className="field-err">{e.pass || ''}</div>

        {isSignup && (
          <>
            <input type="password" placeholder="تأكيد كلمة المرور" className={cls('pass2')} value={f.pass2}
              onChange={(ev) => set('pass2', ev.target.value)} autoComplete="new-password" />
            <div className="field-err">{e.pass2 || ''}</div>
            <div className="rules-hint">🔒 كلمة المرور: 8 أحرف على الأقل، وتحتوي على حروف وأرقام.</div>
          </>
        )}

        <button className="btn btn-yellow primary" onClick={submit}>
          {isSignup ? 'إنشاء حساب' : 'تسجيل الدخول'}
        </button>

        <div className={'login-msg ' + msg.kind}>{msg.text}</div>

        <div style={{ marginTop: 14, fontSize: 13 }}>
          <a href="#" className="link" onClick={toggle}>
            {isSignup ? 'لديك حساب بالفعل؟ سجّل الدخول' : 'ليس لديك حساب؟ أنشئ حسابًا'}
          </a>
        </div>
        <div style={{ marginTop: 8, fontSize: 12 }}>
          <a href="#" className="muted link" onClick={forgot}>نسيت كلمة المرور؟</a>
        </div>
      </div>
    </div>
  );
}
