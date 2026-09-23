import type { Lang } from "./i18n";

// Explanations for the cleanup rules defined in src-tauri/src/insights.rs.
// Languages without an entry fall back to English.

interface Text {
  title: string;
  desc: string;
}

const en: Record<string, Text> = {
  "xcode-derived-data": {
    title: "Xcode DerivedData",
    desc: "Build products and indexes. Xcode rebuilds them the next time you build; the first build will be slower.",
  },
  "xcode-device-support": {
    title: "Xcode device support files",
    desc: "Debug symbols copied from every iPhone, iPad or Watch you connected. Xcode copies them again when you plug in a device.",
  },
  "xcode-archives": {
    title: "Xcode archives",
    desc: "Builds you archived for the App Store or TestFlight. Keep the ones you may need to symbolicate crash reports; delete old versions.",
  },
  "xcode-previews": { title: "SwiftUI previews", desc: "Cached SwiftUI preview builds. Recreated automatically." },
  "xcode-cache": { title: "Xcode cache", desc: "Xcode's download and documentation cache. Recreated automatically." },
  "simulator-devices": {
    title: "iOS simulators",
    desc: "Simulated devices and the apps and data inside them. Delete unused ones from Xcode (Window → Devices and Simulators) or with `xcrun simctl delete unavailable`.",
  },
  "simulator-caches": { title: "Simulator caches", desc: "Caches of the iOS simulator. Recreated automatically." },
  "cocoapods-cache": {
    title: "CocoaPods",
    desc: "Downloaded pods. `pod install` downloads them again.",
  },
  "node-modules": {
    title: "node_modules",
    desc: "JavaScript dependencies of your projects. `npm install` (or yarn/pnpm) restores them. Great to clean in old projects.",
  },
  "js-build": { title: "JavaScript build caches", desc: "Output of Next.js, Nuxt, Turborepo or Parcel. Rebuilt on the next build." },
  "npm-cache": {
    title: "npm / Yarn / pnpm / Bun cache",
    desc: "Packages downloaded by package managers. They are downloaded again when needed. For pnpm, `pnpm store prune` removes only unused packages.",
  },
  "rust-target": { title: "Rust build output", desc: "The `target` folder of a Cargo project. `cargo build` recreates it." },
  "cargo-registry": { title: "Cargo registry", desc: "Crates downloaded by Cargo. Downloaded again when needed." },
  gradle: {
    title: "Gradle / Android build",
    desc: "Gradle caches, wrappers and `build` folders of Android and Java projects. Recreated on the next build.",
  },
  "android-avd": {
    title: "Android emulators",
    desc: "Android virtual devices and their data. Delete the ones you don't use from Android Studio's Device Manager.",
  },
  flutter: { title: "Flutter / Dart", desc: "`.dart_tool` folders and the pub cache. `flutter pub get` restores them." },
  "python-cache": { title: "Python caches", desc: "`__pycache__`, pytest and mypy caches, and pip downloads. Recreated automatically." },
  "python-venv": {
    title: "Python virtual environments",
    desc: "Installed packages of a project. Recreate them from requirements.txt or pyproject.toml if you delete them.",
  },
  "go-cache": { title: "Go caches", desc: "Go build and module caches. `go clean -cache -modcache` does the same." },
  "homebrew-cache": { title: "Homebrew cache", desc: "Downloaded bottles and installers. `brew cleanup` removes them too." },
  docker: {
    title: "Docker / OrbStack disk",
    desc: "The virtual disk with all images, containers and volumes. Don't delete it here: run `docker system prune` or use the app's cleanup to shrink it.",
  },
  "ide-caches": { title: "IDE caches", desc: "Caches of JetBrains IDEs, Android Studio and VS Code. Rebuilt when you open a project." },
  "adobe-media-cache": {
    title: "Adobe media cache",
    desc: "Premiere Pro and After Effects conformed audio and peak files. Adobe rebuilds them when you open a project.",
  },
  "adobe-caches": { title: "Adobe caches", desc: "Caches of Adobe apps. Recreated automatically." },
  "final-cut-render": {
    title: "Final Cut Pro render files",
    desc: "Rendered previews inside your libraries. Final Cut renders them again when needed.",
  },
  "final-cut-transcoded": {
    title: "Final Cut Pro transcoded media",
    desc: "Optimized and proxy media. Can be regenerated from the originals, as long as you still have them.",
  },
  "figma-cache": { title: "Figma cache", desc: "Cached files of the Figma desktop app. Downloaded again when needed." },
  "audio-libraries": {
    title: "Logic / GarageBand sound library",
    desc: "Instruments and loops. Remove them from Logic or GarageBand (Sound Library menu) so the app knows they are gone.",
  },
  "browser-cache": { title: "Browser caches", desc: "Cached web pages and images. Browsers download them again; your history, passwords and tabs are not affected." },
  "chat-caches": { title: "Slack, Discord and Teams caches", desc: "Cached images and files. The apps download them again." },
  "spotify-cache": { title: "Spotify cache", desc: "Streamed music cache. Downloaded songs for offline listening may be removed too." },
  "ios-backups": {
    title: "iPhone and iPad backups",
    desc: "Local device backups. Only delete the ones you don't need, from Finder (device → Manage Backups) or here.",
  },
  "ios-updates": { title: "iOS update files", desc: "Firmware downloaded to update devices. Downloaded again if needed." },
  "mail-downloads": { title: "Mail attachments", desc: "Attachments you opened in Mail. The originals stay in your emails." },
  "messages-attachments": {
    title: "Messages attachments",
    desc: "Photos and files from your conversations. Deleting them here removes them from Messages; better to review from Messages or System Settings → Storage.",
  },
  logs: { title: "Logs", desc: "Diagnostic logs of apps. Safe to delete." },
  temp: { title: "Temporary files", desc: "Temporary files and crash dumps. Files in use are skipped." },
  "windows-old": { title: "Previous Windows installation", desc: "Left over after a Windows upgrade. Remove it with Disk Cleanup → Clean up system files." },
  "linux-cache": { title: "Thumbnails and Trash", desc: "Thumbnail cache and files already in the Trash." },
  installers: {
    title: "Installers in Downloads",
    desc: "Disk images and installers you downloaded. Usually not needed once the app is installed.",
  },
};

const es: Record<string, Text> = {
  "xcode-derived-data": {
    title: "DerivedData de Xcode",
    desc: "Compilaciones e índices. Xcode los vuelve a generar al compilar; la primera compilación será más lenta.",
  },
  "xcode-device-support": {
    title: "Soporte de dispositivos de Xcode",
    desc: "Símbolos de depuración copiados de cada iPhone, iPad o Watch que conectaste. Xcode los vuelve a copiar al conectar el dispositivo.",
  },
  "xcode-archives": {
    title: "Archivos de Xcode (Archives)",
    desc: "Builds que archivaste para App Store o TestFlight. Conserva los que necesites para simbolizar reportes de crash; borra versiones viejas.",
  },
  "xcode-previews": { title: "Previews de SwiftUI", desc: "Compilaciones en caché de las previews. Se regeneran solas." },
  "xcode-cache": { title: "Caché de Xcode", desc: "Caché de descargas y documentación de Xcode. Se regenera sola." },
  "simulator-devices": {
    title: "Simuladores de iOS",
    desc: "Dispositivos simulados con sus apps y datos. Borra los que no uses desde Xcode (Window → Devices and Simulators) o con `xcrun simctl delete unavailable`.",
  },
  "simulator-caches": { title: "Cachés del simulador", desc: "Cachés del simulador de iOS. Se regeneran solas." },
  "cocoapods-cache": { title: "CocoaPods", desc: "Pods descargados. `pod install` los vuelve a descargar." },
  "node-modules": {
    title: "node_modules",
    desc: "Dependencias JavaScript de tus proyectos. `npm install` (o yarn/pnpm) las restaura. Ideal para limpiar proyectos viejos.",
  },
  "js-build": { title: "Cachés de build de JavaScript", desc: "Salida de Next.js, Nuxt, Turborepo o Parcel. Se regenera en el siguiente build." },
  "npm-cache": {
    title: "Caché de npm / Yarn / pnpm / Bun",
    desc: "Paquetes descargados por los gestores de paquetes. Se vuelven a descargar cuando hacen falta. En pnpm, `pnpm store prune` borra solo los que no se usan.",
  },
  "rust-target": { title: "Compilación de Rust", desc: "La carpeta `target` de un proyecto Cargo. `cargo build` la vuelve a crear." },
  "cargo-registry": { title: "Registro de Cargo", desc: "Crates descargados por Cargo. Se vuelven a descargar cuando hacen falta." },
  gradle: {
    title: "Gradle / builds de Android",
    desc: "Cachés y wrappers de Gradle y carpetas `build` de proyectos Android y Java. Se regeneran en el siguiente build.",
  },
  "android-avd": {
    title: "Emuladores de Android",
    desc: "Dispositivos virtuales de Android y sus datos. Borra los que no uses desde el Device Manager de Android Studio.",
  },
  flutter: { title: "Flutter / Dart", desc: "Carpetas `.dart_tool` y caché de pub. `flutter pub get` las restaura." },
  "python-cache": { title: "Cachés de Python", desc: "`__pycache__`, cachés de pytest y mypy, y descargas de pip. Se regeneran solas." },
  "python-venv": {
    title: "Entornos virtuales de Python",
    desc: "Paquetes instalados de un proyecto. Si los borras, recréalos desde requirements.txt o pyproject.toml.",
  },
  "go-cache": { title: "Cachés de Go", desc: "Cachés de compilación y módulos de Go. Equivale a `go clean -cache -modcache`." },
  "homebrew-cache": { title: "Caché de Homebrew", desc: "Bottles e instaladores descargados. `brew cleanup` también los borra." },
  docker: {
    title: "Disco de Docker / OrbStack",
    desc: "El disco virtual con todas las imágenes, contenedores y volúmenes. No lo borres aquí: usa `docker system prune` o la limpieza de la app para reducirlo.",
  },
  "ide-caches": { title: "Cachés de IDEs", desc: "Cachés de JetBrains, Android Studio y VS Code. Se regeneran al abrir un proyecto." },
  "adobe-media-cache": {
    title: "Caché de medios de Adobe",
    desc: "Audio conformado y archivos de picos de Premiere Pro y After Effects. Adobe los regenera al abrir un proyecto.",
  },
  "adobe-caches": { title: "Cachés de Adobe", desc: "Cachés de las apps de Adobe. Se regeneran solas." },
  "final-cut-render": {
    title: "Archivos de render de Final Cut Pro",
    desc: "Previsualizaciones renderizadas dentro de tus bibliotecas. Final Cut las vuelve a renderizar cuando hace falta.",
  },
  "final-cut-transcoded": {
    title: "Medios transcodificados de Final Cut Pro",
    desc: "Medios optimizados y proxies. Se pueden regenerar desde los originales, siempre que aún los tengas.",
  },
  "figma-cache": { title: "Caché de Figma", desc: "Archivos en caché de la app de escritorio de Figma. Se vuelven a descargar." },
  "audio-libraries": {
    title: "Biblioteca de sonidos de Logic / GarageBand",
    desc: "Instrumentos y loops. Quítalos desde Logic o GarageBand (menú Biblioteca de sonidos) para que la app sepa que ya no están.",
  },
  "browser-cache": { title: "Cachés de navegadores", desc: "Páginas e imágenes en caché. El navegador las vuelve a descargar; tu historial, contraseñas y pestañas no se tocan." },
  "chat-caches": { title: "Cachés de Slack, Discord y Teams", desc: "Imágenes y archivos en caché. Las apps los vuelven a descargar." },
  "spotify-cache": { title: "Caché de Spotify", desc: "Caché de música en streaming. Las canciones descargadas para escuchar sin conexión también pueden borrarse." },
  "ios-backups": {
    title: "Respaldos de iPhone y iPad",
    desc: "Respaldos locales de dispositivos. Borra solo los que no necesites, desde Finder (dispositivo → Gestionar respaldos) o aquí.",
  },
  "ios-updates": { title: "Actualizaciones de iOS", desc: "Firmware descargado para actualizar dispositivos. Se vuelve a descargar si hace falta." },
  "mail-downloads": { title: "Adjuntos de Mail", desc: "Adjuntos que abriste en Mail. Los originales siguen en tus correos." },
  "messages-attachments": {
    title: "Adjuntos de Mensajes",
    desc: "Fotos y archivos de tus conversaciones. Borrarlos aquí los quita de Mensajes; mejor revísalos desde Mensajes o Ajustes → Almacenamiento.",
  },
  logs: { title: "Registros (logs)", desc: "Registros de diagnóstico de apps. Se pueden borrar sin problema." },
  temp: { title: "Archivos temporales", desc: "Archivos temporales y volcados de errores. Los que estén en uso se omiten." },
  "windows-old": { title: "Instalación anterior de Windows", desc: "Queda tras actualizar Windows. Bórrala con Liberador de espacio → Limpiar archivos del sistema." },
  "linux-cache": { title: "Miniaturas y Papelera", desc: "Caché de miniaturas y archivos que ya están en la Papelera." },
  installers: {
    title: "Instaladores en Descargas",
    desc: "Imágenes de disco e instaladores descargados. Normalmente no hacen falta después de instalar la app.",
  },
};

const TEXTS: Partial<Record<Lang, Record<string, Text>>> = { en, es };

export function insightText(lang: Lang, rule: string): Text {
  return TEXTS[lang]?.[rule] ?? en[rule] ?? { title: rule, desc: "" };
}

export const RULE_IDS = Object.keys(en);

export function hasTranslation(lang: Lang, rule: string): boolean {
  return !!TEXTS[lang]?.[rule];
}
