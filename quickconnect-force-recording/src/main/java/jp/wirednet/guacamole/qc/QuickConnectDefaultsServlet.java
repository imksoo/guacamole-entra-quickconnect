package jp.wirednet.guacamole.qc;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.time.Instant;
import java.util.Map;
import java.util.TreeMap;

public class QuickConnectDefaultsServlet extends HttpServlet {

    private static String toParamName(String key, String prefix) {
        String k = key.substring(prefix.length());
        return k.toLowerCase().replace('_', '-');
    }

    private static Map<String, String> loadDefaults() {
        Map<String, String> out = new TreeMap<>();
        Map<String, String> env = System.getenv();

        // Accepted prefix: QUICKCONNECT_DEFAULT_
        for (Map.Entry<String, String> e : env.entrySet()) {
            String k = e.getKey();
            String v = e.getValue();
            if (v == null) continue;
            if (k.startsWith("QUICKCONNECT_DEFAULT_")) {
                out.put(toParamName(k, "QUICKCONNECT_DEFAULT_"), v);
            }
        }

        // Provide safe, opinionated defaults if not explicitly set via env
        String base = System.getenv().getOrDefault("RECORDING_SEARCH_PATH", "/var/lib/guacamole/recordings");
        base = stripTrailingSlash(base);
        putIfAbsent(out, "recording-path", base + "/rec");
        putIfAbsent(out, "create-recording-path", "true");
        putIfAbsent(out, "recording-include-keys", "true");
        putIfAbsent(out, "recording-write-existing", "true");

        putIfAbsent(out, "typescript-path", base + "/ts");
        putIfAbsent(out, "create-typescript-path", "true");
        putIfAbsent(out, "typescript-write-existing", "true");

        // Name templates (server-provided, client fills PROTO/HOST tokens)
        putIfAbsent(out, "recording-name-template", "${STAMP}-rec-${PROTO}-${HOST}-${GUAC_USERNAME}");
        putIfAbsent(out, "typescript-name-template", "${STAMP}-ts-${PROTO}-${HOST}-${GUAC_USERNAME}");

        return out;
    }

    private static void putIfAbsent(Map<String, String> map, String key, String value) {
        if (!map.containsKey(key)) map.put(key, value);
    }

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        resp.setCharacterEncoding("UTF-8");
        resp.setContentType("application/json");

        Map<String, String> defaults = loadDefaults();
        String stamp = formatStamp();

        try (PrintWriter w = resp.getWriter()) {
            // { "defaults": { ... }, "stamp": "..." }
            w.print('{');
            w.print("\"defaults\":{");
            boolean first = true;
            for (Map.Entry<String, String> e : defaults.entrySet()) {
                if (!first) w.print(',');
                first = false;
                String k = e.getKey();
                String v = e.getValue();
                w.print('"');
                w.print(escape(k));
                w.print('"');
                w.print(':');
                w.print('"');
                w.print(escape(v));
                w.print('"');
            }
            w.print('}');
            w.print(',');
            w.print("\"stamp\":\"");
            w.print(escape(stamp));
            w.print("\"}");
        }
    }

    private static String formatStamp() {
        // ISO-like string without milliseconds, ':' replaced with '-'
        String iso = Instant.now().toString(); // e.g. 2025-09-01T08:15:30.123Z
        int dot = iso.indexOf('.');
        if (dot >= 0) {
            int z = iso.indexOf('Z', dot);
            if (z >= 0) iso = iso.substring(0, z + 1);
        }
        return iso.replace(':', '-');
    }

    private static String stripTrailingSlash(String s) {
        if (s == null || s.isEmpty()) return s;
        String normalized = java.nio.file.Paths.get(s).normalize().toString();
        if (normalized.isEmpty() || ".".equals(normalized)) {
            // Prefer current working directory for better writeability
            String cwd = java.nio.file.Paths.get("").toAbsolutePath().normalize().toString();
            if (cwd != null && !cwd.isEmpty()) return cwd;
            // Last resort: fall back to a platform root/separator
            java.nio.file.FileSystem fs = java.nio.file.FileSystems.getDefault();
            java.util.Iterator<java.nio.file.Path> it = fs.getRootDirectories().iterator();
            if (it.hasNext()) return it.next().toString();
            return java.io.File.separator;
        }
        return normalized;
    }

    private static String escape(String s) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"': sb.append("\\\""); break;
                case '\\': sb.append("\\\\"); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                default:
                    if (c < 0x20) {
                        sb.append(String.format("\\u%04x", (int)c));
                    } else {
                        sb.append(c);
                    }
            }
        }
        return sb.toString();
    }
}
