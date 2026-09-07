import React from 'react';

/**
 * FalconIcon — Majestic Eagle & Falcon Emblem.
 * Features a sharp hooked raptor beak, keen eye, tiered aerodynamic wings, and fanned tail feathers.
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
      className={`lucide lucide-eagle falcon-icon ${className}`.trim()}
      style={style}
      aria-hidden="true"
      {...props}
    >
      {/* Fierce Eagle Head with sharp hooked beak */}
      <path d="M16 4.5C18.2 4.2 20.8 5 22 7C22.8 8.4 22 9.8 20 10.2C18.8 10.4 17.8 9.8 17.2 9" />
      {/* Raptor Eye */}
      <circle cx="18" cy="6.8" r="0.8" fill={color === 'currentColor' ? 'currentColor' : color} stroke="none" />
      
      {/* Primary Swept Flight Wing with tiered feathers */}
      <path d="M16 4.5C11.5 2.5 6 3 2 6.5C5.2 8 8.8 8.8 12 9.5" />
      <path d="M2 6.5C1.2 9 3 11 6 12C9 12.5 12 12 14.5 11.2" />
      <path d="M4.5 11.2C3.5 13 4.5 15 7 15.5C9.5 15.8 12.5 14.5 14.2 13.5" />
      
      {/* Aerodynamic Body & Stepped Tail Feathers */}
      <path d="M14.5 11.2L13 18.5L16 16.8L17.5 20.5L18.2 14.5C19.8 13.2 21.2 11.5 20 10.2" />
      
      {/* Feather Speed Rib Accent */}
      <path d="M8.5 8C11.5 9 14.5 9.5 17.2 9" />
    </svg>
  );
}
