import { createContext, useContext, useMemo, useState, useCallback } from 'react';

const UIContext = createContext(null);
export const useUI = () => useContext(UIContext);

let _id = 0;

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);

  const toast = useCallback((message, type = 'info') => {
    const id = ++_id;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const confirm = useCallback((opts) => new Promise((resolve) => {
    setDialog({ kind: 'confirm', title: opts.title || 'تأكيد', message: opts.message || '', danger: opts.danger, confirmText: opts.confirmText, resolve });
  }), []);

  const alert = useCallback((opts) => new Promise((resolve) => {
    setDialog({ kind: 'confirm', title: opts.title || 'تنبيه', message: opts.message || '', okOnly: true, confirmText: opts.confirmText || 'تمام', resolve });
  }), []);

  const prompt = useCallback((opts) => new Promise((resolve) => {
    setDialog({ kind: 'prompt', title: opts.title || '', label: opts.label, defaultValue: opts.defaultValue || '',
      placeholder: opts.placeholder, inputType: opts.inputType || 'text', multiline: opts.multiline, validate: opts.validate, resolve });
  }), []);

  const close = useCallback(() => setDialog(null), []);

  // Must be memoised. A fresh object here re-runs every effect that depends on
  // `ui` — and this provider re-renders on every toast and every dialog. That
  // was silently reloading the whole subject tree (and re-collapsing it) each
  // time anything was added.
  const value = useMemo(() => ({ toast, confirm, alert, prompt }), [toast, confirm, alert, prompt]);

  return (
    <UIContext.Provider value={value}>
      {children}

      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className={'toast ' + t.type} onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>
            {t.message}
          </div>
        ))}
      </div>

      {dialog && dialog.kind === 'confirm' && <ConfirmDialog {...dialog} onClose={close} />}
      {dialog && dialog.kind === 'prompt' && <PromptDialog {...dialog} onClose={close} />}
    </UIContext.Provider>
  );
}

function ConfirmDialog({ title, message, danger, okOnly, confirmText, resolve, onClose }) {
  const done = (v) => { resolve(v); onClose(); };
  return (
    <div className="modal-backdrop-x" onMouseDown={(e) => e.target === e.currentTarget && done(false)}>
      <div className="modal-box sm">
        <h2>{title}</h2>
        <p style={{ whiteSpace: 'pre-line', color: 'var(--muted)', lineHeight: 1.7 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          {!okOnly && <button className="btn btn-slate" onClick={() => done(false)}>إلغاء</button>}
          <button className={'btn ' + (danger ? 'btn-soft-danger' : 'btn-yellow')} onClick={() => done(true)} autoFocus>
            {confirmText || (danger ? 'حذف' : 'تأكيد')}
          </button>
        </div>
      </div>
    </div>
  );
}

function PromptDialog({ title, label, defaultValue, placeholder, inputType, multiline, validate, resolve, onClose }) {
  const [val, setVal] = useState(defaultValue);
  const [err, setErr] = useState('');
  const done = (v) => { resolve(v); onClose(); };
  const submit = () => {
    if (validate) { const e = validate(val); if (e) { setErr(e); return; } }
    done(val);
  };
  return (
    <div className="modal-backdrop-x" onMouseDown={(e) => e.target === e.currentTarget && done(null)}>
      <div className="modal-box sm">
        {title && <h2>{title}</h2>}
        <div className="field">
          {label && <label>{label}</label>}
          {multiline ? (
            <textarea rows="3" value={val} placeholder={placeholder} autoFocus
              onChange={(e) => { setVal(e.target.value); setErr(''); }} />
          ) : (
            <input type={inputType} value={val} placeholder={placeholder} autoFocus
              className={err ? 'invalid' : ''}
              onChange={(e) => { setVal(e.target.value); setErr(''); }}
              onKeyDown={(e) => e.key === 'Enter' && submit()} />
          )}
          {err && <div className="field-err">{err}</div>}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
          <button className="btn btn-slate" onClick={() => done(null)}>إلغاء</button>
          <button className="btn btn-yellow" onClick={submit}>حفظ</button>
        </div>
      </div>
    </div>
  );
}
