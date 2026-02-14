(() => {
  "use strict";

  // 只在 bilibili 域名下运行
  if (!/(^|\.)bilibili\.com$/.test(location.hostname)) return;

  // ========= 存储键（含兼容旧版本） =========
  const KEYS = {
    enabled: "bs_enabled",
    wallpaper: "bs_wallpaper", // {kind:'none'|'url'|'data', value:string}
    cleanup: "bs_cleanup" // 配置隐藏项
  };

  const LEGACY_KEYS = [
    { enabled: "biliStudyEnabled", wallpaper: "biliStudyWallpaper" },
    { enabled: "biliStudyEnabledV1", wallpaper: "wallpaper" },
    { enabled: "enabled", wallpaper: "wallpaper" }
  ];

  const LS_SHADOW_ENABLED = "bs_enabled_shadow_v1";

  const DEFAULTS = {
    [KEYS.enabled]: true,
    [KEYS.wallpaper]: { kind: "none", value: "" },
    [KEYS.cleanup]: {
      hideMatch: true,         // 赛事
      hideCreator: true,       // 创作中心
      hideSubmit: true,        // 投稿
      hideExtraLeftNav: true   // 番剧/直播/游戏中心/下载客户端/会员购/漫画(可选)
    }
  };

  const state = {
    enabled: true,
    wallpaper: { kind: "none", value: "" },
    cleanup: { ...DEFAULTS[KEYS.cleanup] }
  };

  // ========= 路由判断 =========
  const ROUTE = {
    type() {
      const host = location.hostname;
      const path = location.pathname || "/";
      if (host === "www.bilibili.com" && (path === "/" || path === "/index.html")) return "home";
      if (host === "www.bilibili.com" && path.startsWith("/video/")) return "video";
      return "other";
    },
    isHome() {
      return ROUTE.type() === "home";
    }
  };

  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const storageGet = (defaults) =>
    new Promise((resolve) => {
      try {
        chrome.storage.local.get(defaults, (res) => resolve(res || defaults));
      } catch {
        resolve(defaults);
      }
    });

  const storageSet = (obj) =>
    new Promise((resolve) => {
      try {
        chrome.storage.local.set(obj, () => resolve());
      } catch {
        resolve();
      }
    });

  function setHtmlFlags() {
    const html = document.documentElement;
    html.classList.toggle("bs-on", !!state.enabled);
    html.classList.remove("bs-home", "bs-video", "bs-other");
    html.classList.add(`bs-${ROUTE.type()}`);
  }

  function getUserMidFromCookie() {
    const m = document.cookie.match(/(?:^|;\s*)DedeUserID=(\d+)/);
    return m ? m[1] : "";
  }

  function urlFav() {
    const mid = getUserMidFromCookie();
    return mid ? `https://space.bilibili.com/${mid}/favlist` : "https://space.bilibili.com/";
  }

  function urlHistory() {
    return "https://www.bilibili.com/account/history";
  }

  const URLS = {
    home: "https://www.bilibili.com/",
    dynamic: "https://t.bilibili.com/",
    fav: urlFav,
    history: urlHistory,
    search: (kw) => `https://search.bilibili.com/all?keyword=${encodeURIComponent(kw)}`
  };

  // ========= 学习首页覆盖 =========
  function mountHome() {
    const html = document.documentElement;
    html.classList.add("bs-home");

    let root = document.getElementById("bs-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "bs-root";

      root.innerHTML = `
        <div class="bs-top">
          <div class="bs-brand">bilibili · 学习</div>
          <div class="bs-actions">
            <button class="bs-btn" data-act="dynamic">动态</button>
            <button class="bs-btn" data-act="fav">收藏夹</button>
            <button class="bs-btn" data-act="history">历史</button>
            <button class="bs-btn" data-act="toggle">学习：开</button>
          </div>
        </div>
        <div class="bs-main">
          <div style="width:100%; display:grid; place-items:center;">
            <div class="bs-clock">
              <div class="bs-time" id="bs-time">--:--</div>
              <div class="bs-date" id="bs-date">---</div>
            </div>
            <form class="bs-search" id="bs-search-form" autocomplete="off">
              <input id="bs-search-input" placeholder="输入搜索内容，回车搜索" />
            </form>
            <div class="bs-quick">
              <button class="bs-btn" type="button" data-act="dynamic">动态</button>
              <button class="bs-btn" type="button" data-act="fav">收藏夹</button>
              <button class="bs-btn" type="button" data-act="history">播放历史</button>
              <button class="bs-btn" type="button" data-act="origin">打开原站主页</button>
            </div>
          </div>
        </div>
      `;

      document.documentElement.appendChild(root);

      root.addEventListener("click", async (e) => {
        const btn = e.target?.closest?.("button[data-act]");
        if (!btn) return;
        const act = btn.getAttribute("data-act");

        if (act === "dynamic") location.href = URLS.dynamic;
        if (act === "fav") location.href = URLS.fav();
        if (act === "history") location.href = URLS.history();
        if (act === "origin") location.href = URLS.home;

        if (act === "toggle") {
          state.enabled = !state.enabled;
          await storageSet({ [KEYS.enabled]: state.enabled });
          localStorage.setItem(LS_SHADOW_ENABLED, state.enabled ? "1" : "0");
          location.reload();
        }
      });

      const form = qs("#bs-search-form", root);
      const input = qs("#bs-search-input", root);

      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const kw = (input.value || "").trim();
        if (!kw) return;
        location.href = URLS.search(kw);
      });

      const tick = () => {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, "0");
        const mm = String(now.getMinutes()).padStart(2, "0");
        const timeEl = qs("#bs-time", root);
        const dateEl = qs("#bs-date", root);
        if (timeEl) timeEl.textContent = `${hh}:${mm}`;
        if (dateEl) {
          const week = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"][now.getDay()];
          dateEl.textContent = `${now.getMonth() + 1}月${now.getDate()}日  ${week}`;
        }
      };
      tick();
      setInterval(tick, 1000 * 20);
      setTimeout(() => input?.focus?.(), 50);
    }

    applyWallpaperToHome();
    const toggleBtn = qs('button[data-act="toggle"]', root);
    if (toggleBtn) toggleBtn.textContent = `学习：${state.enabled ? "开" : "关"}`;
  }

  function unmountHome() {
    document.getElementById("bs-root")?.remove();
    document.documentElement.classList.remove("bs-home");
  }

  function applyWallpaperToHome() {
    const root = document.getElementById("bs-root");
    if (!root) return;
    const { kind, value } = state.wallpaper || {};
    if (!state.enabled || !kind || kind === "none" || !value) {
      root.style.backgroundImage = "";
      return;
    }
    root.style.backgroundImage = `url("${String(value).replace(/"/g, "%22")}")`;
  }

  // ========= 头部精准净化核心逻辑 =========
  function applyHeaderCleanup() {
    if (!state.enabled) return;
    if (ROUTE.isHome()) return; 

    const cfg = state.cleanup || DEFAULTS[KEYS.cleanup];

    const hideTexts = new Set();
    if (cfg.hideMatch) hideTexts.add("赛事");
    if (cfg.hideCreator) hideTexts.add("创作中心");
    if (cfg.hideSubmit) hideTexts.add("投稿");
    if (cfg.hideExtraLeftNav) {
      ["番剧", "直播", "游戏中心", "下载客户端", "会员购", "漫画"].forEach((t) => hideTexts.add(t));
    }

    const headerRoots = [
      qs("#internationalHeader"),
      qs(".international-header"),
      qs("#bili-header-container"),
      qs(".bili-header"),
      qs("header")
    ].filter(Boolean);

    if (!headerRoots.length) return;

    const shouldHideByHref = (el) => {
      const href = (el.getAttribute?.("href") || "").toLowerCase();
      if (!href) return false;
      if (cfg.hideExtraLeftNav && (href.includes("game") || href.includes("live") || href.includes("blackboard") || href.includes("app.bilibili") || href.includes("platform"))) {
        return true;
      }
      return false;
    };

    const textOf = (node) => (node.textContent || "").replace(/\s+/g, "").trim();

    const hideNode = (node) => {
      if (!node || node.dataset?.bsKeep === "1") return;
      if (node.dataset) node.dataset.bsHidden = "1";
      node.style.setProperty("display", "none", "important");
    };

    const unhideAll = (root) => {
      qsa("[data-bs-hidden='1']", root).forEach((n) => {
        n.style.removeProperty("display");
        delete n.dataset.bsHidden;
      });
    };

    // 严禁被隐藏的核心布局容器
    const isLayoutRoot = (node) => {
      if (!node || ['HEADER', 'BODY', 'HTML'].includes(node.tagName)) return true;
      if (!node.classList) return false;
      return node.classList.contains('left-entry') || 
             node.classList.contains('right-entry') || 
             node.classList.contains('bili-header__channel') || 
             node.classList.contains('bili-header__bar') ||
             node.classList.contains('international-header');
    };

    headerRoots.forEach((hr) => {
      unhideAll(hr);

      // 只获取真正可交互的底层元素，缩小范围防止误判
      const candidates = qsa("a, button, [role='button']", hr);

      candidates.forEach((el) => {
        const t = textOf(el);
        const aria = (el.getAttribute?.("aria-label") || "").replace(/\s+/g, "");
        const title = (el.getAttribute?.("title") || "").replace(/\s+/g, "");

        const hitText = (t && hideTexts.has(t)) || (aria && hideTexts.has(aria)) || (title && hideTexts.has(title));
        const hitHref = shouldHideByHref(el);

        if (!hitText && !hitHref) return;

        let wrapper = el;
        const elText = t; // 以当前命中元素的纯文本为锚点

        // --- 核心启发式向上判定 ---
        while (wrapper.parentElement && !isLayoutRoot(wrapper.parentElement)) {
            const p = wrapper.parentElement;

            // 1. 如果这是一个下拉菜单组件，且我们命中的是这个组件的主入口（为了避免隐藏后留下触发空洞）
            if (p.classList && p.classList.contains('v-popover-wrap')) {
                // 前提：这绝不能是头像组件！
                if (!p.querySelector('.bili-avatar, .header-avatar-wrap, picture')) {
                    const firstA = p.querySelector('a');
                    if (firstA === el || firstA === wrapper) {
                        wrapper = p; // 确认为主入口，连带下拉菜单一并隐藏
                        continue;
                    }
                }
            }

            // 2. 最关键的文本隔离法：
            // 只有当父级容器的纯文本 和 当前我们要隐藏的纯文本 【完全一模一样】 时，才允许隐藏父级。
            // 只要父级多了哪怕一个字（比如包含了旁边的“首页”或“番剧”），立刻停止向上牵连！
            const pText = textOf(p);
            if (pText === elText && elText !== "") {
                wrapper = p;
            } else {
                break;
            }
        }

        // --- 终极保命兜底 ---
        // 算出来的 wrapper 里，只要含有以下任何核心资产，立即停止隐藏操作
        if (wrapper.querySelector('.bili-avatar, .header-avatar-wrap, picture, .bili-header__bar-logo, .nav-search-input')) {
            return; 
        }

        hideNode(wrapper);
      });
    });
  }

  // ========= 视频页标记 =========
  function applyVideoFlag() {
    const html = document.documentElement;
    html.classList.toggle("bs-video", ROUTE.type() === "video");
  }

  async function loadConfigWithMigration() {
    const res = await storageGet(DEFAULTS);

    let enabled = res[KEYS.enabled];
    let wallpaper = res[KEYS.wallpaper];
    let cleanup = res[KEYS.cleanup];

    if (enabled === undefined || enabled === null) {
      for (const k of LEGACY_KEYS) {
        const r = await storageGet({ [k.enabled]: undefined, [k.wallpaper]: undefined });
        if (typeof r[k.enabled] === "boolean") enabled = r[k.enabled];
        if (r[k.wallpaper] !== undefined && r[k.wallpaper] !== null) {
          if (typeof r[k.wallpaper] === "string") {
            wallpaper = r[k.wallpaper] ? { kind: "url", value: r[k.wallpaper] } : { kind: "none", value: "" };
          } else {
            wallpaper = r[k.wallpaper];
          }
        }
      }
    }

    state.enabled = enabled !== undefined ? !!enabled : true;
    state.wallpaper = wallpaper && typeof wallpaper === "object" ? wallpaper : DEFAULTS[KEYS.wallpaper];
    state.cleanup = cleanup && typeof cleanup === "object" ? cleanup : { ...DEFAULTS[KEYS.cleanup] };

    await storageSet({
      [KEYS.enabled]: state.enabled,
      [KEYS.wallpaper]: state.wallpaper,
      [KEYS.cleanup]: state.cleanup
    });

    localStorage.setItem(LS_SHADOW_ENABLED, state.enabled ? "1" : "0");
  }

  async function refresh() {
    await loadConfigWithMigration();
    setHtmlFlags();
    applyVideoFlag();

    if (!state.enabled) {
      unmountHome();
      document.documentElement.classList.remove("bs-prehide");
      return;
    }

    if (ROUTE.isHome()) {
      mountHome();
    } else {
      unmountHome();
      applyHeaderCleanup();
    }
    document.documentElement.classList.remove("bs-prehide");
  }

  function hookSpa() {
    const _pushState = history.pushState;
    const _replaceState = history.replaceState;

    const onUrlChange = () => {
      setTimeout(refresh, 50);
      setTimeout(refresh, 400);
    };

    history.pushState = function () {
      _pushState.apply(this, arguments);
      onUrlChange();
    };
    history.replaceState = function () {
      _replaceState.apply(this, arguments);
      onUrlChange();
    };
    window.addEventListener("popstate", onUrlChange);

    let t = null;
    const mo = new MutationObserver(() => {
      if (!state.enabled) return;
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        applyVideoFlag();
        applyHeaderCleanup();
      }, 120);
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes[KEYS.enabled] || changes[KEYS.wallpaper] || changes[KEYS.cleanup]) {
        refresh();
      }
    });
  } catch {}

  try {
    chrome.runtime.onMessage.addListener((msg) => {
      if (!msg || typeof msg !== "object") return;
      if (msg.type === "BS_NAV") {
        if (msg.key === "home") location.href = URLS.home;
        if (msg.key === "dynamic") location.href = URLS.dynamic;
        if (msg.key === "fav") location.href = URLS.fav();
        if (msg.key === "history") location.href = URLS.history();
        return;
      }
      if (msg.type === "BS_REFRESH") {
        refresh();
      }
    });
  } catch {}

  try {
    const shadow = localStorage.getItem(LS_SHADOW_ENABLED);
    const assumeEnabled = shadow !== "0";
    if (assumeEnabled && ROUTE.isHome()) {
      document.documentElement.classList.add("bs-prehide");
    }
  } catch {}

  refresh();
  hookSpa();
})();