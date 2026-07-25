import { useEffect, useState, useCallback } from 'react';
import { sb } from './supabaseClient';
import { useUI } from './context/UIContext';
import { vPass } from './lib/validation';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

function FullLoader() {
  return (
    <div className="login-screen">
      <div className="loader-dots"><span /><span /><span /></div>
    </div>
  );
}

export default function App() {
  const ui = useUI();
  const [session, setSession] = useState(undefined); // undefined = still loading
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = sb.auth.onAuthStateChange(async (event, s) => {
      if (event === 'PASSWORD_RECOVERY') {
        const np = await ui.prompt({
          title: 'إعادة تعيين كلمة المرور',
          label: 'كلمة المرور الجديدة',
          inputType: 'password',
          placeholder: '8 أحرف على الأقل + حروف وأرقام',
          validate: (v) => vPass(v),
        });
        if (np) {
          const { error } = await sb.auth.updateUser({ password: np });
          ui.toast(error ? 'خطأ: ' + error.message : 'تم تحديث كلمة المرور ✓', error ? 'error' : 'success');
        }
      }
      setSession(s);
    });
    return () => listener.subscription.unsubscribe();
  }, [ui]);

  const reloadProfile = useCallback(async () => {
    if (!session) return;
    const { data } = await sb.from('profiles').select('*').eq('id', session.user.id).single();
    if (data) setProfile(data);
  }, [session]);

  useEffect(() => {
    if (!session) { setProfile(null); return; }
    let alive = true;
    sb.from('profiles').select('*').eq('id', session.user.id).single()
      .then(({ data }) => { if (alive) setProfile(data); });
    return () => { alive = false; };
  }, [session]);

  if (session === undefined) return <FullLoader />;
  if (!session) return <Login />;
  if (!profile) return <FullLoader />;
  return <Dashboard profile={profile} reloadProfile={reloadProfile} />;
}
