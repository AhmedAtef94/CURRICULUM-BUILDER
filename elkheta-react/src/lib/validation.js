export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const vName = (v) =>
  !v.trim() ? 'الاسم مطلوب' : v.trim().length < 3 ? 'الاسم قصير جدًا (3 أحرف على الأقل)' : '';

export const vEmail = (v) =>
  !v.trim() ? 'البريد الإلكتروني مطلوب' : !EMAIL_RE.test(v.trim()) ? 'صيغة البريد الإلكتروني غير صحيحة' : '';

export const vPass = (v) =>
  !v ? 'كلمة المرور مطلوبة'
    : v.length < 8 ? 'كلمة المرور 8 أحرف على الأقل'
    : !(/[A-Za-z؀-ۿ]/.test(v) && /[0-9]/.test(v)) ? 'لازم تحتوي على حروف وأرقام'
    : '';

export const vPass2 = (v, p) =>
  !v ? 'أعد كتابة كلمة المرور' : v !== p ? 'كلمتا المرور غير متطابقتين' : '';

export function mapAuthError(msg) {
  const m = (msg || '').toLowerCase();
  if (m.includes('invalid login')) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
  if (m.includes('email not confirmed')) return 'لازم تأكيد البريد الإلكتروني أولًا';
  if (m.includes('already registered') || m.includes('already been registered') || m.includes('user already'))
    return 'البريد الإلكتروني مسجّل بالفعل';
  if (m.includes('password')) return 'كلمة المرور ضعيفة أو غير صالحة';
  if (m.includes('rate limit') || m.includes('too many')) return 'محاولات كتير — استنى دقيقة وحاول تاني';
  if (m.includes('unable to validate email')) return 'صيغة البريد الإلكتروني غير صحيحة';
  return msg;
}
