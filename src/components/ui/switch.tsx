'use client';

import * as React from 'react';
import { cn } from '@/utils/cn';

interface SwitchProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'children'> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

// 이 프로젝트엔 @radix-ui/react-switch가 없어서(다른 컴포넌트는 각자 필요한 radix 패키지만
// 설치돼 있음), role="switch" 버튼으로 직접 만든다 — 새 의존성 추가 없이 동일한 접근성 동작.
const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, className, ...props }, ref) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      ref={ref}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        checked ? 'bg-primary' : 'bg-zinc-300',
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 translate-x-0.5 rounded-full bg-white shadow transition-transform',
          checked && 'translate-x-4',
        )}
      />
    </button>
  ),
);
Switch.displayName = 'Switch';

export { Switch };
