import React from 'react';

/**
 * FalconIcon — Aerodynamic Falcon in flight with swept wings, sharp beak, and keen eye.
 * Fully compatible with Lucide icon props (size, color, strokeWidth, className, style).
 */
export default function FalconIcon({ 
  size = 24, 
  color = 'currentColor', 
  strokeWidth = 2, 
  className = '', 
  style = {},
  ...props 
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`lucide lucide-falcon falcon-icon ${className}`.trim()}
      style={style}
      aria-hidden="true"
      {...props}
    >
      {/* Aerodynamic Soaring Falcon: sharp beak, high arched swept wings, streamlined tail */}
      <path d="M22 6.5c-2.5.5-5 2-7.5 4.5L7 3.5C6.5 6.5 7.5 9.5 9.5 12L2 14.5c3.5 1.5 6.5 1 9.5-.5L9 20.5l3.5-2 1.5 3 1.5-6.5c3-1.5 5-3.5 6.5-6.5.5-1 .5-1.5 0-2z" />
      {/* Speed wing feather accent */}
      <path d="M14.5 11c1.5-1 3-2 5.5-2.5" />
      {/* Keen Falcon Eye */}
      <circle cx="18" cy="8" r="0.75" fill={color === 'currentColor' ? 'currentColor' : color} />
    </svg>
  );
}
