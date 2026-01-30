/* Always add recording and typescript when sending Quick Connect */
(function () {
  angular.module('index').run(['$document', function ($document) {

    // --- QuickConnect defaults support -------------------------------------
    // 1) REST: /api/ext/quickconnect-recording-defaults/defaults (only)

    let qcParams = null; // Map of paramName -> value (e.g. { 'enable-font-smoothing': 'true' })
    let serverDefaults = null; // Raw defaults object from REST (may include templates)
    let serverStamp = null; // Server-provided timestamp string

    function toParamName(qcKey) {
      return qcKey.replace(/^QUICKCONNECT_DEFAULT_/i, '')
                  .toLowerCase()
                  .replace(/_/g, '-');
    }

    function buildQCMap(obj) {
      const map = {};
      if (!obj || typeof obj !== 'object') return map;
      Object.keys(obj).forEach((k) => {
        const v = obj[k];
        if (v === undefined || v === null) return;
        if (/^QUICKCONNECT_DEFAULT_/i.test(k)) {
          const name = toParamName(k);
          map[name] = String(v);
        } else {
          map[k] = String(v);
        }
      });
      return map;
    }

    function fetchJSON(url) {
      return fetch(url, { cache: 'no-cache', credentials: 'same-origin' })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
    }

    function loadDefaultsNow() {
      // Guacamole 1.6+: REST resources live under /api/ext/{namespace}/...
      return fetchJSON('/api/ext/quickconnect-recording-defaults/defaults').then((restData) => {
        if (!restData) return;
        if (restData && restData.defaults && typeof restData.defaults === 'object') {
          serverDefaults = restData.defaults;
          qcParams = buildQCMap(restData.defaults);
          serverStamp = restData.stamp || null;
        } else {
          // Backward-compatible: flat object
          serverDefaults = restData;
          qcParams = buildQCMap(restData);
          serverStamp = null;
        }
      });
    }

    function applyTemplate(tpl, ctx) {
      return String(tpl || '')
        .replace(/\$\{STAMP\}/g, ctx.STAMP || '')
        .replace(/\$\{PROTO\}/g, ctx.PROTO || '')
        .replace(/\$\{HOST\}/g, ctx.HOST || '')
        ;
    }

    function ensureParam(url, name, value) {
      const has = new RegExp('(?:[?&])' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=').test(url);
      if (has) return url;
      return url + (url.indexOf('?') >= 0 ? '&' : '?') + name + '=' + encodeURIComponent(value);
    }

    function setParam(url, name, value) {
      const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp('([?&])' + esc + '=([^&#]*)');
      if (re.test(url)) return url.replace(re, function(_, sep, old) { return sep + name + '=' + encodeURIComponent(value); });
      return ensureParam(url, name, value);
    }

    function getProtocol(uri) {
      try {
        const u = new URL(uri, window.location.origin);
        if (u.protocol) return u.protocol.replace(':', '').toLowerCase();
      } catch (e) {
        const m1 = uri.match(/^(\w+):\/\//);
        if (m1) return m1[1].toLowerCase();
        const m2 = uri.match(/[?&]protocol=([^&#]+)/i);
        if (m2) return decodeURIComponent(m2[1]).toLowerCase();
      }
      return '';
    }

    function getHost(uri) {
      try {
        const u = new URL(uri, window.location.origin);
        if (u.hostname) return u.hostname;
      } catch (e) { }
      const m = uri.match(/^(?:\w+:\/\/)?([^\/:?#&]+)/);
      if (m) return m[1];
      const keys = ['hostname', 'host', 'destination'];
      for (const k of keys) {
        const r = new RegExp('[?&]'+k+'=([^&#]+)','i');
        const mm = uri.match(r);
        if (mm) return decodeURIComponent(mm[1]);
      }
      return '';
    }

    function hasPort(uri) {
      try {
        const u = new URL(uri, window.location.origin);
        if (u.port) return true;
      } catch (e) { }
      if (/^[a-z][a-z0-9+.-]*:\/\/[^/?#:]+:\d+/.test(uri)) return true;
      if (/^[^/?#:]+:\d+/.test(uri)) return true;
      if (/[?&]port=\d+/i.test(uri)) return true;
      return false;
    }

    function sanitizeForName(s) {
      if (!s) return '';
      return s.toLowerCase().replace(/[^a-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
    }

    function formatStampISO() {
      const iso = new Date().toISOString();
      return iso.replace(/\..*Z$/, 'Z').replace(/:/g, '-');
    }

    function enhanceQuickConnect() {
      const input = document.querySelector('input.quickconnect-field, [ng-model="uri"]');
      if (!input || !input.value) return;

      let url = input.value.trim();
      const stamp = serverStamp || formatStampISO();
      const proto = sanitizeForName(getProtocol(url) || 'conn');
      const host = sanitizeForName(getHost(url) || 'host');

      if (proto === 'vnc' && !hasPort(url)) {
        url = setParam(url, 'port', '5900');
      }

      if ((proto === 'rdp' || proto === 'vnc') && serverDefaults) {
        if ('recording-path' in qcParams) url = setParam(url, 'recording-path', qcParams['recording-path']);
        if ('create-recording-path' in qcParams) url = setParam(url, 'create-recording-path', qcParams['create-recording-path']);
        if ('recording-include-keys' in qcParams) url = setParam(url, 'recording-include-keys', qcParams['recording-include-keys']);
        if ('recording-write-existing' in qcParams) url = setParam(url, 'recording-write-existing', qcParams['recording-write-existing']);
        const rtpl = (serverDefaults['QUICKCONNECT_DEFAULT_RECORDING_NAME_TEMPLATE'] || qcParams['recording-name-template']);
        if (rtpl) {
          const name = applyTemplate(rtpl, { STAMP: stamp, PROTO: proto, HOST: host });
          url = setParam(url, 'recording-name', name);
        }
      }

      if ((proto === 'ssh' || proto === 'telnet') && serverDefaults) {
        if ('typescript-path' in qcParams) url = setParam(url, 'typescript-path', qcParams['typescript-path']);
        if ('create-typescript-path' in qcParams) url = setParam(url, 'create-typescript-path', qcParams['create-typescript-path']);
        if ('typescript-write-existing' in qcParams) url = setParam(url, 'typescript-write-existing', qcParams['typescript-write-existing']);
        const ttpl = (serverDefaults['QUICKCONNECT_DEFAULT_TYPESCRIPT_NAME_TEMPLATE'] || qcParams['typescript-name-template']);
        if (ttpl) {
          const name = applyTemplate(ttpl, { STAMP: stamp, PROTO: proto, HOST: host });
          url = setParam(url, 'typescript-name', name);
        }
      }

      if (qcParams && typeof qcParams === 'object') {
        Object.keys(qcParams).forEach((param) => {
          if (/\btemplate$/i.test(param)) return;
          url = setParam(url, param, qcParams[param]);
        });
      }

      console.log("[quickconnect-recording-defaults] Enhanced QuickConnect URL:", url);
      input.value = url;
    }

    function enhanceAndSync() {
      const input = document.querySelector('input.quickconnect-field, [ng-model=\"uri\"]');
      if (!input) return;
      const before = input.value;
      enhanceQuickConnect();
      if (input.value !== before) {
        const ev = new Event('input', { bubbles: true, cancelable: false });
        input.dispatchEvent(ev);
      }
    }

    const doc = $document[0];
    let reemitting = false;
    function isQuickConnectTarget(el) {
      if (!el) return false;
      if (el.matches && (el.matches('button.quickconnect-button') || el.matches('[ng-click=\"quickConnect()\"]'))) return true;
      let p = el;
      for (let i = 0; i < 3 && p; i++) {
        if (p.matches && (p.matches('button.quickconnect-button') || p.matches('[ng-click=\"quickConnect()\"]'))) return true;
        p = p.parentElement;
      }
      return false;
    }

    function resumeQuickConnect() {
      try {
        const form = document.querySelector('form[ng-submit=\"quickConnect()\"]');
        if (form && window.angular && angular.element) {
          const scope = angular.element(form).scope();
          if (scope && typeof scope.quickConnect === 'function') {
            scope.$applyAsync(function() { scope.quickConnect(); });
            return true;
          }
        }
      } catch (e) { }
      const btn = document.querySelector('button.quickconnect-button, [ng-click=\"quickConnect()\"]');
      if (btn) {
        reemitting = true;
        btn.click();
        reemitting = false;
        return true;
      }
      return false;
    }

    function interceptAndProceed(targetEl) {
      return loadDefaultsNow().then(function () {
        enhanceAndSync();
        resumeQuickConnect();
      });
    }

    doc.addEventListener('click', function (e) {
      if (reemitting) return;
      if (isQuickConnectTarget(e.target)) {
        e.stopImmediatePropagation();
        e.preventDefault();
        interceptAndProceed(e.target);
      }
    }, true);

    doc.addEventListener('submit', function (e) {
      if (reemitting) return;
      const form = e.target;
      if (form && form.matches && form.matches('form[ng-submit=\"quickConnect()\"]')) {
        e.stopImmediatePropagation();
        e.preventDefault();
        interceptAndProceed(form);
      }
    }, true);

  }]);
})();
