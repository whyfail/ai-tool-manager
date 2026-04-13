use serde::Serialize;
use std::path::PathBuf;
use crate::core::installer::install_git_skill;
use crate::core::central_repo::resolve_central_repo_path;
use crate::skill_core::tool_adapters::{get_all_tool_status, default_tool_adapters, resolve_default_path, scan_tool_dir, is_tool_installed, ToolStatus, adapter_by_key};

// Skills management commands
// Migrated from skills-hub-main

#[derive(Clone, Debug, Serialize)]
pub struct SyncTarget {
    pub tool: String,
    pub mode: String,
    pub status: String,
    pub target_path: String,
    pub synced_at: Option<i64>,
}

#[derive(Clone, Debug, Serialize)]
pub struct ManagedSkill {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub source_type: String,
    pub source_ref: Option<String>,
    pub central_path: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub last_sync_at: Option<i64>,
    pub status: String,
    pub targets: Vec<SyncTarget>,
}

#[derive(Clone, Debug, Serialize)]
pub struct OnboardingVariant {
    pub tool: String,
    pub name: String,
    pub path: String,
    pub fingerprint: Option<String>,
    pub is_link: bool,
    pub link_target: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct OnboardingGroup {
    pub name: String,
    pub variants: Vec<OnboardingVariant>,
    pub has_conflict: bool,
}

#[derive(Clone, Debug, Serialize)]
pub struct OnboardingPlan {
    pub total_tools_scanned: usize,
    pub total_skills_found: usize,
    pub groups: Vec<OnboardingGroup>,
}

#[tauri::command]
pub async fn get_managed_skills() -> Result<Vec<ManagedSkill>, String> {
    let all_tools = default_tool_adapters();
    let mut skill_map: std::collections::HashMap<String, (ManagedSkill, Vec<SyncTarget>)> = std::collections::HashMap::new();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);

    for tool in &all_tools {
        let installed = is_tool_installed(tool).map_err(|e| e.to_string())?;
        if !installed {
            continue;
        }

        let skills_dir = resolve_default_path(tool).map_err(|e| e.to_string())?;
        let skills = scan_tool_dir(tool, &skills_dir).map_err(|e| e.to_string())?;

        for skill in skills {
            let skill_name = skill.name.clone();
            let tool_id = tool.id.as_key().to_string();
            let skill_path = skill.path.to_string_lossy().to_string();
            let mode = if skill.is_link { "link" } else { "copy" };

            if let Some((existing, ref mut targets)) = skill_map.get_mut(&skill_name) {
                targets.push(SyncTarget {
                    tool: tool_id,
                    mode: mode.to_string(),
                    status: "synced".to_string(),
                    target_path: skill_path,
                    synced_at: None,
                });
            } else {
                let source_type = if skill.is_link { "link" } else { "local" };
                let source_ref = skill.link_target.map(|p| p.to_string_lossy().to_string());
                let skill_id = format!("{}-{}", tool_id, skill_name);

                skill_map.insert(skill_name.clone(), (
                    ManagedSkill {
                        id: skill_id,
                        name: skill_name.clone(),
                        description: None,
                        source_type: source_type.to_string(),
                        source_ref,
                        central_path: skill_path.clone(),
                        created_at: now,
                        updated_at: now,
                        last_sync_at: None,
                        status: "active".to_string(),
                        targets: vec![],
                    },
                    vec![SyncTarget {
                        tool: tool_id,
                        mode: mode.to_string(),
                        status: "synced".to_string(),
                        target_path: skill_path,
                        synced_at: None,
                    }]
                ));
            }
        }
    }

    let result: Vec<ManagedSkill> = skill_map.into_iter()
        .map(|(name, (mut skill, targets))| {
            skill.targets = targets;
            skill
        })
        .collect();

    Ok(result)
}

#[tauri::command]
pub async fn get_tool_status() -> Result<Vec<ToolStatus>, String> {
    get_all_tool_status()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_onboarding_plan() -> Result<OnboardingPlan, String> {
    let all_tools = default_tool_adapters();
    let mut groups_map: std::collections::HashMap<String, OnboardingGroup> = std::collections::HashMap::new();
    let mut total_skills = 0;
    let mut total_tools = 0;

    for tool in &all_tools {
        let installed = is_tool_installed(tool).map_err(|e| e.to_string())?;
        if !installed {
            continue;
        }

        total_tools += 1;
        let skills_dir = resolve_default_path(tool).map_err(|e| e.to_string())?;
        let skills = scan_tool_dir(tool, &skills_dir).map_err(|e| e.to_string())?;
        total_skills += skills.len();

        let tool_id = tool.id.as_key().to_string();

        for skill in skills {
            let variant = OnboardingVariant {
                tool: tool_id.clone(),
                name: skill.name.clone(),
                path: skill.path.to_string_lossy().to_string(),
                fingerprint: None,
                is_link: skill.is_link,
                link_target: skill.link_target.map(|p| p.to_string_lossy().to_string()),
            };

            let entry = groups_map.entry(skill.name.clone()).or_insert_with(|| OnboardingGroup {
                name: skill.name.clone(),
                variants: vec![],
                has_conflict: false,
            });
            entry.variants.push(variant);
        }
    }

    for group in groups_map.values_mut() {
        if group.variants.len() > 1 {
            let paths: Vec<&String> = group.variants.iter().map(|v| &v.path).collect();
            let unique_paths: std::collections::HashSet<&String> = paths.iter().cloned().collect();
            group.has_conflict = unique_paths.len() > 1;
        }
    }

    Ok(OnboardingPlan {
        total_tools_scanned: total_tools,
        total_skills_found: total_skills,
        groups: groups_map.into_values().collect(),
    })
}

#[tauri::command]
pub async fn install_git(repo_url: String, name: Option<String>) -> Result<ManagedSkill, String> {
    eprintln!("[DEBUG] install_git called with url: {}", repo_url);
    let repo_url_clone = repo_url.clone();
    let name_clone = name.clone();

    let result = tokio::task::spawn_blocking(move || {
        install_git_skill(&repo_url_clone, name_clone)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);

    Ok(ManagedSkill {
        id: result.skill_id,
        name: result.name,
        description: None,
        source_type: "git".to_string(),
        source_ref: Some(repo_url),
        central_path: result.central_path.to_string_lossy().to_string(),
        created_at: now,
        updated_at: now,
        last_sync_at: None,
        status: "active".to_string(),
        targets: vec![],
    })
}

#[tauri::command]
pub async fn install_local_selection(
    base_path: String,
    subpath: String,
    name: Option<String>,
) -> Result<ManagedSkill, String> {
    eprintln!("[DEBUG] install_local_selection called: base={}, subpath={}, name={:?}", base_path, subpath, name);

    let result: ManagedSkill = tokio::task::spawn_blocking(move || -> Result<ManagedSkill, String> {
        use crate::core::sync_engine::copy_dir_recursive;
        use crate::core::central_repo::{ensure_central_repo, resolve_central_repo_path};

        let base = PathBuf::from(&base_path);
        let selected_dir = if subpath.is_empty() || subpath == "." {
            base.clone()
        } else {
            base.join(&subpath)
        };

        if !selected_dir.exists() {
            return Err(format!("Source path does not exist: {:?}", selected_dir));
        }

        let skill_name = name.unwrap_or_else(|| {
            selected_dir
                .file_name()
                .map(|v| v.to_string_lossy().to_string())
                .unwrap_or_else(|| "unnamed-skill".to_string())
        });

        let central_dir = resolve_central_repo_path().map_err(|e| e.to_string())?;
        ensure_central_repo(&central_dir).map_err(|e| e.to_string())?;

        let central_path = central_dir.join(&skill_name);
        if central_path.exists() {
            return Err(format!("Skill already exists in central repo: {:?}", central_path));
        }

        copy_dir_recursive(&selected_dir, &central_path)
            .map_err(|e| e.to_string())?;

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);

        Ok(ManagedSkill {
            id: format!("local-{}", skill_name),
            name: skill_name,
            description: None,
            source_type: "local".to_string(),
            source_ref: Some(selected_dir.to_string_lossy().to_string()),
            central_path: central_path.to_string_lossy().to_string(),
            created_at: now,
            updated_at: now,
            last_sync_at: None,
            status: "active".to_string(),
            targets: vec![],
        })
    })
    .await
    .map_err(|e| e.to_string())??;

    Ok(result)
}

#[tauri::command]
pub async fn sync_skill_to_tool(
    skillId: String,
    skillName: String,
    tool: String,
    sourcePath: String,
) -> Result<SyncTarget, String> {
    eprintln!("[DEBUG] sync_skill_to_tool called: skillId={}, skillName={}, tool={}, source={}", skillId, skillName, tool, sourcePath);

    let result: SyncTarget = tokio::task::spawn_blocking(move || -> Result<SyncTarget, String> {
        use crate::core::sync_engine::sync_dir_for_tool_with_overwrite;

        let tool_adapter = adapter_by_key(&tool)
            .ok_or_else(|| format!("Unknown tool: {}", tool))?;

        let source = PathBuf::from(&sourcePath);
        let target_dir = crate::skill_core::tool_adapters::resolve_default_path(&tool_adapter)
            .map_err(|e| e.to_string())?;
        let target_path = target_dir.join(&skillName);

        let outcome = sync_dir_for_tool_with_overwrite(
            &tool,
            &source,
            &target_path,
            true,
        ).map_err(|e| e.to_string())?;

        let mode = match outcome.mode_used {
            crate::core::sync_engine::SyncMode::Symlink => "link",
            crate::core::sync_engine::SyncMode::Junction => "junction",
            crate::core::sync_engine::SyncMode::Copy => "copy",
            crate::core::sync_engine::SyncMode::Auto => "copy",
        };

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);

        Ok(SyncTarget {
            tool,
            mode: mode.to_string(),
            status: "synced".to_string(),
            target_path: outcome.target_path.to_string_lossy().to_string(),
            synced_at: Some(now),
        })
    })
    .await
    .map_err(|e| e.to_string())??;

    Ok(result)
}

#[tauri::command]
pub async fn import_existing_skill(
    source_path: String,
    name: String,
) -> Result<ManagedSkill, String> {
    eprintln!("[DEBUG] import_existing_skill called: source={}, name={}", source_path, name);

    let result: ManagedSkill = tokio::task::spawn_blocking(move || -> Result<ManagedSkill, String> {
        use crate::core::sync_engine::copy_dir_recursive;
        use crate::core::central_repo::{ensure_central_repo, resolve_central_repo_path};

        let source = PathBuf::from(&source_path);
        if !source.exists() {
            return Err(format!("Source path does not exist: {}", source_path));
        }

        let central_dir = resolve_central_repo_path().map_err(|e| e.to_string())?;
        ensure_central_repo(&central_dir).map_err(|e| e.to_string())?;

        let central_path = central_dir.join(&name);
        if central_path.exists() {
            return Err(format!("Skill already exists in central repo: {:?}", central_path));
        }

        copy_dir_recursive(&source, &central_path)
            .map_err(|e| e.to_string())?;

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);

        Ok(ManagedSkill {
            id: format!("local-{}", name),
            name: name,
            description: None,
            source_type: "local".to_string(),
            source_ref: Some(source_path),
            central_path: central_path.to_string_lossy().to_string(),
            created_at: now,
            updated_at: now,
            last_sync_at: None,
            status: "active".to_string(),
            targets: vec![],
        })
    })
    .await
    .map_err(|e| e.to_string())??;

    Ok(result)
}

#[tauri::command]
pub async fn delete_managed_skill(skill_id: String, skill_name: String) -> Result<(), String> {
    // skill_id 格式: {tool_id}-{skill_name}
    // 我们需要找到这个技能在各个工具中的路径并删除

    // 首先获取所有技能，找到匹配的
    let all_tools = default_tool_adapters();
    let mut paths_to_delete: Vec<(PathBuf, bool)> = Vec::new(); // (path, is_link)

    for tool in &all_tools {
        let installed = is_tool_installed(tool).map_err(|e| e.to_string())?;
        if !installed {
            continue;
        }

        let skills_dir = resolve_default_path(tool).map_err(|e| e.to_string())?;
        let skills = scan_tool_dir(tool, &skills_dir).map_err(|e| e.to_string())?;

        for skill in skills {
            if skill.name == skill_name {
                paths_to_delete.push((skill.path.clone(), skill.is_link));
            }
        }
    }

    // 删除所有找到的路径
    let count = paths_to_delete.len();
    for (path, is_link) in paths_to_delete {
        if path.exists() {
            if is_link {
                if let Err(e) = std::fs::remove_file(&path) {
                    eprintln!("Warning: failed to remove symlink {}: {}", path.display(), e);
                }
            } else {
                if let Err(e) = std::fs::remove_dir_all(&path) {
                    eprintln!("Warning: failed to remove directory {}: {}", path.display(), e);
                }
            }
        }
    }

    // 删除 central repo 中的原始技能文件夹
    let central_dir = resolve_central_repo_path().map_err(|e| e.to_string())?;
    let central_skill_path = central_dir.join(&skill_name);
    if central_skill_path.exists() {
        if let Err(e) = std::fs::remove_dir_all(&central_skill_path) {
            eprintln!("Warning: failed to remove central skill directory {}: {}", central_skill_path.display(), e);
        } else {
            println!("已删除 central repo 中的技能: {:?}", central_skill_path);
        }
    }

    println!("技能 '{}' 已删除 (共 {} 个工具路径)", skill_name, count);
    Ok(())
}

#[tauri::command]
pub async fn update_skill(skill_id: String) -> Result<(), String> {
    // TODO: Implement update_skill
    println!("Update skill requested: {}", skill_id);
    Ok(())
}

#[tauri::command]
pub async fn get_skill_readme(skill_name: String) -> Result<String, String> {
    let central_dir = resolve_central_repo_path().map_err(|e| e.to_string())?;
    let skill_path = central_dir.join(&skill_name).join("SKILL.md");

    if !skill_path.exists() {
        return Err("SKILL.md 文件不存在".to_string());
    }

    std::fs::read_to_string(&skill_path)
        .map_err(|e| format!("读取文件失败: {}", e))
}
