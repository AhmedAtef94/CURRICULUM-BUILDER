import { useEffect, useMemo, useState, useCallback } from 'react';
import { sb } from '../supabaseClient';
import { useUI } from '../context/UIContext';
import { byPos } from '../lib/helpers';
import Sidebar from './Sidebar';
import SubjectsGrid from './SubjectsGrid';
import SubjectContent from './SubjectContent';
import SubjectModal from './SubjectModal';
import TeamsUsers from './TeamsUsers';
import ProfileModal from './ProfileModal';

// Which screen the URL hash points at. Keeping this in the URL is what makes a
// refresh (and the browser's back/forward buttons) land where the user was
// instead of dumping them back on the subjects grid.
function readHash() {
  const h = window.location.hash || '';
  const m = h.match(/^#\/subject\/([^/?]+)/);
  if (m) return { view: 'curriculum', subjectId: decodeURIComponent(m[1]) };
  if (h.startsWith('#/users')) return { view: 'users', subjectId: null };
  return { view: 'curriculum', subjectId: null };
}
const go = (hash) => { window.location.hash = hash; };

export default function Dashboard({ profile, reloadProfile }) {
  const ui = useUI();
  const [route, setRoute] = useState(readHash);
  const [profileOpen, setProfileOpen] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [assigned, setAssigned] = useState(new Set());
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [subjectModal, setSubjectModal] = useState(null); // { mode, subject }

  const isContentManager = profile.role === 'super_admin' || profile.role === 'admin';
  const canEditSubject = (sid) => isContentManager || (profile.role === 'editor' && assigned.has(sid));

  const loadAll = useCallback(async () => {
    const [{ data: assigns }, { data: subs }, { data: lects }] = await Promise.all([
      sb.from('user_subjects').select('subject_id').eq('user_id', profile.id),
      sb.from('subjects').select('*'),
      sb.from('lectures').select('subject_id'),
    ]);
    setAssigned(new Set((assigns || []).map((a) => a.subject_id)));
    setSubjects((subs || []).sort(byPos));
    const c = {};
    (lects || []).forEach((l) => { c[l.subject_id] = (c[l.subject_id] || 0) + 1; });
    setCounts(c);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    const onHash = () => setRoute(readHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // The hash is user-controlled, so anyone could type #/users. Gate the route
  // itself, not just the sidebar link that leads to it.
  const canManageUsers = profile.role === 'super_admin';
  const view = route.view === 'users' && !canManageUsers ? 'curriculum' : route.view;
  useEffect(() => {
    if (route.view === 'users' && !canManageUsers) go('#/');
  }, [route.view, canManageUsers]);

  // An editor only ever sees the subjects assigned to them. The RLS policies
  // are what actually enforce this; filtering here keeps the UI honest and
  // stops a hand-typed #/subject/<id> from opening someone else's subject.
  const visibleSubjects = useMemo(
    () => (profile.role === 'editor' ? subjects.filter((s) => assigned.has(s.id)) : subjects),
    [subjects, assigned, profile.role],
  );

  // Derived, not stored: whatever the URL names, resolved against loaded data.
  // An unknown id (deleted subject, stale link) simply falls back to the grid.
  const selected = useMemo(
    () => (route.subjectId ? visibleSubjects.find((s) => s.id === route.subjectId) || null : null),
    [visibleSubjects, route.subjectId],
  );

  const logout = async () => { await sb.auth.signOut(); };

  const switchView = (v) => go(v === 'users' ? '#/users' : '#/');

  const openSubject = (s) => go('#/subject/' + s.id);
  // Coming back from a subject, only its own lesson count can have changed —
  // refresh that one number instead of reloading the whole dataset.
  const backToGrid = async () => {
    const sid = selected?.id;
    go('#/');
    if (!sid) return;
    const { count } = await sb.from('lectures').select('id', { count: 'exact', head: true }).eq('subject_id', sid);
    if (count != null) setCounts((prev) => ({ ...prev, [sid]: count }));
  };

  async function deleteSubject(subject) {
    const ok = await ui.confirm({ title: 'حذف المادة', message: `حذف «${subject.name}» وكل محتواها؟\nده إجراء نهائي.`, danger: true, confirmText: 'حذف المادة' });
    if (!ok) return;
    const { error } = await sb.from('subjects').delete().eq('id', subject.id);
    if (error) return ui.toast('خطأ في الحذف: ' + error.message, 'error');
    ui.toast('تم حذف المادة', 'success');
    go('#/');
    setSubjects((prev) => prev.filter((s) => s.id !== subject.id));
    setCounts((prev) => { const next = { ...prev }; delete next[subject.id]; return next; });
  }

  // Patch the row we just saved straight into state. A loadAll() here would
  // refetch every lecture in the database just to learn a new subject has none.
  function onSubjectSaved(saved) {
    setSubjectModal(null);
    if (!saved) return;
    setSubjects((prev) => {
      const known = prev.some((s) => s.id === saved.id);
      return (known ? prev.map((s) => (s.id === saved.id ? saved : s)) : [...prev, saved]).sort(byPos);
    });
    setCounts((prev) => (saved.id in prev ? prev : { ...prev, [saved.id]: 0 }));
    // `selected` reads through `subjects`, so the open subject refreshes itself.
  }

  return (
    <div className="app-shell">
      <Sidebar profile={profile} view={view} setView={switchView} onLogout={logout} onOpenProfile={() => setProfileOpen(true)} />

      <div className="main-wrap">
        <div className="workspace">
          {view === 'users' ? (
            <TeamsUsers me={profile} />
          ) : loading ? (
            <div className="empty-state"><div className="loader-dots"><span /><span /><span /></div></div>
          ) : selected ? (
            <SubjectContent
              subject={selected}
              canEdit={canEditSubject(selected.id)}
              isContentManager={isContentManager}
              canAssign={profile.role === 'super_admin'}
              onBack={backToGrid}
              onEditSubject={() => setSubjectModal({ mode: 'edit', subject: selected })}
              onDeleteSubject={() => deleteSubject(selected)}
            />
          ) : (
            <SubjectsGrid
              subjects={visibleSubjects}
              counts={counts}
              canEdit={canEditSubject}
              isContentManager={isContentManager}
              onOpen={openSubject}
              onAdd={() => setSubjectModal({ mode: 'add', subject: null })}
              onEdit={(s) => setSubjectModal({ mode: 'edit', subject: s })}
            />
          )}
        </div>
      </div>

      {subjectModal && (
        <SubjectModal
          mode={subjectModal.mode}
          subject={subjectModal.subject}
          existingCount={subjects.length}
          subjects={subjects}
          onClose={() => setSubjectModal(null)}
          onSaved={onSubjectSaved}
        />
      )}

      {profileOpen && (
        <ProfileModal
          profile={profile}
          onClose={() => setProfileOpen(false)}
          onSaved={async () => { await reloadProfile(); setProfileOpen(false); }}
        />
      )}
    </div>
  );
}
