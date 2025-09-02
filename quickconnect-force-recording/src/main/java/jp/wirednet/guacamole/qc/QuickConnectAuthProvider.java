package jp.wirednet.guacamole.qc;
import javax.servlet.http.HttpServlet;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.AuthenticatedUser;
import org.apache.guacamole.net.auth.Credentials;
import org.apache.guacamole.net.auth.UserContext;
import org.apache.guacamole.net.auth.simple.SimpleAuthenticationProvider;
import org.apache.guacamole.protocol.GuacamoleConfiguration;

import java.util.Collection;
import java.util.Collections;

/**
 * No-op auth provider which only contributes a servlet module to expose
 * /api/quickconnect/defaults.
 */
public class QuickConnectAuthProvider extends SimpleAuthenticationProvider {

    static {
        System.out.println("[quickconnect-force-recording] QuickConnectAuthProvider class loaded");
    }

    @Override
    public String getIdentifier() {
        return "quickconnect-recording-defaults";
    }

    @Override
    public AuthenticatedUser authenticateUser(Credentials credentials) throws GuacamoleException {
        // Do not handle authentication; let other providers do it
        return null;
    }

    @Override
    public UserContext getUserContext(AuthenticatedUser authenticatedUser) throws GuacamoleException {
        // No user context provided
        return null;
    }

    @Override
    public java.util.Map<String, GuacamoleConfiguration> getAuthorizedConfigurations(Credentials credentials) throws GuacamoleException {
        // No connections are provided by this extension
        return java.util.Collections.emptyMap();
    }

    // Also contribute servlets via a Guice ServletModule for environments
    // that mount extension servlets through Guice.
    public Collection<? extends com.google.inject.Module> getModules() {
        java.util.List<com.google.inject.Module> list = new java.util.ArrayList<>();
        list.add(new QuickConnectServletModule());
        return list;
    }

    // Provide the alternative hook some versions expect.
    public Collection<? extends com.google.inject.Module> getGuiceModules() {
        return getModules();
    }

    // Guacamole 1.6.0+ expects REST resources via getResource().
    // This exposes endpoints under /api/ext/{identifier}/...
    @Override
    public Object getResource() throws GuacamoleException {
        System.out.println("[quickconnect-recording-defaults] getResource() -> QuickConnectResource (@ /api/ext/" + getIdentifier() + ")");
        return new QuickConnectResource();
    }
}
