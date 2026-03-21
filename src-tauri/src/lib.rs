use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WebviewUrl, WebviewWindowBuilder,
};

const PORT: u16 = 3131;

/// Global handle to the spawned Next.js process.
/// Kept alive until the app exits, then killed in RunEvent::Exit.
static SERVER: Mutex<Option<Child>> = Mutex::new(None);

// ── Node.js discovery ────────────────────────────────────────────────────────

/// Find the `node` binary.  On macOS, Homebrew installs to `/opt/homebrew`
/// (Apple Silicon) or `/usr/local` (Intel); nvm uses `~/.nvm`.
fn find_node() -> String {
    let candidates = [
        "/opt/homebrew/bin/node",   // Apple Silicon Homebrew
        "/usr/local/bin/node",      // Intel Homebrew / nvm default
        "/usr/bin/node",            // system Node
    ];
    for path in candidates {
        if std::path::Path::new(path).exists() {
            return path.to_string();
        }
    }
    "node".to_string() // last resort: rely on PATH
}

// ── Path helpers ─────────────────────────────────────────────────────────────

/// Directory that contains `server.js`.
fn standalone_dir(app: &tauri::AppHandle) -> PathBuf {
    if cfg!(debug_assertions) {
        // dev mode: project root is the parent of src-tauri/
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join(".next/standalone")
    } else {
        // release: server is bundled in app resources (configured in Stage 7)
        app.path()
            .resource_dir()
            .unwrap_or_else(|_| PathBuf::from("."))
            .join("server")
    }
}

/// Working directory for the node process.
/// Dev: project root — so `process.cwd()/data/` resolves the same DB as `pnpm dev`.
/// Release: standalone dir — CLAWDESK_DATA_DIR takes over DB placement.
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

/// Resolve the data directory:
/// - dev  → project root / data/   (same as `pnpm dev`, preserves existing DB)
/// - prod → ~/Library/Application Support/com.vpgs.clawdesk/
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

    // Ensure data directory exists before the server tries to open the DB
    std::fs::create_dir_all(data_dir)?;

    Command::new(&node)
        .arg(&script)
        .current_dir(&cwd)
        .env("PORT", PORT.to_string())
        .env("HOSTNAME", "127.0.0.1")
        .env("NODE_ENV", "production")
        .env("CLAWDESK_DATA_DIR", data_dir)
        .spawn()
}

/// Poll until `127.0.0.1:PORT` accepts TCP connections (max ~10 s).
fn wait_for_server() {
    for _ in 0..40 {
        if TcpStream::connect(format!("127.0.0.1:{PORT}")).is_ok() {
            // Brief pause so the HTTP layer is fully up after TCP bind
            std::thread::sleep(Duration::from_millis(200));
            println!("[clawdesk] server ready on :{PORT}");
            return;
        }
        std::thread::sleep(Duration::from_millis(250));
    }
    println!("[clawdesk] warning: server did not respond within 10 s");
}

/// Kill the server process on app exit.
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

            // ── Server start (skip if port already in use) ────────────────
            // This allows `pnpm tauri:dev` to co-exist with `pnpm dev`:
            // if port 3131 is already bound, Tauri attaches to that server.
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
            let window = WebviewWindowBuilder::new(
                app,
                "main",
                WebviewUrl::External(
                    format!("http://127.0.0.1:{PORT}").parse().unwrap(),
                ),
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
        // ── Hide on close instead of quitting ─────────────────────────────
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                window.hide().unwrap();
                api.prevent_close();
            }
        })
        .build(tauri::generate_context!())
        .expect("error building tauri application")
        .run(|_app, event| {
            // Kill server when the app fully exits
            if let tauri::RunEvent::Exit = event {
                stop_server();
            }
        });
}

/// Bring the main window to the foreground.
fn show_window(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
}
