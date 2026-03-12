const API = 'https://script.google.com/macros/s/AKfycbzt83RC7YYrE59ATSs8E5g9724bMdZPwepFHXDU-mM6IJ4g719ixQDj7x6wVoYg_grk9Q/exec';

let _jid = 0;
function jp(u, t = 90000) {
  return new Promise((rs, rj) => {
    const cb = '__jp' + (++_jid) + '_' + Date.now();
    const tm = setTimeout(() => { cl(); rj(new Error('Timeout')) }, t);
    const s = document.createElement('script');
    function cl() { clearTimeout(tm); delete window[cb]; s.parentNode && s.parentNode.removeChild(s) }
    window[cb] = d => { cl(); rs(d) };
    s.src = u + (u.includes('?') ? '&' : '?') + 'callback=' + cb;
    s.onerror = () => { cl(); rj(new Error('Network')) };
    document.head.appendChild(s);
  });
}

export function api(action) {
  return jp(API + '?action=' + action + '&_t=' + Date.now());
}
