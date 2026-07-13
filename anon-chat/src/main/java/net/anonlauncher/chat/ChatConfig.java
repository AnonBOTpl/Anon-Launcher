package net.anonlauncher.chat;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.annotations.SerializedName;

import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Loads and manages the AnonChat configuration from a JSON file.
 *
 * <p>The config file lives at {@code $APP_DATA/anonlauncher/chat.json}
 * and stores all chat windows, tabs, and filter definitions.
 *
 * <p>On Windows: {@code %APPDATA%/anonlauncher/chat.json}
 * <br>On Linux: {@code ~/.local/share/anonlauncher/chat.json}
 * <br>On macOS: {@code ~/Library/Application Support/anonlauncher/chat.json}
 */
public final class ChatConfig {

    private static volatile ChatConfig INSTANCE;
    private static String configPath;

    private final Gson gson = new GsonBuilder().setPrettyPrinting().create();

    @SerializedName("windows")
    private List<Window> windows;

    @SerializedName("configVersion")
    private int configVersion = 1;


    // ─── Initialization ─────────────────────────────────────────────

    /**
     * Initialise the config. Called once at agent startup.
     */
    public static void initialize() {
        configPath = detectConfigPath();
        final File configFile = new File(configPath);

        if (configFile.exists()) {
            try (final FileReader reader = new FileReader(configFile)) {
                final ChatConfig loaded = new Gson().fromJson(reader, ChatConfig.class);
                INSTANCE = loaded;
                System.out.println("[AnonChat] Loaded config with " +
                        (loaded.windows != null ? loaded.windows.size() : 0) + " windows");
            } catch (final IOException e) {
                System.err.println("[AnonChat] Failed to read config: " + e.getMessage());
                INSTANCE = createDefault();
            }
        } else {
            System.out.println("[AnonChat] No config found at " + configPath + ", creating defaults");
            INSTANCE = createDefault();
            INSTANCE.save();
        }
    }

    /**
     * @return the singleton config instance, or {@code null} if not initialized
     */
    public static ChatConfig getInstance() {
        return INSTANCE;
    }

    /**
     * @return the filesystem path to the config JSON file
     */
    public static String getConfigPath() {
        return configPath;
    }


    // ─── Getters ─────────────────────────────────────────────────────

    public List<Window> getWindows() {
        return windows != null ? windows : Collections.emptyList();
    }


    // ─── Persistence ─────────────────────────────────────────────────

    /**
     * Save the current config to disk.
     */
    public void save() {
        if (configPath == null) return;
        final File configFile = new File(configPath);
        final File parent = configFile.getParentFile();
        if (parent != null && !parent.exists()) {
            parent.mkdirs();
        }

        try (final FileWriter writer = new FileWriter(configFile)) {
            gson.toJson(this, writer);
        } catch (final IOException e) {
            System.err.println("[AnonChat] Failed to save config: " + e.getMessage());
        }
    }


    // ─── Config classes ──────────────────────────────────────────────

    /**
     * A chat window containing one or more tabs.
     */
    public static final class Window {
        private float x;
        private float y;
        private float width;
        private float height;

        @SerializedName("verticalAnchor")
        private String verticalAnchor = "BOTTOM";

        @SerializedName("horizontalAnchor")
        private String horizontalAnchor = "LEFT";

        @SerializedName("boundsPosition")
        private String boundsPosition = "OUTSIDE";

        @SerializedName("focusedTab")
        private int focusedTab;

        private List<Tab> tabs;


        public float getX() { return x; }
        public float getY() { return y; }
        public float getWidth() { return width; }
        public float getHeight() { return height; }
        public String getVerticalAnchor() { return verticalAnchor; }
        public String getHorizontalAnchor() { return horizontalAnchor; }
        public String getBoundsPosition() { return boundsPosition; }
        public int getFocusedTab() { return focusedTab; }
        public List<Tab> getTabs() { return tabs != null ? tabs : Collections.emptyList(); }
    }

    /**
     * A tab within a chat window, with its own filters.
     */
    public static final class Tab {
        @SerializedName("uniqueId")
        private String uniqueId;

        private String name;

        @SerializedName("type")
        private String type = "CUSTOM";

        @SerializedName("global")
        private boolean global = true;

        private List<Filter> filters;

        @SerializedName("chatLimit")
        private int chatLimit = 100;

        @SerializedName("combineChatMessages")
        private boolean combineChatMessages;

        @SerializedName("antiChatClear")
        private boolean antiChatClear;

        @SerializedName("chatTrust")
        private boolean chatTrust = true;

        @SerializedName("shadow")
        private boolean shadow = true;

        @SerializedName("background")
        private boolean background = true;


        public String getUniqueId() { return uniqueId; }
        public String getName() { return name; }
        public String getType() { return type; }
        public boolean isGlobal() { return global; }
        public List<Filter> getFilters() { return filters != null ? filters : Collections.emptyList(); }
        public int getChatLimit() { return chatLimit; }
        public boolean isCombineChatMessages() { return combineChatMessages; }
        public boolean isAntiChatClear() { return antiChatClear; }
        public boolean isChatTrust() { return chatTrust; }
        public boolean isShadow() { return shadow; }
        public boolean isBackground() { return background; }
    }

    /**
     * A filter that determines which messages go into a tab.
     */
    public static final class Filter {
        private String id;
        private String name;

        /**
         * If the message contains any of these tags, it matches this filter.
         */
        @SerializedName("includeTags")
        private List<String> includeTags;

        /**
         * If the message contains any of these tags, it is excluded.
         */
        @SerializedName("excludeTags")
        private List<String> excludeTags;

        /**
         * Plain-text keywords to include.
         */
        @SerializedName("includeWords")
        private String includeWords;

        /**
         * Plain-text keywords to exclude.
         */
        @SerializedName("excludeWords")
        private String excludeWords;

        /**
         * Regex pattern to include.
         */
        @SerializedName("includeRegEx")
        private String includeRegEx;

        /**
         * Regex pattern to exclude.
         */
        @SerializedName("excludeRegEx")
        private String excludeRegEx;

        @SerializedName("shouldChangeBackground")
        private boolean shouldChangeBackground;

        @SerializedName("backgroundColor")
        private int backgroundColor = 0xFF000000; // Default: black

        @SerializedName("shouldPlaySound")
        private boolean shouldPlaySound;

        @SerializedName("shouldHideMessage")
        private boolean shouldHideMessage;

        @SerializedName("shouldFilterTooltip")
        private boolean shouldFilterTooltip;

        @SerializedName("caseSensitive")
        private boolean caseSensitive;

        @SerializedName("advanced")
        private boolean advanced;

        // ── Matching logic ───────────────────────────────────────────

        /**
         * Check if a message matches this filter.
         *
         * @param message the raw chat message text
         * @return {@code true} if the message should be routed to this tab
         */
        public boolean matches(final String message) {
            if (message == null || message.isEmpty()) return false;

            final String text = caseSensitive ? message : message.toLowerCase();
            final String patternText = caseSensitive ? "" : null; // Used for case-insensitive regex

            // 1. Check exclude tags first
            if (excludeTags != null && !excludeTags.isEmpty()) {
                for (final String tag : excludeTags) {
                    if (tag == null || tag.isEmpty()) continue;
                    final String searchTag = caseSensitive ? tag : tag.toUpperCase();
                    if (text.contains(searchTag)) {
                        return false; // Excluded
                    }
                }
            }

            // 2. Check include tags
            if (includeTags != null && !includeTags.isEmpty()) {
                for (final String tag : includeTags) {
                    if (tag == null || tag.isEmpty()) continue;
                    final String searchTag = caseSensitive ? tag : tag.toUpperCase();
                    if (text.contains(searchTag)) {
                        return true; // Matched include tag
                    }
                }
                // Had include tags but none matched — don't route here
                // (but don't block, just don't match)
                return false;
            }

            // 3. Check include words
            if (includeWords != null && !includeWords.isEmpty()) {
                final String words = caseSensitive ? includeWords : includeWords.toLowerCase();
                for (final String word : words.split(",")) {
                    final String trimmed = word.trim();
                    if (!trimmed.isEmpty() && text.contains(trimmed)) {
                        return true;
                    }
                }
                if (includeRegEx == null || includeRegEx.isEmpty()) {
                    return false; // Had include words but none matched
                }
            }

            // 4. Check include regex
            if (includeRegEx != null && !includeRegEx.isEmpty()) {
                try {
                    final java.util.regex.Pattern pattern = caseSensitive
                            ? java.util.regex.Pattern.compile(includeRegEx)
                            : java.util.regex.Pattern.compile(includeRegEx, java.util.regex.Pattern.CASE_INSENSITIVE);
                    if (pattern.matcher(text).find()) {
                        return true;
                    }
                } catch (final java.util.regex.PatternSyntaxException e) {
                    // Invalid regex — skip
                }
                return false;
            }

            // 5. Check exclude regex
            if (excludeRegEx != null && !excludeRegEx.isEmpty()) {
                try {
                    final java.util.regex.Pattern pattern = caseSensitive
                            ? java.util.regex.Pattern.compile(excludeRegEx)
                            : java.util.regex.Pattern.compile(excludeRegEx, java.util.regex.Pattern.CASE_INSENSITIVE);
                    if (pattern.matcher(text).find()) {
                        return false; // Excluded by regex
                    }
                } catch (final java.util.regex.PatternSyntaxException e) {
                    // Invalid regex — skip
                }
            }

            // 6. Check exclude words
            if (excludeWords != null && !excludeWords.isEmpty()) {
                final String words = caseSensitive ? excludeWords : excludeWords.toLowerCase();
                for (final String word : words.split(",")) {
                    final String trimmed = word.trim();
                    if (!trimmed.isEmpty() && text.contains(trimmed)) {
                        return false;
                    }
                }
            }

            // No include conditions matched — this message doesn't belong to this filter.
            // For a filter with includeTags or includeWords, this means "not matched".
            if ((includeTags != null && !includeTags.isEmpty())
                    || (includeWords != null && !includeWords.isEmpty())
                    || (includeRegEx != null && !includeRegEx.isEmpty())) {
                return false;
            }

            // If no include conditions and no exclude conditions matched, the filter
            // is passive (e.g., only modifies colors) — message passes through.
            return shouldChangeBackground || shouldPlaySound;
        }


        // ── Getters ──────────────────────────────────────────────────

        public String getId() { return id; }
        public String getName() { return name; }
        public List<String> getIncludeTags() { return includeTags; }
        public List<String> getExcludeTags() { return excludeTags; }
        public String getIncludeWords() { return includeWords; }
        public String getExcludeWords() { return excludeWords; }
        public String getIncludeRegEx() { return includeRegEx; }
        public String getExcludeRegEx() { return excludeRegEx; }
        public boolean isShouldChangeBackground() { return shouldChangeBackground; }
        public int getBackgroundColor() { return backgroundColor; }
        public boolean isShouldPlaySound() { return shouldPlaySound; }
        public boolean isShouldHideMessage() { return shouldHideMessage; }
        public boolean isShouldFilterTooltip() { return shouldFilterTooltip; }
        public boolean isCaseSensitive() { return caseSensitive; }
        public boolean isAdvanced() { return advanced; }
    }


    // ─── Default config ──────────────────────────────────────────────

    /**
     * Create the default configuration (mirrors LabyMod-like layout).
     */
    private static ChatConfig createDefault() {
        final ChatConfig config = new ChatConfig();
        config.configVersion = 1;

        // Main window (left bottom) — vanilla chat
        final Filter mainFilter = new Filter();
        mainFilter.name = "Hide Cosmetic";
        mainFilter.excludeTags = new ArrayList<>();
        mainFilter.excludeTags.add("COSMETIC");

        final Tab mainTab = new Tab();
        mainTab.uniqueId = java.util.UUID.randomUUID().toString();
        mainTab.name = "Main";
        mainTab.type = "SERVER";
        mainTab.filters = new ArrayList<>();
        mainTab.filters.add(mainFilter);

        final Window mainWindow = new Window();
        mainWindow.x = 2;
        mainWindow.y = 40;
        mainWindow.width = 300;
        mainWindow.height = 150;
        mainWindow.tabs = new ArrayList<>();
        mainWindow.tabs.add(mainTab);

        config.windows = new ArrayList<>();
        config.windows.add(mainWindow);

        return config;
    }


    // ─── Platform detection ──────────────────────────────────────────

    /**
     * Detect the config file path based on the OS.
     */
    private static String detectConfigPath() {
        final String os = System.getProperty("os.name").toLowerCase();

        final Path basePath;
        if (os.contains("win")) {
            basePath = Path.of(System.getenv("APPDATA"), "anonlauncher");
        } else if (os.contains("mac")) {
            basePath = Path.of(System.getProperty("user.home"), "Library", "Application Support", "anonlauncher");
        } else {
            // Linux / others
            final String xdgData = System.getenv("XDG_DATA_HOME");
            if (xdgData != null && !xdgData.isEmpty()) {
                basePath = Path.of(xdgData, "anonlauncher");
            } else {
                basePath = Path.of(System.getProperty("user.home"), ".local", "share", "anonlauncher");
            }
        }

        return basePath.resolve("chat.json").toString();
    }
}
