package net.anonlauncher.chat;

import java.lang.reflect.Method;
import java.util.List;

/**
 * Static hook invoked from the transformed {@code ChatHud.addMessage()}.
 * <p>
 * The first argument (a Minecraft Text/Component object) is passed as a raw
 * {@code Object} to avoid hardcoding version-specific interface names in the
 * bytecode transformer. This class uses Java reflection to convert it to a
 * plain {@link String} via {@code getString()} or falls back to {@code toString()}.
 * <p>
 * Once converted, the message is checked against the configured chat windows,
 * tabs, and filters. If matched by a filter with {@code shouldHideMessage = true},
 * the message is blocked from the vanilla chat.
 *
 * @return {@code true} to block the message from vanilla chat,
 *         {@code false} to let it pass through normally.
 */
public final class ChatHudHook {

    private static final Method TEXT_GET_STRING;

    static {
        Method m = null;
        try {
            // Try to find getString() on the Text/Component interface
            // Works on: class_2561 (Yarn), Text (Mojmap 1.17+), Component (Mojmap 1.19+)
            m = Class.forName("net.minecraft.class_2561").getMethod("getString");
        } catch (final Exception ignored) {
            try {
                m = Class.forName("net.minecraft.text.Text").getMethod("getString");
            } catch (final Exception ignored2) {
                try {
                    m = Class.forName("net.minecraft.network.chat.Component").getMethod("getString");
                } catch (final Exception ignored3) {
                    // Fallback to toString() will be used
                }
            }
        }
        TEXT_GET_STRING = m;
    }

    private static long lastCleanup = 0L;

    private ChatHudHook() {
    }

    /**
     * Called from the transformed {@code addMessage(Object)} method.
     * The raw component object is converted to a String using reflection.
     *
     * @param component the Text/Component object from Minecraft
     * @return {@code true} to block the message from vanilla chat
     */
    public static boolean shouldBlock(final Object component) {
        if (component == null) return false;

        // Periodic cleanup
        if (System.currentTimeMillis() - lastCleanup > 30_000L) {
            lastCleanup = System.currentTimeMillis();
        }

        // Convert to String using reflection
        final String message = componentToString(component);
        if (message == null || message.isEmpty()) return false;

        final ChatConfig config = ChatConfig.getInstance();
        if (config == null) return false;

        final List<ChatConfig.Window> windows = config.getWindows();
        if (windows == null || windows.isEmpty()) return false;

        // Check each window and its tabs
        for (final ChatConfig.Window window : windows) {
            if (window == null || window.getTabs() == null) continue;

            for (final ChatConfig.Tab tab : window.getTabs()) {
                if (tab == null || tab.getFilters() == null) continue;

                for (final ChatConfig.Filter filter : tab.getFilters()) {
                    if (filter == null) continue;

                    if (filter.matches(message)) {
                        // If the filter hides messages, block from vanilla chat
                        if (filter.isShouldHideMessage()) {
                            return true;
                        }
                    }
                }
            }
        }

        return false;
    }

    /**
     * Convert a Minecraft Text/Component object to a plain String.
     * Tries {@code getString()} first, then falls back to {@code toString()}.
     */
    private static String componentToString(final Object component) {
        if (TEXT_GET_STRING != null) {
            try {
                return (String) TEXT_GET_STRING.invoke(component);
            } catch (final Exception ignored) {
                // Fall through to toString()
            }
        }

        // Fallback: toString() gives the JSON/serialized form,
        // or the plain text for older versions
        final String str = component.toString();

        // For modern JSON-based components, try to extract plain text
        // Strip JSON formatting like {"text":"hello"} -> hello
        if (str != null && str.startsWith("{")) {
            try {
                final com.google.gson.JsonObject json =
                        com.google.gson.JsonParser.parseString(str).getAsJsonObject();
                if (json.has("text")) {
                    return json.get("text").getAsString();
                }
                // For translate/text components, get the full text recursively
                final StringBuilder sb = new StringBuilder();
                extractText(json, sb);
                if (sb.length() > 0) return sb.toString();
            } catch (final Exception ignored) {
                // Return the raw toString
            }
        }

        return str;
    }

    /**
     * Recursively extract text from JSON components (e.g., {"translate":"...","with":[...]}).
     */
    private static void extractText(final com.google.gson.JsonObject json, final StringBuilder sb) {
        if (json.has("text")) {
            sb.append(json.get("text").getAsString());
        }
        if (json.has("translate") && json.has("with")) {
            // Translate components have "with" array of sub-components
            final var with = json.getAsJsonArray("with");
            if (with != null) {
                for (final var element : with) {
                    if (element != null && element.isJsonObject()) {
                        extractText(element.getAsJsonObject(), sb);
                    }
                }
            }
        }
        if (json.has("extra")) {
            final var extra = json.getAsJsonArray("extra");
            if (extra != null) {
                for (final var element : extra) {
                    if (element != null && element.isJsonObject()) {
                        extractText(element.getAsJsonObject(), sb);
                    }
                }
            }
        }
    }
}
