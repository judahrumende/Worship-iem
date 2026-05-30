/* WorshipIEM — icon set (lucide-style line icons, 1.75 stroke) */
const WIcon = ({ name, size = 20, style, className }) => {
  const p = {
    play: <polygon points="6 4 20 12 6 20 6 4" />,
    stop: <rect x="5" y="5" width="14" height="14" rx="2.5" />,
    pause: <g><rect x="6" y="5" width="4" height="14" rx="1.3" /><rect x="14" y="5" width="4" height="14" rx="1.3" /></g>,
    mic: <g><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><line x1="12" y1="18" x2="12" y2="22" /></g>,
    micOff: <g><line x1="3" y1="3" x2="21" y2="21" /><path d="M9 9v2a3 3 0 0 0 5 2.2" /><path d="M15 10.5V5a3 3 0 0 0-5.7-1.3" /><path d="M5 11a7 7 0 0 0 10.7 5.9" /><path d="M19 11a7 7 0 0 1-.6 2.8" /><line x1="12" y1="18" x2="12" y2="22" /></g>,
    plus: <g><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></g>,
    minus: <line x1="5" y1="12" x2="19" y2="12" />,
    trash: <g><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></g>,
    copy: <g><rect x="9" y="9" width="12" height="12" rx="2.5" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></g>,
    check: <polyline points="20 6 9 17 4 12" />,
    arrowRight: <g><line x1="4" y1="12" x2="20" y2="12" /><polyline points="14 6 20 12 14 18" /></g>,
    users: <g><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></g>,
    music: <g><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></g>,
    link: <g><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" /></g>,
    radio: <g><circle cx="12" cy="12" r="2" /><path d="M7.8 7.8a6 6 0 0 0 0 8.5M16.2 16.3a6 6 0 0 0 0-8.5" /><path d="M5 5a10 10 0 0 0 0 14M19 19a10 10 0 0 0 0-14" /></g>,
    hand: <g><path d="M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8" /><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2a8 8 0 0 1-7-4l-2.5-4.5a2 2 0 0 1 3.5-2L8 16" /></g>,
    chevronLeft: <polyline points="15 18 9 12 15 6" />,
    chevronRight: <polyline points="9 18 15 12 9 6" />,
    x: <g><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></g>,
    headphones: <g><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" /></g>,
    volume: <g><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" /></g>,
    sliders: <g><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></g>,
    grip: <g><circle cx="9" cy="6" r="1.4" /><circle cx="9" cy="12" r="1.4" /><circle cx="9" cy="18" r="1.4" /><circle cx="15" cy="6" r="1.4" /><circle cx="15" cy="12" r="1.4" /><circle cx="15" cy="18" r="1.4" /></g>,
    list: <g><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></g>,
    metronome: <g><path d="M7 21h10l-3.2-14.5a2 2 0 0 0-3.9 0L7 21z" /><line x1="6" y1="16" x2="18" y2="16" /><line x1="12" y1="13" x2="16" y2="6" /></g>,
    wifi: <g><path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0" /><line x1="12" y1="19.5" x2="12.01" y2="19.5" /></g>,
    sun: <g><circle cx="12" cy="12" r="4.2" /><path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8l1.8-1.8M18 6l1.8-1.8" /></g>,
    moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
    grip2: <g><circle cx="9" cy="7" r="1.3" /><circle cx="9" cy="12" r="1.3" /><circle cx="9" cy="17" r="1.3" /><circle cx="15" cy="7" r="1.3" /><circle cx="15" cy="12" r="1.3" /><circle cx="15" cy="17" r="1.3" /></g>,
    lock: <g><rect x="4.5" y="11" width="15" height="9" rx="2.2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></g>,
    bell: <g><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></g>,
    upload: <g><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></g>,
    drum: <g><ellipse cx="12" cy="7" rx="8" ry="3" /><path d="M4 7v8c0 1.7 3.6 3 8 3s8-1.3 8-3V7" /><line x1="12" y1="10" x2="12" y2="18" /></g>,
    guitar: <g><path d="M11.5 12.5 18 6l1-3 2-2-2 2-3 1-6.5 6.5" /><circle cx="8" cy="16" r="4.5" /><circle cx="8" cy="16" r="1.4" /></g>,
    piano: <g><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M8 5v8M12 5v8M16 5v8" /></g>,
    speaker: <g><rect x="6" y="2.5" width="12" height="19" rx="2.5" /><circle cx="12" cy="15" r="3.4" /><circle cx="12" cy="6.5" r="1.2" /></g>,
  }[name] || null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"
      style={style} className={className} aria-hidden="true">
      {p}
    </svg>
  );
};
window.WIcon = WIcon;
