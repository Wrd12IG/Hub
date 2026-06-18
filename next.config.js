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
        formats: ['image/avif', 'image/webp'],
        minimumCacheTTL: 3600,
        remotePatterns: [
            { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
            { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
            { protocol: 'https', hostname: 'lh4.googleusercontent.com' },
            { protocol: 'https', hostname: 'storage.googleapis.com' },
            { protocol: 'https', hostname: '**.googleusercontent.com' },
            { protocol: 'https', hostname: 'images.unsplash.com' },
            { protocol: 'https', hostname: 'loremflickr.com' },
            { protocol: 'https', hostname: 'picsum.photos' },
            { protocol: 'https', hostname: 'ui-avatars.com' },
            { protocol: 'https', hostname: '**.cloudfront.net' },
            { protocol: 'https', hostname: 'via.placeholder.com' },
        ],
    },
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    { key: 'X-Frame-Options', value: 'DENY' },
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
                    {
                        key: 'Strict-Transport-Security',
                        value: 'max-age=63072000; includeSubDomains; preload',
                    },
                    {
                        key: 'Content-Security-Policy',
                        value: [
                            "default-src 'self'",
                            "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://apis.google.com https://www.gstatic.com",
                            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                            "font-src 'self' https://fonts.gstatic.com",
                            "img-src 'self' data: blob: https://firebasestorage.googleapis.com https://*.googleusercontent.com https://images.unsplash.com https://loremflickr.com https://picsum.photos https://via.placeholder.com https://ui-avatars.com",
                            "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com",
                            "frame-src 'none'",
                            "object-src 'none'",
                            "base-uri 'self'",
                        ].join('; '),
                    },
                ],
            },
        ];
    },
    eslint: {
        ignoreDuringBuilds: true,
    },

    webpack: (config, { isServer, webpack }) => {
        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                fs: false,
                https: false,
                http: false,
                net: false,
                tls: false,
                child_process: false,
                readline: false,
                zlib: false,
                path: false,
                os: false,
                stream: false,
                crypto: false,
            };

            // Handle node: protocol
            config.plugins.push(
                new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
                    resource.request = resource.request.replace(/^node:/, "");
                })
            );

            config.resolve.alias = {
                ...config.resolve.alias,
                pptxgenjs: require('path').resolve(__dirname, 'node_modules/pptxgenjs/dist/pptxgen.bundle.js'),
                // Alias the now-stripped versions to false
                "fs": false,
                "https": false,
                "http": false,
            };
        }
        return config;
    },
};

module.exports = withPWA(nextConfig);
