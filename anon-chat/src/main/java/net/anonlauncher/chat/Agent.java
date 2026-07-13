package net.anonlauncher.chat;

import java.lang.instrument.ClassFileTransformer;
import java.lang.instrument.Instrumentation;

/**
 * Java agent entry point for AnonChat.
 *
 * When attached via {@code -javaagent:anonchat.jar}, this agent:
 * 1. Registers a {@link ChatTransformer} that hooks into Minecraft's ChatHUD
 * 2. Initializes the chat config from the filesystem
 *
 * The agent transforms {@code ChatHud.addMessage(Text)} to intercept all
 * incoming chat messages and route them through the AnonChat filter/tab system.
 */
public final class Agent {

    private Agent() {
    }

    /**
     * JVM calls this method before the application's {@code main} method.
     *
     * @param agentArgs   arguments passed via {@code -javaagent:jarfile[=args]}
     * @param instrumentation the JVM's instrumentation instance
     */
    public static void premain(final String agentArgs, final Instrumentation instrumentation) {
        System.out.println("[AnonChat] Agent loaded. Initializing...");

        try {
            // Load configuration from disk
            ChatConfig.initialize();
            System.out.println("[AnonChat] Config loaded from: " + ChatConfig.getConfigPath());
        } catch (final Exception e) {
            System.err.println("[AnonChat] Failed to load config: " + e.getMessage());
            System.err.println("[AnonChat] Chat will use defaults (pass-through mode)");
        }

        // Register the transformer that hooks Minecraft's ChatHUD
        final ClassFileTransformer transformer = new ChatTransformer();
        instrumentation.addTransformer(transformer, true);

        System.out.println("[AnonChat] Transformer registered. Ready!");
    }
}
