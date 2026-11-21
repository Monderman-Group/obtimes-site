import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { SystemBars, SystemBarsStyle, SystemBarType } from '@capacitor/core';
import { Share } from '@capacitor/share';

window.OBT_NATIVE_BRIDGE = {
  async share({ title, text, url }) {
    return Share.share({ title, text, url, dialogTitle: 'Share essay' });
  },
  async openExternal(url) {
    return Browser.open({ url, presentationStyle: 'popover' });
  },
  async appInfo() {
    return App.getInfo();
  },
  async exit() {
    return App.exitApp();
  }
};

App.addListener('backButton', () => {
  window.dispatchEvent(new CustomEvent('obt-native-back'));
});

App.addListener('appUrlOpen', ({ url }) => {
  window.dispatchEvent(new CustomEvent('obt-native-url', { detail: { url } }));
});

Promise.allSettled([
  SystemBars.setStyle({ style: SystemBarsStyle.Dark, bar: SystemBarType.StatusBar }),
  SystemBars.setStyle({ style: SystemBarsStyle.Light, bar: SystemBarType.NavigationBar })
]);
