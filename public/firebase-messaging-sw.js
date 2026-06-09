// public/firebase-messaging-sw.js — FCM 백그라운드 알림 (빌드 시 __VITE_*__ 치환)
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            '__VITE_FIREBASE_API_KEY__',
  authDomain:        '__VITE_FIREBASE_AUTH_DOMAIN__',
  projectId:         '__VITE_FIREBASE_PROJECT_ID__',
  storageBucket:     '__VITE_FIREBASE_STORAGE_BUCKET__',
  messagingSenderId: '__VITE_FIREBASE_MESSAGING_SENDER_ID__',
  appId:             '__VITE_FIREBASE_APP_ID__',
});

const messaging = firebase.messaging();

// 백그라운드 FCM 메시지를 시스템 알림으로 표시한다
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message received:', payload);
  const { title, body } = payload.notification ?? {};
  const data = payload.data ?? {};

  return self.registration.showNotification(title ?? 'Tether 💕', {
    body: body ?? '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.type ?? 'tether-msg',
    renotify: true,
    silent: false,
    vibrate: [200, 100, 200],
    data: { url: data.url ?? '/', ...data },
  });
});

// 알림 클릭 시 앱 창 포커스 또는 해당 URL로 이동한다
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const rawUrl = event.notification.data?.url ?? '/';
  const urlToOpen = rawUrl.startsWith('http')
    ? rawUrl
    : self.location.origin + (rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`);

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes('tether') && 'focus' in client) {
          if ('navigate' in client && urlToOpen !== client.url) {
            return client.navigate(urlToOpen).then(() => client.focus());
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    }),
  );
});
