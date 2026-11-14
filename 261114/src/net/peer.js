// Подключение к PeerJS (WebRTC). Библиотека грузится только для сетевой игры.
// Сервер «рукопожатия» — по умолчанию бесплатный сервер PeerJS (нужен интернет на секунду при соединении);
// сами данные идут напрямую между устройствами по локальной сети.
// Для своего сервера или тестов: ?peerHost=192.168.1.10&peerPort=9000&peerPath=/&peerSecure=0
let loading = null;
export function loadPeer() {
  if (window.Peer) return Promise.resolve(window.Peer);
  loading ||= new Promise((resolve, reject) => {
    const sc = document.createElement('script');
    sc.src = 'vendor/peerjs.min.js';
    sc.onload = () => resolve(window.Peer);
    sc.onerror = () => { loading = null; reject(new Error('peerjs')); };
    document.head.append(sc);
  });
  return loading;
}

const PEER_PARAMS = ['peerHost', 'peerPort', 'peerPath', 'peerSecure'];
export function peerOptions() {
  const q = new URLSearchParams(location.search);
  const o = { debug: 0 };
  if (q.get('peerHost')) {
    o.host = q.get('peerHost');
    o.port = Number(q.get('peerPort') || 9000);
    o.path = q.get('peerPath') || '/';
    o.secure = q.get('peerSecure') === '1';
  }
  return o;
}
// Параметры сервера переносятся в ссылку для гостей.
export function peerQuery() {
  const q = new URLSearchParams(location.search);
  return PEER_PARAMS.filter(k => q.get(k)).map(k => `&${k}=${encodeURIComponent(q.get(k))}`).join('');
}

export function randomId(prefix) {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return prefix + Array.from(a, b => (b % 36).toString(36)).join('');
}
