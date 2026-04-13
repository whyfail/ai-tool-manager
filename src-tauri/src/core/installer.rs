use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use uuid::Uuid;

use super::central_repo::{ensure_central_repo, resolve_central_repo_path};
use super::content_hash::hash_dir;
use super::git_fetcher::clone_or_pull;
use super::github_download::{download_github_directory, parse_github_api_params};
use super::sync_engine::copy_dir_recursive;

pub struct InstallResult {
    pub skill_id: String,
    pub name: String,
    pub central_path: PathBuf,
    pub content_hash: Option<String>,
}

/// Install a skill from a Git URL (GitHub, GitLab, etc.)
pub fn install_git_skill(
    repo_url: &str,
    name: Option<String>,
) -> Result<InstallResult> {
    eprintln!("[DEBUG] install_git_skill called: repo_url={}, name={:?}", repo_url, name);
    let parsed = parse_github_url(repo_url);
    eprintln!("[DEBUG] parsed Git URL: clone_url={}, branch={:?}, subpath={:?}", parsed.clone_url, parsed.branch, parsed.subpath);
    let user_provided_name = name.is_some();
    let mut skill_name = name.unwrap_or_else(|| {
        if let Some(subpath) = &parsed.subpath {
            subpath
                .rsplit('/')
                .next()
                .map(|s| s.to_string())
                .unwrap_or_else(|| derive_name_from_repo_url(&parsed.clone_url))
        } else {
            derive_name_from_repo_url(&parsed.clone_url)
        }
    });

    let central_dir = resolve_central_repo_path()?;
    ensure_central_repo(&central_dir)?;
    let mut central_path = central_dir.join(&skill_name);

    if central_path.exists() {
        anyhow::bail!("skill already exists in central repo: {:?}", central_path);
    }

    // Try GitHub API download first (fast path for GitHub URLs with subpath)
    let revision;
    eprintln!("[DEBUG] Trying GitHub API download path...");
    if let Some((owner, repo, branch, subpath)) = parse_github_api_params(
        &parsed.clone_url,
        parsed.branch.as_deref(),
        parsed.subpath.as_deref(),
    ) {
        match download_github_directory(&owner, &repo, &branch, &subpath, &central_path, None) {
            Ok(()) => {
                eprintln!("[DEBUG] GitHub API download succeeded");
                revision = format!("api-download-{}", branch);
            }
            Err(err) => {
                eprintln!("[DEBUG] GitHub API download failed: {}", err);
                // Clean up partial download
                let _ = std::fs::remove_dir_all(&central_path);
                let err_msg = format!("{:#}", err);

                // If 404, the path doesn't exist on GitHub
                if err_msg.contains("404") || err_msg.contains("Not Found") {
                    anyhow::bail!(
                        "该 Skill 在 GitHub 上未找到（可能已被删除或路径已变更）。\n请检查链接是否正确：{}/tree/{}/{}",
                        parsed.clone_url.trim_end_matches(".git"),
                        branch,
                        subpath
                    );
                }

                // If rate limited
                if err_msg.contains("RATE_LIMITED") {
                    anyhow::bail!(
                        "GitHub API 频率限制已触发。可在设置中配置 GitHub Token 以提升限额。"
                    );
                }

                if err_msg.contains("403") || err_msg.contains("Forbidden") {
                    anyhow::bail!("GitHub API 访问被拒绝（可能触发了频率限制）。请稍后再试。");
                }

                // Fall back to git clone
                eprintln!("[DEBUG] Falling back to git clone...");
                log::warn!(
                    "[installer] GitHub API download failed, falling back to git clone: {:#}",
                    err
                );
                let (repo_dir, rev) = clone_to_cache(&parsed.clone_url, parsed.branch.as_deref())?;
                let sub_src = repo_dir.join(&subpath);
                if !sub_src.exists() {
                    anyhow::bail!("subpath not found in repo: {:?}", sub_src);
                }
                copy_dir_recursive(&sub_src, &central_path)
                    .with_context(|| format!("copy {:?} -> {:?}", sub_src, central_path))?;
                revision = rev;
            }
        }
    } else {
        // Standard git clone path
        eprintln!("[DEBUG] Using standard git clone path...");
        let (repo_dir, rev) = clone_to_cache(&parsed.clone_url, parsed.branch.as_deref())?;
        eprintln!("[DEBUG] Git clone succeeded, rev={}", rev);

        let copy_src = if let Some(subpath) = &parsed.subpath {
            let sub_src = repo_dir.join(subpath);
            if !sub_src.exists() {
                anyhow::bail!("subpath not found in repo: {:?}", sub_src);
            }
            sub_src
        } else {
            repo_dir.clone()
        };

        copy_dir_recursive(&copy_src, &central_path)
            .with_context(|| format!("copy {:?} -> {:?}", copy_src, central_path))?;
        revision = rev;
    }

    // After download, prefer the name from SKILL.md over the derived name
    let (description, md_name) = match parse_skill_md(&central_path.join("SKILL.md")) {
        Some((n, d)) => (d, Some(n)),
        None => (None, None),
    };

    if !user_provided_name {
        if let Some(ref better_name) = md_name {
            if *better_name != skill_name {
                let new_central = central_dir.join(better_name);
                if !new_central.exists() {
                    std::fs::rename(&central_path, &new_central).with_context(|| {
                        format!("rename {:?} -> {:?}", central_path, new_central)
                    })?;
                    skill_name = better_name.clone();
                    central_path = new_central;
                }
            }
        }
    }

    let content_hash = compute_content_hash(&central_path);

    let now = now_ms();
    let skill_id = format!("git-{}", Uuid::new_v4());

    // TODO: Save to database using skills DAO
    // For now, return the result

    eprintln!("[DEBUG] install_git_skill completed successfully: skill_id={}, name={}, central_path={:?}", skill_id, skill_name, central_path);
    Ok(InstallResult {
        skill_id,
        name: skill_name,
        central_path,
        content_hash,
    })
}

fn parse_github_url(input: &str) -> ParsedGitSource {
    let trimmed = input.trim().trim_end_matches('/');

    // Normalize GitHub shorthand
    let normalized = if trimmed.starts_with("https://github.com/") {
        trimmed.to_string()
    } else if trimmed.starts_with("github.com/") {
        format!("https://{}", trimmed)
    } else if looks_like_github_shorthand(trimmed) {
        format!("https://github.com/{}", trimmed)
    } else {
        trimmed.to_string()
    };

    let trimmed = normalized.trim_end_matches('/');
    let gh_prefix = "https://github.com/";
    if !trimmed.starts_with(gh_prefix) {
        return ParsedGitSource {
            clone_url: trimmed.to_string(),
            branch: None,
            subpath: None,
        };
    }

    let rest = &trimmed[gh_prefix.len()..];
    let parts: Vec<&str> = rest.split('/').collect();
    if parts.len() < 2 {
        return ParsedGitSource {
            clone_url: trimmed.to_string(),
            branch: None,
            subpath: None,
        };
    }

    let owner = parts[0];
    let mut repo = parts[1].to_string();
    if let Some(stripped) = repo.strip_suffix(".git") {
        repo = stripped.to_string();
    }
    let clone_url = format!("https://github.com/{}/{}.git", owner, repo);

    if parts.len() >= 4 && (parts[2] == "tree" || parts[2] == "blob") {
        let branch = Some(parts[3].to_string());
        let subpath = if parts.len() > 4 {
            Some(parts[4..].join("/"))
        } else {
            None
        };
        return ParsedGitSource {
            clone_url,
            branch,
            subpath,
        };
    }

    ParsedGitSource {
        clone_url,
        branch: None,
        subpath: None,
    }
}

fn looks_like_github_shorthand(input: &str) -> bool {
    if input.is_empty() {
        return false;
    }
    if input.starts_with('/') || input.starts_with('~') || input.starts_with('.') {
        return false;
    }
    if input.contains("://") || input.contains('@') || input.contains(':') {
        return false;
    }

    let parts: Vec<&str> = input.split('/').collect();
    if parts.len() < 2 {
        return false;
    }

    let owner = parts[0];
    let repo = parts[1];
    if owner.is_empty()
        || repo.is_empty()
        || owner == "."
        || owner == ".."
        || repo == "."
        || repo == ".."
    {
        return false;
    }

    let is_safe_segment = |s: &str| {
        s.chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
    };
    if !is_safe_segment(owner) || !is_safe_segment(repo.trim_end_matches(".git")) {
        return false;
    }

    if parts.len() > 2 {
        matches!(parts[2], "tree" | "blob")
    } else {
        true
    }
}

#[derive(Clone, Debug)]
struct ParsedGitSource {
    clone_url: String,
    branch: Option<String>,
    subpath: Option<String>,
}

fn derive_name_from_repo_url(repo_url: &str) -> String {
    let mut name = repo_url
        .split('/')
        .next_back()
        .unwrap_or("skill")
        .to_string();
    if let Some(stripped) = name.strip_suffix(".git") {
        name = stripped.to_string();
    }
    if name.is_empty() {
        "skill".to_string()
    } else {
        name
    }
}

fn now_ms() -> i64 {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::SystemTime::UNIX_EPOCH)
        .unwrap_or_default();
    now.as_millis() as i64
}

fn clone_to_cache(clone_url: &str, branch: Option<&str>) -> Result<(PathBuf, String)> {
    let cache_root = std::env::temp_dir().join("mcp-manager-git-cache");
    std::fs::create_dir_all(&cache_root)
        .with_context(|| format!("failed to create cache dir {:?}", cache_root))?;

    let repo_dir = cache_root.join(repo_cache_key(clone_url, branch));
    let revision = clone_or_pull(clone_url, &repo_dir, branch)?;

    Ok((repo_dir, revision))
}

fn repo_cache_key(clone_url: &str, branch: Option<&str>) -> String {
    use sha2::Digest;
    let mut hasher = sha2::Sha256::new();
    hasher.update(clone_url.as_bytes());
    hasher.update(b"\n");
    if let Some(b) = branch {
        hasher.update(b.as_bytes());
    }
    hex::encode(hasher.finalize())
}

fn compute_content_hash(path: &Path) -> Option<String> {
    hash_dir(path).ok()
}

fn parse_skill_md(path: &Path) -> Option<(String, Option<String>)> {
    parse_skill_md_with_reason(path).ok()
}

fn parse_skill_md_with_reason(path: &Path) -> Result<(String, Option<String>), &'static str> {
    let text = std::fs::read_to_string(path).map_err(|_| "read_failed")?;
    let mut lines = text.lines();
    if lines.next().map(|v| v.trim()) != Some("---") {
        return Err("invalid_frontmatter");
    }
    let mut name: Option<String> = None;
    let mut desc: Option<String> = None;
    let mut found_end = false;
    for line in lines.by_ref() {
        let l = line.trim();
        if l == "---" {
            found_end = true;
            break;
        }
        if let Some(v) = l.strip_prefix("name:") {
            name = Some(v.trim().trim_matches('"').to_string());
        } else if let Some(v) = l.strip_prefix("description:") {
            desc = Some(v.trim().trim_matches('"').to_string());
        }
    }
    if !found_end {
        return Err("invalid_frontmatter");
    }
    let name = name.ok_or("missing_name")?;
    Ok((name, desc))
}
