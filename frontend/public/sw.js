// Service Worker untuk PWA KitaCall (Tactical Walkie-Talkie Transceiver)
const CACHE_NAME = 'kitacall-v1';
const STATIC_ASSETS = [
  '/',
  '/?source=pwa',
  '/index.html',
  '/manifest.json',
  '/KitaCall Emblem.png',
  '/KitaCall Transparan.png',
  '/logo.png',
  '/favicon.png',
  '/silence.wav'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

// Push notification darurat tembus saku (SOS Emergency Broadcast)
self.addEventListener('push', (event) => {
  let data = {
    title: '⚠️ SIAGA DARURAT: KOMANDO KITACALL',
    body: 'Panggilan koordinasi darurat dari Koordinator Keamanan. Buka aplikasi segera!',
    commanderName: 'Komandan'
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/logo.png',
    badge: '/logo.png',
    vibrate: [600, 150, 600, 150, 1200], // Pola getar darurat panjang
    requireInteraction: true,
    data: {
      url: '/?source=emergency_push'
    },
    actions: [
      { action: 'open_radio', title: '🎙️ Buka HT Sekarang' },
      { action: 'dismiss', title: 'Abaikan' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Interactive Lockscreen Media & Tactical Controller via Service Worker Notification
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_LOCKSCREEN_NOTIFICATION') {
    const { title, body } = event.data;
    self.registration.showNotification(title || '📻 KitaCall Transceiver', {
      body: body || '🟢 SIAGA AKTIF • Kendali Saku',
      icon: '/logo.png',
      badge: '/logo.png',
      tag: 'kitacall-radio-live',
      renotify: false,
      silent: true,
      requireInteraction: true,
      data: { url: '/?source=lockscreen' },
      actions: [
        { action: 'toggle_mic', title: '🎙️ Buka/Tutup Mic' },
        { action: 'next_channel', title: '⏭️ Ganti Saluran' }
      ]
    });
  } else if (event.data && event.data.type === 'DISMISS_LOCKSCREEN_NOTIFICATION') {
    self.registration.getNotifications({ tag: 'kitacall-radio-live' }).then((notifications) => {
      notifications.forEach((n) => n.close());
    });
  }
});

self.addEventListener('notificationclick', (event) => {
  if (event.action === 'toggle_mic') {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          client.postMessage({ type: 'LOCKSCREEN_TOGGLE_MIC' });
        }
      })
    );
    return;
  }

  if (event.action === 'next_channel') {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          client.postMessage({ type: 'LOCKSCREEN_NEXT_CHANNEL' });
        }
      })
    );
    return;
  }

  event.notification.close();

  if (event.action === 'open_radio' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/?source=push_click');
        }
      })
    );
  }
});
