/* WorshipIEM — shared epoch clock with NTP offset */
window.WIClock = {
  _offset: 0,
  now() { return Date.now() + this._offset; },
  setOffset(o) { this._offset = o; },
};
