import React from 'react';
import { Verdict } from '../types';
import { CheckCircle2, XCircle, Clock, AlertTriangle, AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  status: Verdict;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const VerdictBadge: React.FC<Props> = ({ status, size = 'md', showLabel = true }) => {
  const getVerdictConfig = () => {
    switch (status) {
      case 'AC':
        return {
          label: 'Accepted (AC)',
          className: 'badge-ac',
          icon: <CheckCircle2 size={size === 'sm' ? 12 : 16} />
        };
      case 'WA':
        return {
          label: 'Wrong Answer (WA)',
          className: 'badge-wa',
          icon: <XCircle size={size === 'sm' ? 12 : 16} />
        };
      case 'TLE':
        return {
          label: 'Time Limit (TLE)',
          className: 'badge-tle',
          icon: <Clock size={size === 'sm' ? 12 : 16} />
        };
      case 'MLE':
        return {
          label: 'Memory Limit (MLE)',
          className: 'badge-mle',
          icon: <AlertTriangle size={size === 'sm' ? 12 : 16} />
        };
      case 'RE':
        return {
          label: 'Runtime Error (RE)',
          className: 'badge-re',
          icon: <AlertCircle size={size === 'sm' ? 12 : 16} />
        };
      case 'CE':
        return {
          label: 'Compile Error (CE)',
          className: 'badge-ce',
          icon: <AlertCircle size={size === 'sm' ? 12 : 16} />
        };
      case 'JUDGING':
        return {
          label: 'Đang chấm...',
          className: 'badge-tle',
          icon: <RefreshCw size={size === 'sm' ? 12 : 16} className="animate-spin" />
        };
      case 'QUEUED':
      default:
        return {
          label: 'Trong hàng đợi',
          className: 'badge-ce',
          icon: <Clock size={size === 'sm' ? 12 : 16} />
        };
    }
  };

  const config = getVerdictConfig();

  return (
    <span className={`badge ${config.className}`}>
      {config.icon}
      {showLabel && <span>{config.label}</span>}
    </span>
  );
};
