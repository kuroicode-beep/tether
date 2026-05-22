// Firebase Messaging Service Worker
// 백그라운드 FCM 수신 처리

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// 환경변수는 SW에서 직접 접근 불가 — 빌드 시 Vite가 주입하거나
// index.html에서 postMessage로 config를 전달받아야 하나,
// 여기서는 self.__FIREBASE_CONFIG__ 전역을 통해 동적으로 주입하는 방식 사용
// (초기화 전에 configure() 가 호출되지 않으면 messaging은 noop)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FIREBASE_CONFIG') {
    if (!self.__firebaseInitialized) {
      firebase.initializeApp(event.data.config);
      firebase.messaging();
      self.__firebaseInitialized = true;
    }
  }
});

// Vite PWA가 빌드 시 SW를 교체하지 않는 경우를 위해 직접 초기화도 지원
// 실제 Firebase가 설정된 경우 아래 값을 채워 빌드할 것
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
    firebase.initializeApp(FIREBASE_CONFIG);
    const messaging = firebase.messaging();

    // 백그라운드 메시지 수신 (앱이 백그라운드 또는 닫혀 있을 때)
    messaging.onBackgroundMessage((payload) => {
      const title = payload.notification?.title ?? 'Tether 🌿';
      const body = payload.notification?.body ?? '';
      const icon = payload.notification?.icon ?? '/icon-192.png';

      self.registration.showNotification(title, {
        body,
        icon,
        badge: '/icon-192.png',
        data: payload.data ?? {},
        vibrate: [200, 100, 200],
      });
    });
  } catch {
    // Firebase 미설정 — 무시
  }
}

// 알림 클릭 시 앱 포커스 또는 새 탭 열기
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = self.location.origin + '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 이미 열린 탭이 있으면 포커스
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // 없으면 새 탭 열기
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
