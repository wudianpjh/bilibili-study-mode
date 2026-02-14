(() => {
  "use strict";

  const KEYS = {
    enabled: "bs_enabled",
    wallpaper: "bs_wallpaper",
    cleanup: "bs_cleanup"
  };

  const DEFAULTS = {
    [KEYS.enabled]: true,
    [KEYS.wallpaper]: { kind: "none", value: "" },
    [KEYS.cleanup]: {
      hideMatch: true,
      hideCreator: true,
      hideSubmit: true,
      hideExtraLeftNav: true
    }
  };

  const $ = (id) => document.getElementById(id);

  function getActiveTab() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs?.[0]));
    });
  }

  async function pingRefresh() {
    const tab = await getActiveTab();
    if (!tab?.id) return;
    chrome.tabs.sendMessage(tab.id, { type: "BS_REFRESH" });
  }

  async function nav(key) {
    const tab = await getActiveTab();
    if (!tab?.id) return;
    chrome.tabs.sendMessage(tab.id, { type: "BS_NAV", key });
  }

  function readCfg() {
    return new Promise((resolve) => chrome.storage.local.get(DEFAULTS, resolve));
  }

  function writeCfg(obj) {
    return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
  }

  async function init() {
    const cfg = await readCfg();

    $("enabled").checked = !!cfg[KEYS.enabled];

    const cleanup = cfg[KEYS.cleanup] || DEFAULTS[KEYS.cleanup];
    $("hideMatch").checked = !!cleanup.hideMatch;
    $("hideCreator").checked = !!cleanup.hideCreator;
    $("hideSubmit").checked = !!cleanup.hideSubmit;
    $("hideExtraLeftNav").checked = !!cleanup.hideExtraLeftNav;

    $("enabled").addEventListener("change", async () => {
      await writeCfg({ [KEYS.enabled]: $("enabled").checked });
      await pingRefresh();
    });

    const saveCleanup = async () => {
      const next = {
        hideMatch: $("hideMatch").checked,
        hideCreator: $("hideCreator").checked,
        hideSubmit: $("hideSubmit").checked,
        hideExtraLeftNav: $("hideExtraLeftNav").checked
      };
      await writeCfg({ [KEYS.cleanup]: next });
      await pingRefresh();
    };

    ["hideMatch", "hideCreator", "hideSubmit", "hideExtraLeftNav"].forEach((id) => {
      $(id).addEventListener("change", saveCleanup);
    });

    $("saveUrl").addEventListener("click", async () => {
      const url = ($("wallpaperUrl").value || "").trim();
      if (!url) return;
      await writeCfg({ [KEYS.wallpaper]: { kind: "url", value: url } });
      await pingRefresh();
    });

    $("wallpaperFile").addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = String(reader.result || "");
        await writeCfg({ [KEYS.wallpaper]: { kind: "data", value: dataUrl } });
        await pingRefresh();
      };
      reader.readAsDataURL(file);
    });

    $("clearWallpaper").addEventListener("click", async () => {
      await writeCfg({ [KEYS.wallpaper]: { kind: "none", value: "" } });
      await pingRefresh();
    });

    document.querySelectorAll("button[data-nav]").forEach((btn) => {
      btn.addEventListener("click", () => nav(btn.getAttribute("data-nav")));
    });
  }

  init();
})();
