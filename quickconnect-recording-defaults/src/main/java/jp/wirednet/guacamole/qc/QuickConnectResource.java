package jp.wirednet.guacamole.qc;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.time.Instant;
import java.util.Map;
import java.util.TreeMap;

@Path("/")
public class QuickConnectResource {

    @GET
    @Path("ping")
    @Produces(MediaType.APPLICATION_JSON)
    public Response ping() {
        return Response.ok("{\"ok\":true}")
                .type(MediaType.APPLICATION_JSON)
                .build();
    }

    @GET
    @Path("defaults")
    @Produces(MediaType.APPLICATION_JSON)
    public Map<String, Object> defaults() {
        Map<String, String> defs = loadDefaults();
        Map<String, Object> out = new TreeMap<>();
        out.put("defaults", defs);
        out.put("stamp", formatStamp());
        return out;
    }

    private static Map<String, String> loadDefaults() {
        Map<String, String> out = new TreeMap<>();
        Map<String, String> env = System.getenv();

        for (Map.Entry<String, String> e : env.entrySet()) {
            String k = e.getKey();
            String v = e.getValue();
            if (v == null) continue;
            if (k.startsWith("QUICKCONNECT_DEFAULT_")) {
                String name = k.substring("QUICKCONNECT_DEFAULT_".length())
                        .toLowerCase().replace('_', '-');
                out.put(name, v);
            }
        }

        // Resolve base recording search path from Guacamole env
        String base = env.getOrDefault("RECORDING_SEARCH_PATH", "/var/lib/guacamole/recordings");
        base = stripTrailingSlash(base);

        putIfAbsent(out, "recording-path", base + "/rec");
        putIfAbsent(out, "create-recording-path", "true");
        putIfAbsent(out, "recording-include-keys", "true");
        putIfAbsent(out, "recording-write-existing", "true");

        putIfAbsent(out, "typescript-path", base + "/ts");
        putIfAbsent(out, "create-typescript-path", "true");
        putIfAbsent(out, "typescript-write-existing", "true");

        putIfAbsent(out, "recording-name-template", "${STAMP}-rec-${PROTO}-${HOST}-${GUAC_USERNAME}");
        putIfAbsent(out, "typescript-name-template", "${STAMP}-ts-${PROTO}-${HOST}-${GUAC_USERNAME}");

        return out;
    }

    private static void putIfAbsent(Map<String, String> map, String key, String value) {
        if (!map.containsKey(key)) map.put(key, value);
    }

    private static String formatStamp() {
        String iso = Instant.now().toString();
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
}
