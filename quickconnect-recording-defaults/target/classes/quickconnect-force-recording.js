/* Always add recording and typescript when sending Quick Connect */
(function () {
  angular.module('index').run(['$document', function ($document) {

    // --- QuickConnect defaults support -------------------------------------
    // Optionally load default parameters from either:
    // 1) REST: /api/quickconnect/defaults (only)
    //
    // Any QUICKCONNECT_DEFAULT_* key becomes a query parameter where:
    //   QUICKCONNECT_DEFAULT_ENABLE_FONT_SMOOTHING => enable-font-smoothing
    // Values are used as-is (strings) and will override existing values.

    let qcParams = null; // Map of paramName -> value (e.g. { 'enable-font-smoothing': 'true' })
    let serverDefaults = null; // Raw defaults object from REST (may include templates)
    let serverStamp = null; // Server-provided timestamp string

    function toParamName(qcKey) {
      return qcKey.replace(/^QUICKCONNECT_DEFAULT_/i, '')
                  .toLowerCase()
                  .replace(/_/g, '-');
    }

    // no scriptsBasePath needed as we only use REST now

    function buildQCMap(obj) {
      const map = {};
      if (!obj || typeof obj !== 'object') return map;
      Object.keys(obj).forEach((k) => {
        const v = obj[k];
        if (v === undefined || v === null) return;
        if (/^QUICKCONNECT_DEFAULT_/i.test(k)) {
          // Convert env-style to param-style
          const name = toParamName(k);
          map[name] = String(v);
        } else {
          // Already param-style (e.g. 'recording-path'), copy as-is
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
      return fetchJSON('/api/ext/quickconnect-force-recording/defaults').then((restData) => {
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
        // Keep ${GUAC_USERNAME} literal for server-side token expansion
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
        // Absolute URI like ssh://host or rdp://host
        const u = new URL(uri, window.location.origin);
        if (u.protocol) return u.protocol.replace(':', '').toLowerCase();
      } catch (e) {
        // Fallback: look for protocol= in query or leading word before ://
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
      } catch (e) {
        // ignore
      }
      const m = uri.match(/^(?:\w+:\/\/)?([^\/:?#&]+)/);
      if (m) return m[1];
      // query param fallbacks
      const keys = ['hostname', 'host', 'destination'];
      for (const k of keys) {
        const r = new RegExp('[?&]'+k+'=([^&#]+)','i');
        const mm = uri.match(r);
        if (mm) return decodeURIComponent(mm[1]);
      }
      return '';
    }

    function sanitizeForName(s) {
      if (!s) return '';
      return s.toLowerCase().replace(/[^a-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
    }

    // ISO timestamp safe for Windows filesystems: 2025-09-01T08-15Z
    function formatStampISO() {
      // Example ISO: 2025-09-01T08:15:30.123Z
      const iso = new Date().toISOString();
      // Remove milliseconds and replace colon with dash
      return iso.replace(/\..*Z$/, 'Z').replace(/:/g, '-');
    }

    function enhanceQuickConnect() {
      const input = document.querySelector('input.quickconnect-field, [ng-model="uri"]');
      if (!input || !input.value) return;

      let url = input.value.trim();
      const stamp = serverStamp || formatStampISO();
      const proto = sanitizeForName(getProtocol(url) || 'conn');
      const host = sanitizeForName(getHost(url) || 'host');

      // Only apply recording params for graphical protocols if provided by server
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

      // Apply typescript params for text-based protocols if provided by server
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

      // Apply server-provided defaults for any remaining simple params
      if (qcParams && typeof qcParams === 'object') {
        Object.keys(qcParams).forEach((param) => {
          if (/\btemplate$/i.test(param)) return; // skip templates
          url = setParam(url, param, qcParams[param]);
        });
      }

      console.log("[quickconnect-force-recording] Enhanced QuickConnect URL:", url);
      input.value = url;
    }

    // Keep Angular model in sync by dispatching an 'input' event after updating value
    function enhanceAndSync() {
      const input = document.querySelector('input.quickconnect-field, [ng-model="uri"]');
      if (!input) return;
      const before = input.value;
      enhanceQuickConnect();
      if (input.value !== before) {
        const ev = new Event('input', { bubbles: true, cancelable: false });
        input.dispatchEvent(ev);
      }
    }

    // Use capture so this runs BEFORE Angular's ng-click/ng-submit handlers
    const doc = $document[0];
    let reemitting = false;
    function isQuickConnectTarget(el) {
      if (!el) return false;
      if (el.matches && (el.matches('button.quickconnect-button') || el.matches('[ng-click="quickConnect()"]'))) return true;
      // climb up a few levels to catch inner elements
      let p = el;
      for (let i = 0; i < 3 && p; i++) {
        if (p.matches && (p.matches('button.quickconnect-button') || p.matches('[ng-click="quickConnect()"]'))) return true;
        p = p.parentElement;
      }
      return false;
    }

    function resumeQuickConnect() {
      try {
        // Prefer invoking Angular's quickConnect() directly
        const form = document.querySelector('form[ng-submit="quickConnect()"]');
        if (form && window.angular && angular.element) {
          const scope = angular.element(form).scope();
          if (scope && typeof scope.quickConnect === 'function') {
            scope.$applyAsync(function() { scope.quickConnect(); });
            return true;
          }
        }
      } catch (e) { /* ignore */ }
      // Fallback: re-dispatch a click on the visible QuickConnect button
      const btn = document.querySelector('button.quickconnect-button, [ng-click="quickConnect()"]');
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
      if (reemitting) return; // allow our synthetic click to pass through
      if (isQuickConnectTarget(e.target)) {
        e.stopImmediatePropagation();
        e.preventDefault();
        interceptAndProceed(e.target);
      }
    }, true);

    doc.addEventListener('submit', function (e) {
      if (reemitting) return;
      const form = e.target;
      if (form && form.matches && form.matches('form[ng-submit="quickConnect()"]')) {
        e.stopImmediatePropagation();
        e.preventDefault();
        interceptAndProceed(form);
      }
    }, true);

    // As a fallback, enhance on input blur
    // We no longer enhance on blur to avoid stale timing; enhancement is tied to click/submit.

  }]);
})();
