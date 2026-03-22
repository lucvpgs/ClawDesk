use std::io::Read;
use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WebviewUrl, WebviewWindowBuilder,
};
use tauri_plugin_single_instance;
use tauri_plugin_updater::UpdaterExt;

const PORT: u16 = 3131;

/// Global handle to the spawned Next.js process.
static SERVER: Mutex<Option<Child>> = Mutex::new(None);

/// One-time auto-login token, generated fresh on every app start.
/// Passed to the server as TAURI_AUTO_LOGIN and used in the initial window URL.
static TAURI_TOKEN: OnceLock<String> = OnceLock::new();

// ── Token generation ─────────────────────────────────────────────────────────

/// Generate a 48-char hex token from /dev/urandom (macOS / Linux).
fn generate_token() -> String {
    let mut bytes = [0u8; 24];
    if let Ok(mut f) = std::fs::File::open("/dev/urandom") {
        let _ = f.read_exact(&mut bytes);
    }
    // Fallback: mix time + pid (weak but prevents an empty token)
    if bytes.iter().all(|&b| b == 0) {
        let t = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .subsec_nanos();
        let pid = std::process::id();
        for (i, b) in bytes.iter_mut().enumerate() {
            *b = ((t >> (i % 32)) ^ (pid >> (i % 32))) as u8;
        }
    }
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn tauri_token() -> &'static str {
    TAURI_TOKEN.get_or_init(generate_token).as_str()
}

// ── Node.js discovery ────────────────────────────────────────────────────────

fn find_node() -> String {
    let candidates = [
        "/opt/homebrew/bin/node", // Apple Silicon Homebrew
        "/usr/local/bin/node",    // Intel Homebrew / nvm default
        "/usr/bin/node",          // system Node
    ];
    for path in candidates {
        if std::path::Path::new(path).exists() {
            return path.to_string();
        }
    }
    "node".to_string()
}

// ── Path helpers ─────────────────────────────────────────────────────────────

fn standalone_dir(app: &tauri::AppHandle) -> PathBuf {
    if cfg!(debug_assertions) {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join(".next/standalone")
    } else {
        app.path()
            .resource_dir()
            .unwrap_or_else(|_| PathBuf::from("."))
            .join("server")
    }
}

fn server_cwd(app: &tauri::AppHandle) -> PathBuf {
    if cfg!(debug_assertions) {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .to_path_buf()
    } else {
        standalone_dir(app)
    }
}

fn resolve_data_dir(app: &tauri::AppHandle) -> PathBuf {
    if cfg!(debug_assertions) {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join("data")
    } else {
        app.path()
            .app_data_dir()
            .unwrap_or_else(|_| PathBuf::from("data"))
    }
}

// ── Server lifecycle ─────────────────────────────────────────────────────────

/// Parse a .env.local file and return key=value pairs.
/// Skips comments and blank lines; strips surrounding quotes from values.
fn load_env_file(path: &PathBuf) -> Vec<(String, String)> {
    let mut vars = Vec::new();
    if let Ok(content) = std::fs::read_to_string(path) {
        for line in content.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            if let Some(eq) = line.find('=') {
                let key = line[..eq].trim().to_string();
                let val = line[eq + 1..].trim();
                let val = val
                    .strip_prefix('"').and_then(|s| s.strip_suffix('"'))
                    .or_else(|| val.strip_prefix('\'').and_then(|s| s.strip_suffix('\'')))
                    .unwrap_or(val)
                    .to_string();
                vars.push((key, val));
            }
        }
    }
    vars
}

fn start_server(app: &tauri::AppHandle, data_dir: &PathBuf) -> std::io::Result<Child> {
    let dir = standalone_dir(app);
    let cwd = server_cwd(app);
    let node = find_node();
    let script = dir.join("server.js");

    println!("[clawdesk] node   = {node}");
    println!("[clawdesk] script = {}", script.display());
    println!("[clawdesk] cwd    = {}", cwd.display());
    println!("[clawdesk] data   = {}", data_dir.display());

    // Fail fast with a clear message if the bundled server.js is missing.
    if !script.exists() {
        eprintln!("[clawdesk] ERROR: server.js not found at {}", script.display());
        return Err(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!("server.js not found at {}", script.display()),
        ));
    }

    std::fs::create_dir_all(data_dir)?;

    // Load .env.local: from project root in dev, from data_dir in production.
    let env_file = if cfg!(debug_assertions) {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join(".env.local")
    } else {
        data_dir.join(".env.local")
    };
    let extra_env = load_env_file(&env_file);
    println!("[clawdesk] env    = {} vars from {}", extra_env.len(), env_file.display());

    let mut cmd = Command::new(&node);
    cmd.arg(&script)
        .current_dir(&cwd)
        .env("PORT", PORT.to_string())
        .env("HOSTNAME", "127.0.0.1")
        .env("NODE_ENV", "production")
        .env("CLAWDESK_DATA_DIR", data_dir)
        .env("TAURI_AUTO_LOGIN", tauri_token());

    for (k, v) in extra_env {
        cmd.env(k, v);
    }

    cmd.spawn()
}

fn wait_for_server() {
    for _ in 0..40 {
        if TcpStream::connect(format!("127.0.0.1:{PORT}")).is_ok() {
            std::thread::sleep(Duration::from_millis(200));
            println!("[clawdesk] server ready on :{PORT}");
            return;
        }
        std::thread::sleep(Duration::from_millis(250));
    }
    println!("[clawdesk] warning: server did not respond within 10 s");
}

fn stop_server() {
    if let Ok(mut guard) = SERVER.lock() {
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
            println!("[clawdesk] server stopped");
        }
    }
}

// ── Tauri app ────────────────────────────────────────────────────────────────

/// Check GitHub for a newer version. Returns { available, version, notes } or { available: false }.
#[tauri::command]
async fn check_update(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let updater = app.updater_builder()
        .build()
        .map_err(|e| e.to_string())?;

    match updater.check().await {
        Ok(Some(update)) => Ok(serde_json::json!({
            "available": true,
            "version": update.version,
            "currentVersion": update.current_version,
            "notes": update.body.unwrap_or_default(),
        })),
        Ok(None) => Ok(serde_json::json!({ "available": false })),
        Err(e) => Ok(serde_json::json!({ "available": false, "error": e.to_string() })),
    }
}

/// Download and install update, then restart.
#[tauri::command]
async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
    let updater = app.updater_builder()
        .build()
        .map_err(|e| e.to_string())?;

    let update = updater.check().await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "No update available".to_string())?;

    update.download_and_install(|_chunk, _total| {}, || {})
        .await
        .map_err(|e| e.to_string())?;

    app.restart();
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_window(app);
        }))
        .invoke_handler(tauri::generate_handler![check_update, install_update])
        .setup(|app| {
            // ── Data directory ────────────────────────────────────────────
            let data_dir = resolve_data_dir(app.handle());

            // ── Seed .env.local in data_dir if missing (production only) ──
            #[cfg(not(debug_assertions))]
            {
                let env_dest = data_dir.join(".env.local");
                if !env_dest.exists() {
                    let default_env = "# ClawDesk configuration\n\
                        # Change CLAWDESK_PASSWORD before exposing to a network\n\
                        CLAWDESK_PASSWORD=changeme\n\
                        CLAWDESK_SECRET=clawdesk-insecure-default\n";
                    let _ = std::fs::create_dir_all(&data_dir);
                    let _ = std::fs::write(&env_dest, default_env);
                    println!("[clawdesk] created default .env.local at {}", env_dest.display());
                }
            }

            // ── Server start ──────────────────────────────────────────────
            // Skip if port already in use (e.g. `pnpm dev` running alongside).
            let port_free = TcpStream::connect(format!("127.0.0.1:{PORT}")).is_err();

            let server_ready: bool;
            if port_free {
                match start_server(app.handle(), &data_dir) {
                    Ok(child) => {
                        *SERVER.lock().unwrap() = Some(child);
                        wait_for_server();
                    }
                    Err(e) => eprintln!("[clawdesk] failed to start server: {e}"),
                }
                // Verify the server is actually accepting connections.
                server_ready = TcpStream::connect(format!("127.0.0.1:{PORT}")).is_ok();
                if !server_ready {
                    eprintln!("[clawdesk] server did not become ready — loading error page");
                }
            } else {
                println!("[clawdesk] port {PORT} in use — attaching to existing server");
                server_ready = true;
            }

            // ── Main window ───────────────────────────────────────────────
            // On success: load /api/auth/tauri?token=<TAURI_TOKEN> which sets
            // the auth cookie and redirects to "/" (no login screen needed).
            // On failure: load the bundled startup-error.html from public/
            // so the user sees an actionable message instead of a white screen.
            let initial_url = if server_ready {
                WebviewUrl::External(
                    format!(
                        "http://127.0.0.1:{PORT}/api/auth/tauri?token={}",
                        tauri_token()
                    )
                    .parse()
                    .unwrap(),
                )
            } else {
                WebviewUrl::App(std::path::PathBuf::from("startup-error.html"))
            };

            let window = WebviewWindowBuilder::new(
                app,
                "main",
                initial_url,
            )
            .title("ClawDesk")
            .inner_size(1400.0, 900.0)
            .min_inner_size(900.0, 600.0)
            .resizable(true)
            .build()?;

            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Regular);

            // ── Tray menu ─────────────────────────────────────────────────
            let show_item =
                MenuItem::with_id(app, "show", "Open ClawDesk", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let quit_item =
                MenuItem::with_id(app, "quit", "Quit ClawDesk", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&show_item, &sep, &quit_item])?;

            // ── Tray icon ─────────────────────────────────────────────────
            let icon = app.default_window_icon().unwrap().clone();
            TrayIconBuilder::new()
                .icon(icon)
                .tooltip("ClawDesk")
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(win) = app.get_webview_window("main") {
                            if win.is_visible().unwrap_or(false) {
                                let _ = win.hide();
                            } else {
                                show_window(app);
                            }
                        }
                    }
                })
                .build(app)?;

            let _ = window;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                window.hide().unwrap();
                api.prevent_close();
            }
        })
        .build(tauri::generate_context!())
        .expect("error building tauri application")
        .run(|_app, event| {
            if let tauri::RunEvent::Exit = event {
                stop_server();
            }
        });
}

fn show_window(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
}
