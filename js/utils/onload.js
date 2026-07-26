$(document).ready(function () {
  const appVersionEl = document.getElementById("appVersion");
  if (appVersionEl && typeof APP_VERSION !== "undefined") {
    appVersionEl.textContent = APP_VERSION;
  }

  console.log(`
            █████╗  ███╗   ███╗
            ██╔══██╗████╗ ████║
            ███████║██╔████╔██║
            ██╔══██║██║╚██╔╝██║
            ██║  ██║██║ ╚═╝ ██║
            ╚═╝  ╚═╝╚═╝     ╚═╝
          
            ⚡ אריאל מלכה מהנדסים בע"מ ⚡
            ════════════════════════════════
              ייעוץ | תכנון | פיקוח | חשמל
            ════════════════════════════════
          `);
});
