import React, { useState, useEffect, useRef } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Info,
  AlertTriangle,
  X,
  Sparkles,
  Clock,
} from 'lucide-react';

const alertStyles = {
  info: {
    container:
      'bg-blue-50/95 dark:bg-blue-950/80 border-blue-200/90 dark:border-blue-800/80 text-blue-950 dark:text-blue-100 shadow-md shadow-blue-500/10',
    iconWrapper:
      'bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20',
    titleColor: 'text-blue-950 dark:text-blue-100',
    messageColor: 'text-blue-800 dark:text-blue-200',
    progressBar: 'bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-400',
    icon: Info,
    badgeText: 'Info',
    badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  },
  success: {
    container:
      'bg-emerald-50/95 dark:bg-emerald-950/80 border-emerald-200/90 dark:border-emerald-800/80 text-emerald-950 dark:text-emerald-100 shadow-md shadow-emerald-500/10',
    iconWrapper:
      'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20',
    titleColor: 'text-emerald-950 dark:text-emerald-100',
    messageColor: 'text-emerald-800 dark:text-emerald-200',
    progressBar: 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400',
    icon: CheckCircle2,
    badgeText: 'Success',
    badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  },
  warning: {
    container:
      'bg-amber-50/95 dark:bg-amber-950/80 border-amber-200/90 dark:border-amber-800/80 text-amber-950 dark:text-amber-100 shadow-md shadow-amber-500/10',
    iconWrapper:
      'bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20',
    titleColor: 'text-amber-950 dark:text-amber-100',
    messageColor: 'text-amber-800 dark:text-amber-200',
    progressBar: 'bg-gradient-to-r from-amber-500 via-orange-400 to-amber-400',
    icon: AlertTriangle,
    badgeText: 'Warning',
    badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  },
  error: {
    container:
      'bg-rose-50/95 dark:bg-rose-950/80 border-rose-200/90 dark:border-rose-800/80 text-rose-950 dark:text-rose-100 shadow-md shadow-rose-500/10',
    iconWrapper:
      'bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/20',
    titleColor: 'text-rose-950 dark:text-rose-100',
    messageColor: 'text-rose-800 dark:text-rose-200',
    progressBar: 'bg-gradient-to-r from-rose-500 via-red-500 to-rose-400',
    icon: AlertCircle,
    badgeText: 'Attention',
    badgeColor: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
  },
};

const Alert = ({
  type = 'info',
  title,
  message,
  onClose,
  autoClose,
  duration = 4500,
  showProgress = true,
  className = '',
  floating = false,
  maxWidth = 'sm:max-w-md',
}) => {
  // By default, success and info auto-close in 4.5s; warnings/errors stay until closed unless explicitly requested
  const shouldAutoClose =
    autoClose !== undefined
      ? Boolean(autoClose)
      : type === 'success' || type === 'info';

  const totalDuration = typeof autoClose === 'number' ? autoClose : duration;

  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [remainingTime, setRemainingTime] = useState(totalDuration);

  const lastTickRef = useRef(null);

  // Reset state when message or title changes
  useEffect(() => {
    setIsVisible(true);
    setIsExiting(false);
    setIsPaused(false);
    setRemainingTime(totalDuration);
  }, [message, title, totalDuration]);

  // Smooth countdown interval
  useEffect(() => {
    if (!shouldAutoClose || !isVisible || isExiting) return;

    lastTickRef.current = Date.now();

    const interval = setInterval(() => {
      if (!isPaused) {
        const now = Date.now();
        const delta = now - (lastTickRef.current || now);
        lastTickRef.current = now;

        setRemainingTime((prev) => {
          const next = prev - delta;
          if (next <= 0) {
            clearInterval(interval);
            triggerDismiss();
            return 0;
          }
          return next;
        });
      } else {
        lastTickRef.current = Date.now();
      }
    }, 40);

    return () => clearInterval(interval);
  }, [shouldAutoClose, isVisible, isExiting, isPaused]);

  const triggerDismiss = () => {
    if (isExiting) return;
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      if (onClose) onClose();
    }, 350);
  };

  if (!isVisible) return null;

  const current = alertStyles[type] || alertStyles.info;
  const IconComponent = current.icon;
  const progressPercent = Math.max(
    0,
    Math.min(100, (remainingTime / totalDuration) * 100)
  );

  const positionClasses = floating
    ? `fixed top-6 right-6 z-50 shadow-2xl w-[calc(100%-2rem)] sm:w-auto sm:min-w-[320px] ${maxWidth}`
    : `w-full sm:w-fit sm:min-w-[320px] ${maxWidth}`;

  return (
    <div
      role="alert"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={`group relative overflow-hidden rounded-2xl border backdrop-blur-md transition-all duration-350 ease-out transform ${positionClasses} ${
        isExiting
          ? 'opacity-0 -translate-y-2 scale-95 pointer-events-none'
          : 'opacity-100 translate-y-0 scale-100 hover:-translate-y-0.5 hover:shadow-lg'
      } ${current.container} ${className}`}
    >
      <div className="flex items-start gap-3 p-3.5 sm:p-4">
        {/* Animated Icon Avatar */}
        <div
          className={`p-2 rounded-xl shrink-0 transition-transform duration-200 group-hover:scale-105 ${current.iconWrapper}`}
        >
          <IconComponent className="w-4.5 h-4.5 animate-in fade-in" />
        </div>

        {/* Text Content */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            {title && (
              <h4 className={`font-bold text-xs sm:text-sm leading-tight tracking-tight ${current.titleColor}`}>
                {title}
              </h4>
            )}
            {shouldAutoClose && (
              <span
                className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 transition-opacity ${
                  isPaused ? 'opacity-100 ring-1 ring-black/10' : 'opacity-80'
                } ${current.badgeColor}`}
                title={isPaused ? 'Timer paused (hovering)' : 'Auto-dismissing'}
              >
                {isPaused ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Paused
                  </>
                ) : (
                  <>
                    <Clock className="w-2.5 h-2.5" />
                    {Math.ceil(remainingTime / 1000)}s
                  </>
                )}
              </span>
            )}
          </div>
          <div className={`text-xs leading-relaxed ${current.messageColor}`}>
            {message}
          </div>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={triggerDismiss}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 transition-all active:scale-90 shrink-0"
          title="Dismiss notification"
          aria-label="Close notification"
        >
          <X className="w-3.5 h-3.5 transition-transform duration-200 group-hover:rotate-90" />
        </button>
      </div>

      {/* Remarkable Countdown Progress Line */}
      {shouldAutoClose && showProgress && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/5 dark:bg-white/10 overflow-hidden">
          <div
            className={`h-full transition-all duration-75 ease-linear ${current.progressBar}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default Alert;
