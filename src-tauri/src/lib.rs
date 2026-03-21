use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WebviewUrl, WebviewWindowBuilder,
};

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // ── Main window ──────────────────────────────────────────────
            let window = WebviewWindowBuilder::new(
                app,
                "main",
                WebviewUrl::External("http://localhost:3131".parse().unwrap()),
            )
            .title("ClawDesk")
            .inner_size(1400.0, 900.0)
            .min_inner_size(900.0, 600.0)
            .resizable(true)
            .build()?;

            // On macOS: clicking the dock icon re-shows the window if hidden
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Regular);

            // ── Tray menu ────────────────────────────────────────────────
            let show_item =
                MenuItem::with_id(app, "show", "Open ClawDesk", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let quit_item =
                MenuItem::with_id(app, "quit", "Quit ClawDesk", true, None::<&str>)?;

            let tray_menu = Menu::with_items(app, &[&show_item, &separator, &quit_item])?;

            // ── Tray icon ────────────────────────────────────────────────
            let icon = app
                .default_window_icon()
                .expect("no app icon found")
                .clone();

            TrayIconBuilder::new()
                .icon(icon)
                .tooltip("ClawDesk")
                .menu(&tray_menu)
                .show_menu_on_left_click(false) // left click toggles window; right click shows menu
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    // Left-click: toggle window visibility
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

            // Keep window reference alive (suppress unused-variable warning)
            let _ = window;
            Ok(())
        })
        // ── Hide on close (macOS / Windows) — quit only via tray ─────────
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                window.hide().unwrap();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Show the main window and bring it to the front.
fn show_window(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
}
