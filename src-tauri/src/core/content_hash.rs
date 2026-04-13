use std::path::Path;

use anyhow::{Context, Result};
use sha2::{Digest, Sha256};
use walkdir::{DirEntry, WalkDir};

const IGNORE_NAMES: [&str; 4] = [".git", ".DS_Store", "Thumbs.db", ".gitignore"];

fn is_ignored(entry: &DirEntry) -> bool {
    let file_name = entry.file_name().to_string_lossy();
    IGNORE_NAMES.iter().any(|name| name == &file_name.as_ref())
}

/// Compute a hash of the directory contents (files + their relative paths).
/// Files are ordered alphabetically for deterministic output.
pub fn hash_dir(path: &Path) -> Result<String> {
    let mut hasher = Sha256::new();

    // Collect all entries first and sort for deterministic ordering
    let mut entries: Vec<_> = WalkDir::new(path)
        .follow_links(false)
        .into_iter()
        .filter_entry(|entry| !is_ignored(entry))
        .collect::<std::result::Result<Vec<_>, _>>()?;

    entries.sort_by(|a, b| a.path().cmp(b.path()));

    for entry in entries {
        if is_ignored(&entry) {
            continue;
        }

        let relative = entry
            .path()
            .strip_prefix(path)
            .with_context(|| format!("strip prefix {:?}", entry.path()))?;
        hasher.update(relative.to_string_lossy().as_bytes());

        if entry.file_type().is_file() {
            let bytes = std::fs::read(entry.path())
                .with_context(|| format!("read file {:?}", entry.path()))?;
            hasher.update(bytes);
        }
    }

    let digest = hasher.finalize();
    Ok(hex::encode(digest))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_dir_empty() {
        let temp_dir = tempfile::tempdir().unwrap();
        let hash = hash_dir(temp_dir.path()).unwrap();
        // Empty directory should produce a consistent hash
        assert!(!hash.is_empty());
    }
}
