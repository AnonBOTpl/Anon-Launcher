package net.anonlauncher.chat;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Utility class for parsing chat messages and extracting tags.
 * <p>
 * Minecraft servers send messages with tags in square brackets (e.g.
 * {@code [REWARDS] You won 50 coins!}) or as JSON component hover/click events.
 * <p>
 * This class provides methods to extract those tags for filter matching.
 */
public final class ChatFilter {

    private ChatFilter() {
    }

    /**
     * Pattern to match bracket-style tags at the start of a message.
     * E.g. {@code [REWARDS]}, {@code [ALERT]}, {@code [VOTE]}
     */
    private static final Pattern TAG_PATTERN = Pattern.compile("\\[([A-Za-z0-9 _-]+)\\]");

    /**
     * Extract all bracket tags from a message.
     *
     * @param message the raw chat message
     * @return list of extracted tags (uppercased, deduplicated)
     */
    public static List<String> extractTags(final String message) {
        if (message == null || message.isEmpty()) {
            return List.of();
        }

        final List<String> tags = new ArrayList<>();
        final Matcher matcher = TAG_PATTERN.matcher(message);

        while (matcher.find()) {
            final String tag = matcher.group(1).trim().toUpperCase();
            if (!tag.isEmpty() && !tags.contains(tag)) {
                tags.add(tag);
            }
        }

        return tags;
    }


    /**
     * Check if a message contains any of the given tags.
     *
     * @param message the chat message
     * @param tags    the tags to look for
     * @return {@code true} if any tag is found
     */
    public static boolean hasAnyTag(final String message, final List<String> tags) {
        if (message == null || tags == null || tags.isEmpty()) return false;
        final String upper = message.toUpperCase();
        for (final String tag : tags) {
            if (tag != null && upper.contains(tag.toUpperCase())) return true;
        }
        return false;
    }


    /**
     * Check if a message contains all of the given tags.
     *
     * @param message the chat message
     * @param tags    the tags that must all be present
     * @return {@code true} if all tags are found
     */
    public static boolean hasAllTags(final String message, final List<String> tags) {
        if (message == null || tags == null || tags.isEmpty()) return true;
        final String upper = message.toUpperCase();
        for (final String tag : tags) {
            if (tag == null || !upper.contains(tag.toUpperCase())) return false;
        }
        return true;
    }
}
