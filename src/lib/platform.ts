const ua = navigator.userAgent;

export const isMac = /Mac/i.test(ua);
export const isWindows = /Windows/i.test(ua);
export const isLinux = !isMac && !isWindows;
