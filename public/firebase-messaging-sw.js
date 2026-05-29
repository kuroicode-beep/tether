// Firebase Messaging Service Worker — 백그라운드 FCM 수신 처리
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

let fcmHandled = false;
let messagingReady = false;

// Firebase Messaging을 초기화하고 background handler를 등록한다
function setupMessaging(config) {
  if (messagingReady) return;
  firebase.initializeApp(config);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    fcmHandled = true;
    const title = payload.notification?.title ?? 'Tether';
    const body = payload.notification?.body ?? '';
    return self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: payload.data ?? {},
      vibrate: [200, 100, 200],
    });
  });

  messagingReady = true;
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FIREBASE_CONFIG') {
    setupMessaging(event.data.config);
  }
});

const FIREBASE_CONFIG = {
  apiKey: self.__FIREBASE_API_KEY__ || '',
  authDomain: self.__FIREBASE_AUTH_DOMAIN__ || '',
  projectId: self.__FIREBASE_PROJECT_ID__ || '',
  storageBucket: self.__FIREBASE_STORAGE_BUCKET__ || '',
  messagingSenderId: self.__FIREBASE_MESSAGING_SENDER_ID__ || '',
  appId: self.__FIREBASE_APP_ID__ || '',
};

if (FIREBASE_CONFIG.projectId) {
  try {
    setupMessaging(FIREBASE_CONFIG);
  } catch {
    // Firebase 미설정 — 무시
  }
}

// Firebase handler가 처리하지 않은 push만 fallback으로 표시한다
self.addEventListener('push', (event) => {
  if (fcmHandled) {
    fcmHandled = false;
    return;
  }

  const data = event.data?.json?.() ?? {};
  const title = data.notification?.title ?? data.title ?? 'Tether';
  const body = data.notification?.body ?? data.body ?? '';
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: data.data ?? {},
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = self.location.origin + '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    }),
  );
});
