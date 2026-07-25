import { roleLabel } from '../lib/constants';

// Vite fills BASE_URL with "/" in dev and "/<repo>/" on GitHub Pages, so a
// bare "/new-logo.png" (which resolves against the domain root) 404s once
// deployed under a sub-path.
const logo = import.meta.env.BASE_URL + 'new-logo.png';

export default function Sidebar({ profile, view, setView, onLogout, onOpenProfile }) {
  const initial = (profile.full_name || profile.email || '؟').trim().charAt(0).toUpperCase();
  return (
    <aside className="sidebar">
      <div
        className="sidebar-header"
        role="button"
        tabIndex={0}
        title="الصفحة الرئيسية"
        onClick={() => setView('curriculum')}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setView('curriculum'); } }}
      >
        <img src={logo} alt="Elkheta — الصفحة الرئيسية" className="sidebar-logo" />
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 6, letterSpacing: 1 }}>CURRICULUM BUILDER</div>
      </div>

      <div className="section-nav">
        <div className={'section-item ' + (view === 'curriculum' ? 'active' : '')} onClick={() => setView('curriculum')}>
          📚 المناهج
        </div>
        {profile.role === 'super_admin' && (
          <div className={'section-item ' + (view === 'users' ? 'active' : '')} onClick={() => setView('users')}>
            👥 Teams &amp; Users
          </div>
        )}
      </div>

      <div className="sidebar-nav" />

      <div className="user-chip">
        <div className="user-card" onClick={onOpenProfile} title="تعديل الملف الشخصي">
          <div className="user-avatar">{initial}</div>
          <div className="user-meta">
            <div className="user-name">{profile.full_name || profile.email}</div>
            <span className="role-badge">{roleLabel(profile.role)}</span>
          </div>
          <span className="user-gear">⚙️</span>
        </div>
        <button className="logout-btn" onClick={onLogout}>↩ تسجيل الخروج</button>
      </div>
    </aside>
  );
}
