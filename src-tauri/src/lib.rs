pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::External(
                    "http://localhost:3131".parse().unwrap(),
                ),
            )
            .title("ClawDesk")
            .inner_size(1400.0, 900.0)
            .min_inner_size(900.0, 600.0)
            .resizable(true)
            .build()?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
