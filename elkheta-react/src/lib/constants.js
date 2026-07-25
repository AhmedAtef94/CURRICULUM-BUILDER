export const SUBJECT_COLORS = ['#facc15', '#3b82f6', '#22c55e', '#ef4444', '#a855f7', '#ec4899', '#14b8a6', '#f97316'];

export const GRADES = [
  { code: 'J4', label: 'رابعة ابتدائي' }, { code: 'J5', label: 'خامسة ابتدائي' }, { code: 'J6', label: 'سادسة ابتدائي' },
  { code: 'M1', label: 'أولى إعدادي' }, { code: 'M2', label: 'ثانية إعدادي' }, { code: 'M3', label: 'ثالثة إعدادي' },
  { code: 'S1', label: 'أولى ثانوي' }, { code: 'S2', label: 'ثانية ثانوي' }, { code: 'S3', label: 'ثالثة ثانوي' },
];

export const TERMS = [
  { code: 'T1', label: 'الترم الأول' }, { code: 'T2', label: 'الترم الثاني' }, { code: 'ALL', label: 'سنة كاملة' },
];

export const GRADE_BADGE = {
  J4: 'Primary 4', J5: 'Primary 5', J6: 'Primary 6',
  M1: 'Middle 1', M2: 'Middle 2', M3: 'Middle 3',
  S1: 'Senior 1', S2: 'Senior 2', S3: 'Senior 3',
};

export const TERM_LABEL = { T1: 'ترم أول', T2: 'ترم تاني', ALL: 'سنة كاملة' };

export const SUBJECT_NAMES = [
  'اللغة العربية', 'اللغة الإنجليزية', 'اللغة الألمانية', 'اللغة الفرنسية', 'اللغة الإيطالية',
  'الجغرافيا', 'الأحياء', 'Biology', 'الكيمياء', 'Chemistry', 'التاريخ',
  'العلوم المتكاملة', 'Integrated Science', 'الرياضيات', 'MATH', 'الفلسفة',
  'الفيزياء', 'PHYSICS', 'علم النفس والإجتماع', 'الإحصاء', 'statistcs',
  'العلوم', 'Science', 'الدراسات الإجتماعية', 'الحاسب الآلي', 'ICT',
];

export const ROLES = ['super_admin', 'admin', 'editor', 'viewer'];

export function roleLabel(r) {
  return { super_admin: 'سوبر أدمن', admin: 'أدمن', editor: 'عضو فريق', viewer: 'مشاهدة' }[r] || r;
}
