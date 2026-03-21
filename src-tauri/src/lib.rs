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

fn start_server(app: &tauri::AppHandle, data_dir: &PathBuf) -> std::io::Result<Child> {
    let dir = standalone_dir(app);
    let cwd = server_cwd(app);
    let node = find_node();
    let script = dir.join("server.js");

    println!("[clawdesk] node   = {node}");
    println!("[clawdesk] script = {}", script.display());
    println!("[clawdesk] cwd    = {}", cwd.display());
    println!("[clawdesk] data   = {}", data_dir.display());

    std::fs::create_dir_all(data_dir)?;

    Command::new(&node)
        .arg(&script)
        .current_dir(&cwd)
        .env("PORT", PORT.to_string())
        .env("HOSTNAME", "127.0.0.1")
        .env("NODE_ENV", "production")
        .env("CLAWDESK_DATA_DIR", data_dir)
        .env("TAURI_AUTO_LOGIN", tauri_token()) // consumed by /api/auth/tauri
        .spawn()
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

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // ── Data directory ────────────────────────────────────────────
            let data_dir = resolve_data_dir(app.handle());

            // ── Server start ──────────────────────────────────────────────
            // Skip if port already in use (e.g. `pnpm dev` running alongside).
            let port_free = TcpStream::connect(format!("127.0.0.1:{PORT}")).is_err();

            if port_free {
                match start_server(app.handle(), &data_dir) {
                    Ok(child) => {
                        *SERVER.lock().unwrap() = Some(child);
                        wait_for_server();
                    }
                    Err(e) => eprintln!("[clawdesk] failed to start server: {e}"),
                }
            } else {
                println!("[clawdesk] port {PORT} in use — attaching to existing server");
            }

            // ── Main window ───────────────────────────────────────────────
            // Load /api/auth/tauri?token=<TAURI_TOKEN> first.
            // That endpoint sets the auth cookie and redirects to "/" —
            // so the login screen never appears in the Tauri window.
            let auto_login_url = format!(
                "http://127.0.0.1:{PORT}/api/auth/tauri?token={}",
                tauri_token()
            );

            let window = WebviewWindowBuilder::new(
                app,
                "main",
                WebviewUrl::External(auto_login_url.parse().unwrap()),
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
