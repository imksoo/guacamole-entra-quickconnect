/* Always add recording and typescript when sending Quick Connect */
(function () {
  angular.module('index').run(['$document', function ($document) {

    function ensureParam(url, name, value) {
      const has = new RegExp('(?:[?&])' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=').test(url);
      if (has) return url;
      return url + (url.indexOf('?') >= 0 ? '&' : '?') + name + '=' + encodeURIComponent(value);
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
      const stamp = formatStampISO();
      const proto = sanitizeForName(getProtocol(url) || 'conn');
      const host = sanitizeForName(getHost(url) || 'host');

      // Only enable screen recording for graphical protocols
      if (proto === 'rdp' || proto === 'vnc') {
        // Use a dedicated subdir to avoid collisions; it will be created if missing
        url = ensureParam(url, 'recording-path', '/var/lib/guacamole/recordings/rec');
        // Keep ${GUAC_USERNAME} literal for server-side token expansion
        url = ensureParam(url, 'recording-name', stamp + '-rec-' + proto + '-' + host + '-${GUAC_USERNAME}');
        url = ensureParam(url, 'create-recording-path', 'true');
        // Include key events (adjust to audit policy)
        url = ensureParam(url, 'recording-include-keys', 'true');
        // Append if file already exists (set to false to reject)
        url = ensureParam(url, 'recording-write-existing', 'true');
      }

      // Enable typescript for text-based protocols
      if (proto === 'ssh' || proto === 'telnet') {
        url = ensureParam(url, 'typescript-path', '/var/lib/guacamole/recordings/ts');
        url = ensureParam(url, 'create-typescript-path', 'true');
        // Include username in typescript file name as well (server-side token)
        url = ensureParam(url, 'typescript-name', stamp + '-ts-' + proto + '-' + host + '-${GUAC_USERNAME}');
        url = ensureParam(url, 'typescript-write-existing', 'true');
      }

      // --- Protocol tweaks often used with QuickConnect (optional) ---
      url = ensureParam(url, 'security', 'nla');
      url = ensureParam(url, 'ignore-cert', 'true');

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

    doc.addEventListener('click', function (e) {
      if (isQuickConnectTarget(e.target)) enhanceAndSync();
    }, true);

    doc.addEventListener('submit', function (e) {
      const form = e.target;
      if (form && form.matches && form.matches('form[ng-submit="quickConnect()"]')) enhanceAndSync();
    }, true);

    // As a fallback, enhance on input blur
    doc.addEventListener('blur', function (e) {
      const el = e.target;
      if (el && el.matches && (el.matches('input.quickconnect-field') || el.matches('[ng-model="uri"]'))) enhanceAndSync();
    }, true);

  }]);
})();
