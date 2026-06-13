import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rutaviva.conductor',
  appName: 'RutaViva Conductor',
  webDir: 'dist',
  android: {
    backgroundColor: '#0f172a',
  },
  plugins: {
    Geolocation: {
      // Solicitar permisos de ubicación precisa
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    CapacitorHttp: {
      enabled: true,
    },
  },
  server: {
    // En desarrollo puedes apuntar al servidor local:
    // url: 'http://192.168.x.x:8080',
    // cleartext: true,
  },
};

export default config;
