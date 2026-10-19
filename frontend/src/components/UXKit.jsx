import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircleIcon,
  ClipboardDocumentIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

export function AccessibleModal({ open, title, description, children, onClose, maxWidth = 'max-w-2xl' }) {
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
      if (event.key !== 'Tab') return;
      const focusable = event.currentTarget?.querySelectorAll?.('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <section role="dialog" aria-modal="true" aria-labelledby="accessible-modal-title" aria-describedby={description ? 'accessible-modal-description' : undefined} className={`relative w-full ${maxWidth} rounded-[28px] border border-blue-100 bg-white p-6 shadow-2xl sm:p-8`}>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close dialog" className="absolute right-4 top-4 rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-700">
          <XMarkIcon className="h-5 w-5" />
        </button>
        <h2 id="accessible-modal-title" className="pr-12 text-2xl font-semibold text-slate-950">{title}</h2>
        {description && <p id="accessible-modal-description" className="mt-2 text-sm leading-6 text-slate-600">{description}</p>}
        <div className="mt-5">{children}</div>
      </section>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({ confirmation, onCancel, onConfirm }) {
  return (
    <AccessibleModal open={Boolean(confirmation)} onClose={onCancel} title={confirmation?.title || 'Confirm action'} description={confirmation?.message} maxWidth="max-w-lg">
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
        <button type="button" onClick={onConfirm} className={`rounded-2xl px-5 py-3 text-sm font-semibold text-white ${confirmation?.danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-900 hover:bg-blue-800'}`}>{confirmation?.confirmLabel || 'Confirm'}</button>
      </div>
    </AccessibleModal>
  );
}

export function JobIdChip({ value, className = '' }) {
  if (!value) return null;
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); } catch { /* Clipboard may be unavailable. */ }
  };
  return (
    <button type="button" onClick={copy} title="Copy Job ID" aria-label={`Copy Job ID ${value}`} className={`inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 font-mono text-[11px] font-semibold tracking-wide text-blue-800 hover:bg-blue-100 ${className}`}>
      {value}<ClipboardDocumentIcon className="h-3.5 w-3.5" />
    </button>
  );
}

export function KpiStrip({ items }) {
  return (
    <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 scrollbar-hidden lg:grid lg:grid-cols-3 lg:overflow-visible xl:grid-cols-6" aria-label="Key performance indicators">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <article key={item.label} className="min-w-[155px] snap-start rounded-[22px] border border-blue-100 bg-white p-4 shadow-sm lg:min-w-0">
            <div className={`inline-flex rounded-2xl p-2.5 ${item.tone}`}><Icon className="h-5 w-5" /></div>
            <p className="mt-3 text-2xl font-semibold text-slate-950">{item.value}</p>
            <p className="mt-1 text-xs font-medium text-slate-500">{item.label}</p>
          </article>
        );
      })}
    </div>
  );
}

export function PageSkeleton({ label = 'Loading workspace' }) {
  return (
    <div className="invenia-loader-stage min-h-screen" role="status" aria-live="polite" aria-label={label}>
      <div className="invenia-loader-orbit" aria-hidden="true">
        <span className="invenia-loader-dot invenia-loader-dot-one" />
        <span className="invenia-loader-dot invenia-loader-dot-two" />
        <span className="invenia-loader-dot invenia-loader-dot-three" />
        <div className="invenia-loader-mascot">
          <span className="invenia-loader-ear invenia-loader-ear-left" />
          <span className="invenia-loader-ear invenia-loader-ear-right" />
          <span className="invenia-loader-eye invenia-loader-eye-left" />
          <span className="invenia-loader-eye invenia-loader-eye-right" />
          <span className="invenia-loader-smile" />
          <span className="invenia-loader-page"><i /><i /><i /></span>
        </div>
      </div>
      <p className="invenia-loader-brand">INVENIA AI</p>
      <h1 className="invenia-loader-title">{label}</h1>
      <p className="invenia-loader-copy">Preparing a clear, secure workspace for you.</p>
      <div className="invenia-loader-track" aria-hidden="true"><span /></div>
    </div>
  );
}

export function GlobalNetworkIndicator() {
  const [activeRequests, setActiveRequests] = React.useState(0);
  const [visible, setVisible] = React.useState(false);

  useEffect(() => {
    const handleActivity = (event) => setActiveRequests(Number(event.detail?.count || 0));
    window.addEventListener('invenia:network-activity', handleActivity);
    return () => window.removeEventListener('invenia:network-activity', handleActivity);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(activeRequests > 0), activeRequests > 0 ? 450 : 0);
    return () => window.clearTimeout(timer);
  }, [activeRequests]);

  if (!visible || activeRequests <= 0) return null;
  return (
    <div className="fixed bottom-5 right-5 z-[150] flex items-center gap-3 rounded-2xl border border-blue-200 bg-white/95 px-4 py-3 text-sm font-semibold text-blue-950 shadow-[0_18px_50px_rgba(15,23,42,0.18)] backdrop-blur" role="status" aria-live="polite">
      <span className="invenia-network-mascot" aria-hidden="true"><i /><i /></span>
      <span><span className="block text-xs uppercase tracking-[0.16em] text-blue-600">Working securely</span>Updating your workspace...</span>
    </div>
  );
}

export function EmptyState({ title, message, action }) {
  return (
    <div className="rounded-[28px] border border-dashed border-blue-200 bg-blue-50/50 px-6 py-12 text-center">
      <CheckCircleIcon className="mx-auto h-10 w-10 text-blue-500" />
      <h3 className="mt-4 text-lg font-semibold text-slate-950">{title}</h3>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">{message}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ScoreHelp({ onClick, label = 'How scores work' }) {
  return <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900"><InformationCircleIcon className="h-4 w-4" />{label}</button>;
}

export function ScoreGlossary({ open, onClose }) {
  const scores = [
    ['Resume readiness', 'Resume completeness and general ATS readiness. It is not tied to one job.'],
    ['Profile match for this job', 'A discovery indicator based on profile skills and one job. It helps sort jobs before applying.'],
    ['CV evidence match', 'Evidence found in the submitted CV for one specific job. Missing evidence does not prove the candidate lacks a skill.'],
    ['Overall assessment score', 'Shown only after the compulsory interview and enabled rounds are complete. Until then, the status is Awaiting assessment.'],
  ];
  return (
    <AccessibleModal open={open} onClose={onClose} title="Understanding Invenia scores" description="Each score serves a different decision point and should not be interpreted as the same measurement.">
      <div className="grid gap-3 sm:grid-cols-2">
        {scores.map(([title, text]) => <div key={title} className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><p className="font-semibold text-slate-950">{title}</p><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></div>)}
      </div>
      <button type="button" onClick={onClose} className="mt-6 w-full rounded-2xl bg-blue-900 px-5 py-3 text-sm font-semibold text-white">Close</button>
    </AccessibleModal>
  );
}

export function ProfileAvatar({ src = '', name = 'User', className = 'h-12 w-12', textClassName = 'text-sm' }) {
  const [failedSrc, setFailedSrc] = React.useState('');
  const initials = String(name || 'User').split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className={`relative shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-blue-700 to-cyan-500 ${className}`}>
      {src && failedSrc !== src ? (
        <img src={src} alt={`${name} profile`} onError={() => setFailedSrc(src)} className="h-full w-full object-cover" />
      ) : (
        <div className={`flex h-full w-full items-center justify-center font-bold text-white ${textClassName}`}>{initials || 'U'}</div>
      )}
    </div>
  );
}

export function ProductTour({ open, steps = [], onClose }) {
  const [index, setIndex] = React.useState(0);
  const [spotlight, setSpotlight] = React.useState(null);
  const step = steps[index];

  useEffect(() => {
    if (!open) return undefined;
    setIndex(0);
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open || !step) return undefined;
    step.onEnter?.();
    const update = () => {
      const target = step.target ? document.querySelector(step.target) : null;
      target?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      const rect = target?.getBoundingClientRect?.();
      setSpotlight(rect ? { top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 } : null);
    };
    const renderTimer = window.setTimeout(update, 320);
    window.addEventListener('resize', update);
    return () => {
      window.clearTimeout(renderTimer);
      window.removeEventListener('resize', update);
    };
    // Steps are intentionally keyed by index; parent dashboards recreate labels during tab changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, open]);

  if (!open || !step || typeof document === 'undefined') return null;
  const finish = () => {
    localStorage.setItem('invenia-product-tour-seen', '1');
    onClose?.();
  };
  return createPortal(
    <div className="fixed inset-0 z-[150] bg-slate-950/65" role="dialog" aria-modal="true" aria-label="Product tour">
      {spotlight && <div className="pointer-events-none fixed rounded-[24px] border-4 border-cyan-300 shadow-[0_0_0_9999px_rgba(2,6,23,0.28),0_0_40px_rgba(103,232,249,0.7)]" style={spotlight} />}
      <div className="fixed bottom-5 left-1/2 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-[28px] border border-blue-100 bg-white p-6 shadow-2xl sm:bottom-8">
        <button type="button" onClick={finish} className="absolute right-4 top-4 rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Close product tour"><XMarkIcon className="h-5 w-5" /></button>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Step {index + 1} of {steps.length}</p>
        <h2 className="mt-2 pr-10 text-xl font-semibold text-slate-950">{step.title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{step.message}</p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <button type="button" onClick={finish} className="text-sm font-semibold text-slate-500 hover:text-slate-800">Skip tour</button>
          <div className="flex gap-2">
            {index > 0 && <button type="button" onClick={() => setIndex((value) => value - 1)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Back</button>}
            <button type="button" onClick={() => index === steps.length - 1 ? finish() : setIndex((value) => value + 1)} className="rounded-xl bg-blue-900 px-4 py-2 text-sm font-semibold text-white">{index === steps.length - 1 ? 'Finish' : 'Next'}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
