import React from 'react';
import { AccessibleModal } from './UXKit';

export default function ActionNoticeModal({ notice, onClose }) {
  if (!notice) return null;

  const tone = notice.tone || 'blue';
  const toneClasses = {
    blue: 'border-blue-100 bg-blue-50 text-blue-700',
    green: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    rose: 'border-rose-100 bg-rose-50 text-rose-700',
  };

  return (
    <AccessibleModal open={Boolean(notice)} onClose={onClose} title={notice.title || 'Update'} description={notice.message} maxWidth="max-w-lg">
        <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${toneClasses[tone] || toneClasses.blue}`}>
          {notice.label || 'Invenia AI'}
        </div>
        {notice.details && (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
            {notice.details}
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-2xl bg-blue-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-800"
        >
          {notice.actionLabel || 'Continue'}
        </button>
    </AccessibleModal>
  );
}
