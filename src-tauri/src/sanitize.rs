/// Sanitize instance/resource name for filesystem use.
/// Replaces spaces and dots with underscores, strips other special chars,
/// trims trailing underscores, and lowercases the result.
pub fn sanitize_name(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            'a'..='z' | 'A'..='Z' | '0'..='9' | '-' | '_' => c,
            ' ' | '.' => '_',
            _ => '_',
        })
        .collect::<String>()
        .trim_matches('_')
        .to_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_name_basic() {
        assert_eq!(sanitize_name("My Instance 1"), "my_instance_1");
        assert_eq!(sanitize_name("Hello.World"), "hello_world");
        assert_eq!(sanitize_name("test"), "test");
    }

    #[test]
    fn test_sanitize_name_special_chars() {
        assert_eq!(sanitize_name("Ugly/Name:Test"), "ugly_nametest");
        assert_eq!(sanitize_name("  spaces  "), "spaces");
        assert_eq!(sanitize_name("___"), "");
    }

    #[test]
    fn test_sanitize_name_unicode() {
        assert_eq!(sanitize_name("Żółw"), "_");
        assert_eq!(sanitize_name("café"), "caf");
    }
}
