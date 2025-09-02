package jp.wirednet.guacamole.qc;

import com.google.inject.servlet.ServletModule;

/**
 * Registers QuickConnectDefaultsServlet to expose default param JSON.
 * Endpoint: /quickconnect/defaults
 */
public class QuickConnectServletModule extends ServletModule {
    @Override
    protected void configureServlets() {
        System.out.println("[quickconnect-recording-defaults] Guice configureServlets invoked");
        serve("/quickconnect/defaults").with(QuickConnectDefaultsServlet.class);
        serve("/quickconnect/ping").with(QuickConnectPingServlet.class);
    }
}
