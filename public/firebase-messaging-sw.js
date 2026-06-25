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

function postInAppAlert(client, message) {
  client.postMessage({
    type: 'PLAY_NOTIFICATION_SOUND',
    alertType: message.type,
    title: message.title,
    body: message.body,
    screen: message.screen,
    url: message.url,
    notificationId: message.notificationId,
  });
}

function screenFromUrl(rawUrl) {
  try {
    const url = new URL(rawUrl, self.location.origin);
    return url.searchParams.get('screen');
  } catch {
    return null;
  }
}

// 백그라운드 FCM 메시지를 시스템 알림으로 표시한다 (data-only 페이로드)
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message received:', payload);
  const data = payload.data ?? {};
  const title = data.title ?? payload.notification?.title ?? 'Tether 💕';
  const body = data.body ?? payload.notification?.body ?? '';
  const type = data.type ?? 'tether-msg';
  const targetUrl = data.url ?? '/';
  const screen = data.screen ?? screenFromUrl(targetUrl);
  const notificationTag = data.notificationId ?? `${type}-${Date.now()}`;
  const inAppMessage = { title, body, type, screen, url: targetUrl, notificationId: notificationTag };

  const hasFcmNotification = !!payload.notification?.title || !!payload.notification?.body;
  if (hasFcmNotification && data.forceSwDisplay !== '1') {
    return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      clients
        .filter((client) => client.visibilityState === 'visible')
        .forEach((client) => postInAppAlert(client, inAppMessage));
    });
  }

  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const visibleClients = clients.filter((client) => client.visibilityState === 'visible');
    if (visibleClients.length > 0) {
      visibleClients.forEach((client) => postInAppAlert(client, inAppMessage));
      return undefined;
    }

    return self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: notificationTag,
      renotify: false,
      silent: false,
      vibrate: [220, 100, 220, 100, 320],
      requireInteraction: true,
      timestamp: Date.now(),
      data: { url: targetUrl, screen, ...data },
    });
  });
});

// 알림 클릭 시 앱 창 포커스 + React 라우팅 메시지 전송
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const rawUrl = event.notification.data?.url ?? '/';
  const screen = event.notification.data?.screen ?? screenFromUrl(rawUrl) ?? 'home';
  const urlToOpen = rawUrl.startsWith('http')
    ? rawUrl
    : self.location.origin + (rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`);

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.postMessage({ type: 'NAVIGATE', screen });
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
