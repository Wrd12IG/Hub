/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
    dest: 'public',
    disable: process.env.NODE_ENV === 'development',
    register: true,
    skipWaiting: true,
    reloadOnOnline: true,
    cacheOnFrontEndNav: true,
    fallbacks: {
        document: '/dashboard', // Fallback per pagine offline
    },
    runtimeCaching: [
        // Cache Google Fonts
        {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
                cacheName: 'google-fonts-v6',
                expiration: {
                    maxEntries: 20,
                    maxAgeSeconds: 365 * 24 * 60 * 60, // 1 anno
                },
            },
        },
        // Cache immagini
        {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
                cacheName: 'images-cache-v6',
                expiration: {
                    maxEntries: 100,
                    maxAgeSeconds: 30 * 24 * 60 * 60, // 30 giorni
                },
            },
        },
        // Cache audio (notifiche)
        {
            urlPattern: /\.(?:mp3|wav|ogg)$/i,
            handler: 'CacheFirst',
            options: {
                cacheName: 'audio-cache-v6',
                expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 24 * 60 * 60, // 24 ore
                },
            },
        },
        // Cache JS e CSS
        {
            urlPattern: /\.(?:js|css)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
                cacheName: 'static-resources-v6',
                expiration: {
                    maxEntries: 50,
                    maxAgeSeconds: 24 * 60 * 60, // 24 ore
                },
            },
        },
        // API routes - Network First (dati sempre freschi)
        {
            urlPattern: /^http:\/\/localhost:9002\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
                cacheName: 'api-cache-v6',
                networkTimeoutSeconds: 10,
                expiration: {
                    maxEntries: 50,
                    maxAgeSeconds: 5 * 60, // 5 minuti
                },
            },
        },
        // Altre pagine - Network First con fallback
        {
            urlPattern: /^http:\/\/localhost:9002\/.*/i,
            handler: 'NetworkFirst',
            options: {
                cacheName: 'pages-cache-v6',
                networkTimeoutSeconds: 10,
                expiration: {
                    maxEntries: 30,
                    maxAgeSeconds: 24 * 60 * 60, // 24 ore
                },
            },
        },
    ],
});

const nextConfig = {
    reactStrictMode: true,
    // output: 'standalone', // Disabled - causes build issues, re-enable for Docker deployment
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
            },
            {
                protocol: 'http',
                hostname: '**', // Allow HTTP images for internal network
            },
        ],
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
};

module.exports = withPWA(nextConfig);
