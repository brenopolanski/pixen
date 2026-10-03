use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};

use tauri::{window::Color, AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

pub const MAIN_WINDOW_LABEL: &str = "main";
pub const SPLASH_WINDOW_LABEL: &str = "splash";
/// Keep in sync with ABOUT_WINDOW_LABEL in src/lib/constants.ts
pub const ABOUT_WINDOW_LABEL: &str = "about";
/// Keep in sync with HIDE_REQUESTED_EVENT in src/lib/constants.ts
pub const HIDE_REQUESTED_EVENT: &str = "pixen-hide-requested";

/// Set for a login launch, which must never reveal the splash or the editor.
static BACKGROUND_LAUNCH: AtomicBool = AtomicBool::new(false);
/// Set while the editor is hidden and the menu bar is what remains of the app.
static PARKED: AtomicBool = AtomicBool::new(false);
/// Set before `app.exit`, so a quit from the hidden state is not swallowed.
static QUITTING: AtomicBool = AtomicBool::new(false);
/// Bumped when the editor is shown, so a hide queued earlier does not run.
static SHOW_EPOCH: AtomicU64 = AtomicU64::new(0);

const APP_NAME: &str = "Pixen";
const ABOUT_WINDOW_WIDTH: f64 = 360.0;
const ABOUT_WINDOW_HEIGHT: f64 = 400.0;
/// Matches `--background` in src/styles/globals.css so the window never flashes white.
const ABOUT_WINDOW_BACKGROUND: Color = Color(16, 17, 20, 255);

/// A login launch: accessory from the start, and no splash to dismiss later.
pub fn enter_background(app: &AppHandle) {
    BACKGROUND_LAUNCH.store(true, Ordering::SeqCst);
    PARKED.store(true, Ordering::SeqCst);
    set_accessory(app);

    if let Some(splash) = app.get_webview_window(SPLASH_WINDOW_LABEL) {
        let _ = splash.destroy();
    }
}

/// Brings the editor back. Regular policy restores the Dock icon.
/// A fullscreen exit started by a hide is dropped, so this shows a normal
/// window instead of ordering it out when the space finishes closing.
pub fn show_main(app: &AppHandle) {
    SHOW_EPOCH.fetch_add(1, Ordering::SeqCst);
    cancel_pending_hide(app);
    PARKED.store(false, Ordering::SeqCst);
    set_regular(app);
    track_fullscreen_phase(app);

    if let Some(main) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        let _ = main.show();
        let _ = main.unminimize();
        let _ = main.set_focus();
    }
}

/// Hides the editor and drops the Dock icon. The webview stays loaded, so a
/// later capture still has a session to land in. Unsaved work is settled by
/// the webview before this runs: the red close button only asks, via
/// `HIDE_REQUESTED_EVENT`.
///
/// A native fullscreen window is not ordered out until AppKit has left that
/// space. Hiding inside the space leaves a null tile, which breaks the
/// traffic lights the next time the window is shown.
pub fn hide_main(app: &AppHandle) {
    // Before the hide, so an exit requested as the last window disappears is
    // still refused. Cleared again if fullscreen exit fails and the window
    // stays visible.
    PARKED.store(true, Ordering::SeqCst);

    if let Some(about) = app.get_webview_window(ABOUT_WINDOW_LABEL) {
        let _ = about.hide();
    }

    let Some(main) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        set_accessory(app);
        return;
    };

    let app = app.clone();
    let main_to_hide = main.clone();
    let epoch = SHOW_EPOCH.load(Ordering::SeqCst);
    hide_window_safely(main, epoch, move |end| {
        // Quit has already started teardown. Do not touch the window.
        if !window_change_allowed(QUITTING.load(Ordering::SeqCst)) {
            return;
        }

        if end == HideEnd::Hidden
            && fullscreen_exit_allowed(epoch, SHOW_EPOCH.load(Ordering::SeqCst), false)
        {
            let _ = main_to_hide.hide();
            set_accessory(&app);
            return;
        }

        PARKED.store(false, Ordering::SeqCst);
    });
}

/// Hides a visible editor before a screenshot, once it is safe to leave
/// fullscreen. Returns whether the window was actually ordered out.
///
/// Failure and cancellation leave the window visible and must not start a
/// capture. The wait runs on the capture command's worker, never the main
/// thread: the notification that completes it is delivered there.
pub fn hide_for_capture(window: &WebviewWindow) -> bool {
    #[cfg(target_os = "macos")]
    if objc2::MainThreadMarker::new().is_some() {
        return false;
    }

    let (sender, receiver) = std::sync::mpsc::channel();
    let hidden = window.clone();
    let epoch = SHOW_EPOCH.load(Ordering::SeqCst);
    hide_window_safely(window.clone(), epoch, move |end| {
        // Quit owns teardown. A hide that lost that race must not order the
        // window out or let the capture continue.
        let end =
            if end == HideEnd::Hidden && !window_change_allowed(QUITTING.load(Ordering::SeqCst)) {
                HideEnd::Cancelled
            } else {
                end
            };
        if end == HideEnd::Hidden {
            let _ = hidden.hide();
        }
        let _ = sender.send(end);
    });

    // Completed by the AppKit notification or the main-thread backstop in
    // `fullscreen_hide`. A silent `toggleFullScreen:` cannot park this wait.
    matches!(receiver.recv(), Ok(end) if capture_should_start(end))
}

/// True while the process should ignore an exit that did not come from Quit.
/// A visible editor, including during the splash, still quits normally.
pub fn should_keep_running() -> bool {
    keep_process_alive(
        PARKED.load(Ordering::SeqCst),
        QUITTING.load(Ordering::SeqCst),
    )
}

fn keep_process_alive(parked: bool, quitting: bool) -> bool {
    parked && !quitting
}

fn cancel_pending_hide(app: &AppHandle) {
    #[cfg(target_os = "macos")]
    fullscreen_hide::cancel(app);
    #[cfg(not(target_os = "macos"))]
    let _ = app;
}

fn track_fullscreen_phase(app: &AppHandle) {
    #[cfg(target_os = "macos")]
    fullscreen_hide::track_phase(app);
    #[cfg(not(target_os = "macos"))]
    let _ = app;
}

/// Hides the editor after the webview has resolved the unsaved-changes prompt.
/// The close button does not call this; it only emits `HIDE_REQUESTED_EVENT`.
#[tauri::command]
pub fn hide_main_window(app: AppHandle) {
    hide_main(&app);
}

/// Reveals the main window and dismisses the splash screen. The order matters:
/// showing `main` first means the desktop never flashes between the two.
/// A background launch only drops the splash, if it is still around.
#[tauri::command]
pub fn finish_launch(app: AppHandle) {
    if BACKGROUND_LAUNCH.load(Ordering::SeqCst) {
        destroy_splash(&app);
        return;
    }

    show_main(&app);
    destroy_splash(&app);
}

/// The frontend owns the unsaved-changes prompt, so it asks to exit here after
/// the user has decided rather than letting the window close itself.
#[tauri::command]
pub fn quit_app(app: AppHandle) {
    QUITTING.store(true, Ordering::SeqCst);
    // Drop the fullscreen wait without hiding or changing the window.
    // Observer tokens are released on the main thread. Quit does not wait
    // for the animation.
    cancel_pending_hide(&app);
    app.exit(0);
}

fn destroy_splash(app: &AppHandle) {
    // `destroy` rather than `close`: the splash is configured as unclosable so
    // the user cannot dismiss it, and it has no unsaved state to guard.
    if let Some(splash) = app.get_webview_window(SPLASH_WINDOW_LABEL) {
        let _ = splash.destroy();
    }
}

#[cfg(target_os = "macos")]
fn set_regular(app: &AppHandle) {
    let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
}

#[cfg(not(target_os = "macos"))]
fn set_regular(_app: &AppHandle) {}

#[cfg(target_os = "macos")]
fn set_accessory(app: &AppHandle) {
    let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
}

#[cfg(not(target_os = "macos"))]
fn set_accessory(_app: &AppHandle) {}

/// Opens About, or focuses it if it is already open. Built on demand rather
/// than at launch, so it does not sit next to splash and main from the start.
#[tauri::command]
pub fn show_about_window(app: AppHandle) {
    if let Some(window) = app.get_webview_window(ABOUT_WINDOW_LABEL) {
        let _ = window.show();
        let _ = window.set_focus();
        return;
    }

    let builder = WebviewWindowBuilder::new(
        &app,
        ABOUT_WINDOW_LABEL,
        WebviewUrl::App(format!("index.html?window={ABOUT_WINDOW_LABEL}").into()),
    )
    .title(format!("About {APP_NAME}"))
    .inner_size(ABOUT_WINDOW_WIDTH, ABOUT_WINDOW_HEIGHT)
    .background_color(ABOUT_WINDOW_BACKGROUND)
    .resizable(false)
    .maximizable(false)
    .minimizable(false)
    .center()
    .title_bar_style(tauri::TitleBarStyle::Overlay)
    .hidden_title(true);

    let Ok(window) = builder.build() else {
        return;
    };

    let _ = window.set_focus();
}

/// Matches `--radius-xl` in src/styles/globals.css. AppKit measures in points,
/// and one CSS pixel in this webview is one point.
const SPLASH_CORNER_RADIUS: f64 = 16.0;

/// Clips the splash window to a rounded rect. The main window is never looked up.
#[cfg(target_os = "macos")]
pub fn round_splash_corners(app: &AppHandle) {
    let Some(splash) = app.get_webview_window(SPLASH_WINDOW_LABEL) else {
        return;
    };

    clip_splash_window(&splash);
}

#[cfg(not(target_os = "macos"))]
pub fn round_splash_corners(_app: &AppHandle) {}

/// Public AppKit only: a non-opaque window, a clear background, and a content
/// view layer that masks to the corner radius. The window shadow stays on.
#[cfg(target_os = "macos")]
fn clip_splash_window(splash: &tauri::WebviewWindow) {
    use objc2::rc::Retained;
    use objc2_app_kit::{NSColor, NSWindow};

    let Ok(raw) = splash.ns_window() else {
        return;
    };
    // The pointer belongs to the window. Retain it for this call, then release.
    let Some(ns_window) = (unsafe { Retained::<NSWindow>::retain(raw.cast()) }) else {
        return;
    };

    ns_window.setOpaque(false);
    ns_window.setBackgroundColor(Some(&NSColor::clearColor()));

    let Some(content) = ns_window.contentView() else {
        return;
    };
    content.setWantsLayer(true);

    if let Some(layer) = content.layer() {
        layer.setCornerRadius(SPLASH_CORNER_RADIUS);
        layer.setMasksToBounds(true);
    }

    ns_window.setHasShadow(true);
    ns_window.invalidateShadow();
}

/// How a hide request ended. Only `Hidden` may order the window out or start
/// a screenshot.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum HideEnd {
    Hidden,
    Failed,
    Cancelled,
}

/// Where the main window is in AppKit's fullscreen animation.
/// Updated from public window notifications on the main thread.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum FullscreenPhase {
    Unknown,
    Normal,
    Entering,
    Fullscreen,
    Exiting,
}

/// What the main thread should do with a hide request.
/// `BeginExit` is the only action that may call `toggleFullScreen:`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum HideAction {
    HideNow,
    JoinPending,
    BeginExit,
    WaitUntilEntered,
    WaitUntilExited,
    Cancelled,
}

/// Chooses the next step from the phase tracker, the style mask, and whether
/// this hide still belongs to the window the user is looking at.
///
/// A missing `FullScreen` bit is not treated as a normal window while an
/// enter or exit animation is in progress. Those phases wait for AppKit.
fn decide_hide(
    phase: FullscreenPhase,
    mask_fullscreen: bool,
    exit_already_pending: bool,
    request_epoch: u64,
    current_epoch: u64,
    quitting: bool,
) -> HideAction {
    if !fullscreen_exit_allowed(request_epoch, current_epoch, quitting) {
        return HideAction::Cancelled;
    }
    if exit_already_pending {
        return HideAction::JoinPending;
    }
    match phase {
        FullscreenPhase::Entering => HideAction::WaitUntilEntered,
        FullscreenPhase::Exiting => HideAction::WaitUntilExited,
        FullscreenPhase::Fullscreen => {
            if mask_fullscreen {
                HideAction::BeginExit
            } else {
                // The tracker still says fullscreen, but the style mask does
                // not. Hiding here can hit a null tile, and toggling would
                // enter fullscreen again. Wait for the exit notification.
                HideAction::WaitUntilExited
            }
        }
        FullscreenPhase::Normal | FullscreenPhase::Unknown => {
            if mask_fullscreen {
                HideAction::BeginExit
            } else {
                HideAction::HideNow
            }
        }
    }
}

/// Last check before `toggleFullScreen:`. A stale epoch, a quit, or an
/// animation that is already running must not start another toggle.
/// A clear style mask must not start one either: toggling a window that has
/// already left the space would enter fullscreen again.
fn toggle_allowed(
    phase: FullscreenPhase,
    mask_fullscreen: bool,
    request_epoch: u64,
    current_epoch: u64,
    quitting: bool,
) -> bool {
    fullscreen_exit_allowed(request_epoch, current_epoch, quitting)
        && !matches!(phase, FullscreenPhase::Entering | FullscreenPhase::Exiting)
        && mask_fullscreen
}

/// A joined hide whose pending exit disappeared must not hide. The operation
/// that owns the transition is the only one allowed to change the window.
fn outcome_if_join_target_gone() -> HideEnd {
    HideEnd::Cancelled
}

/// Screenshot capture proceeds only after the editor was actually ordered out.
fn capture_should_start(end: HideEnd) -> bool {
    matches!(end, HideEnd::Hidden)
}

/// Quit has started teardown. A hide callback must not hide, show, or change
/// the activation policy.
fn window_change_allowed(quitting: bool) -> bool {
    !quitting
}

fn fullscreen_exit_allowed(request_epoch: u64, current_epoch: u64, quitting: bool) -> bool {
    !quitting && request_epoch == current_epoch
}

fn hide_window_safely<F>(window: WebviewWindow, epoch: u64, on_done: F)
where
    F: FnOnce(HideEnd) + Send + 'static,
{
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (window, epoch);
        on_done(HideEnd::Hidden);
    }

    #[cfg(target_os = "macos")]
    {
        let callbacks = std::sync::Arc::new(std::sync::Mutex::new(Some(on_done)));
        let for_main = std::sync::Arc::clone(&callbacks);
        let queued = window.clone().run_on_main_thread(move || {
            let Some(on_done) = for_main
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .take()
            else {
                return;
            };
            fullscreen_hide::hide_on_main(&window, epoch, on_done);
        });

        if queued.is_err() {
            if let Some(on_done) = callbacks
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .take()
            {
                on_done(HideEnd::Failed);
            }
        }
    }
}

#[cfg(target_os = "macos")]
mod fullscreen_hide {
    use std::cell::{Cell, RefCell};
    use std::ptr::NonNull;
    use std::sync::atomic::{AtomicU64, AtomicU8, Ordering};
    use std::sync::Mutex;
    use std::time::Duration;

    use block2::RcBlock;
    use objc2::rc::Retained;
    use objc2::runtime::{AnyObject, ProtocolObject};
    use objc2::MainThreadMarker;
    use objc2_app_kit::{
        NSWindow, NSWindowDidEnterFullScreenNotification, NSWindowDidExitFullScreenNotification,
        NSWindowStyleMask, NSWindowWillEnterFullScreenNotification,
        NSWindowWillExitFullScreenNotification,
    };
    use objc2_foundation::{
        NSNotification, NSNotificationCenter, NSObjectProtocol, NSOperationQueue, NSString,
    };
    use tauri::{Manager, WebviewWindow};

    use super::{
        decide_hide, outcome_if_join_target_gone, toggle_allowed, FullscreenPhase, HideAction,
        HideEnd, MAIN_WINDOW_LABEL, QUITTING, SHOW_EPOCH,
    };

    /// Apple posts these when a fullscreen animation cannot finish.
    /// The generated bindings do not include the symbols.
    const DID_FAIL_TO_ENTER: &str = "NSWindowDidFailToEnterFullScreenNotification";
    const DID_FAIL_TO_EXIT: &str = "NSWindowDidFailToExitFullScreenNotification";

    /// AppKit normally posts `NSWindowDidExitFullScreenNotification` or
    /// `NSWindowDidFailToExitFullScreenNotification`. A `toggleFullScreen:`
    /// issued while a transition is already running can post neither, which
    /// would leave the capture worker blocked and `PARKED` set.
    ///
    /// This is not the signal that fullscreen ended. The notification is.
    /// The backstop only fails the wait, on the main thread, so the window
    /// is left as it is. Eight seconds is far longer than the animation and
    /// only covers a transition that never reports completion.
    const HIDE_BACKSTOP: Duration = Duration::from_secs(8);

    type HideCallback = Box<dyn FnOnce(HideEnd) + Send>;

    /// Shared across threads. AppKit objects are intentionally absent:
    /// observer tokens live in a main-thread `thread_local` below.
    struct PendingHide {
        callbacks: Vec<HideCallback>,
        epoch: u64,
        wait_id: u64,
        toggled: bool,
    }

    static PENDING: Mutex<Option<PendingHide>> = Mutex::new(None);
    static NEXT_WAIT_ID: AtomicU64 = AtomicU64::new(1);
    static PHASE: AtomicU8 = AtomicU8::new(0);

    thread_local! {
        static PHASE_OBSERVERS: RefCell<Vec<Retained<ProtocolObject<dyn NSObjectProtocol>>>> =
            RefCell::new(Vec::new());
        static HIDE_OBSERVERS: RefCell<Vec<Retained<ProtocolObject<dyn NSObjectProtocol>>>> =
            RefCell::new(Vec::new());
        static PHASE_INSTALLED: Cell<bool> = const { Cell::new(false) };
    }

    fn phase_from_u8(value: u8) -> FullscreenPhase {
        match value {
            1 => FullscreenPhase::Normal,
            2 => FullscreenPhase::Entering,
            3 => FullscreenPhase::Fullscreen,
            4 => FullscreenPhase::Exiting,
            _ => FullscreenPhase::Unknown,
        }
    }

    fn phase_to_u8(phase: FullscreenPhase) -> u8 {
        match phase {
            FullscreenPhase::Unknown => 0,
            FullscreenPhase::Normal => 1,
            FullscreenPhase::Entering => 2,
            FullscreenPhase::Fullscreen => 3,
            FullscreenPhase::Exiting => 4,
        }
    }

    fn set_phase(phase: FullscreenPhase) {
        PHASE.store(phase_to_u8(phase), Ordering::SeqCst);
    }

    fn current_phase() -> FullscreenPhase {
        phase_from_u8(PHASE.load(Ordering::SeqCst))
    }

    fn pending_lock() -> std::sync::MutexGuard<'static, Option<PendingHide>> {
        PENDING.lock().unwrap_or_else(|error| error.into_inner())
    }

    pub(super) fn track_phase(app: &tauri::AppHandle) {
        if MainThreadMarker::new().is_some() {
            install_phase(app);
            return;
        }

        let app = app.clone();
        let _ = app.clone().run_on_main_thread(move || install_phase(&app));
    }

    fn install_phase(app: &tauri::AppHandle) {
        if PHASE_INSTALLED.with(Cell::get) {
            return;
        }

        let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
            return;
        };
        install_phase_from_window(&window);
    }

    fn install_phase_from_window(window: &WebviewWindow) {
        if PHASE_INSTALLED.with(Cell::get) {
            return;
        }

        let Some(ns_window) = native_window(window) else {
            return;
        };

        observe_phase(
            &ns_window,
            unsafe { NSWindowWillEnterFullScreenNotification },
            FullscreenPhase::Entering,
        );
        observe_phase(
            &ns_window,
            unsafe { NSWindowDidEnterFullScreenNotification },
            FullscreenPhase::Fullscreen,
        );
        observe_phase(
            &ns_window,
            unsafe { NSWindowWillExitFullScreenNotification },
            FullscreenPhase::Exiting,
        );
        observe_phase(
            &ns_window,
            unsafe { NSWindowDidExitFullScreenNotification },
            FullscreenPhase::Normal,
        );
        observe_phase_named(&ns_window, DID_FAIL_TO_ENTER, FullscreenPhase::Normal);
        observe_phase_named(&ns_window, DID_FAIL_TO_EXIT, FullscreenPhase::Fullscreen);

        // Do not clobber a transition that was already observed. A style mask
        // without `FullScreen` is only a normal window when no animation has
        // been seen yet.
        if current_phase() == FullscreenPhase::Unknown {
            if ns_window
                .styleMask()
                .contains(NSWindowStyleMask::FullScreen)
            {
                set_phase(FullscreenPhase::Fullscreen);
            } else {
                set_phase(FullscreenPhase::Normal);
            }
        }

        PHASE_INSTALLED.with(|installed| installed.set(true));
    }

    pub(super) fn hide_on_main<F>(window: &WebviewWindow, epoch: u64, on_done: F)
    where
        F: FnOnce(HideEnd) + Send + 'static,
    {
        install_phase_from_window(window);

        let Some(ns_window) = native_window(window) else {
            // Missing the native window is not evidence that it is safe to hide.
            on_done(HideEnd::Failed);
            return;
        };

        let action = decide_hide(
            current_phase(),
            ns_window
                .styleMask()
                .contains(NSWindowStyleMask::FullScreen),
            pending_lock().is_some(),
            epoch,
            SHOW_EPOCH.load(Ordering::SeqCst),
            QUITTING.load(Ordering::SeqCst),
        );

        match action {
            HideAction::Cancelled => on_done(HideEnd::Cancelled),
            HideAction::HideNow => on_done(HideEnd::Hidden),
            HideAction::JoinPending => join(on_done),
            HideAction::BeginExit | HideAction::WaitUntilEntered | HideAction::WaitUntilExited => {
                if store_pending(epoch, on_done) {
                    drive(window);
                }
            }
        }
    }

    fn store_pending<F>(epoch: u64, on_done: F) -> bool
    where
        F: FnOnce(HideEnd) + Send + 'static,
    {
        let mut guard = pending_lock();
        if let Some(pending) = guard.as_mut() {
            pending.callbacks.push(Box::new(on_done));
            return false;
        }

        let wait_id = NEXT_WAIT_ID.fetch_add(1, Ordering::SeqCst);
        *guard = Some(PendingHide {
            callbacks: vec![Box::new(on_done)],
            epoch,
            wait_id,
            toggled: false,
        });
        true
    }

    fn join<F>(on_done: F)
    where
        F: FnOnce(HideEnd) + Send + 'static,
    {
        let mut guard = pending_lock();
        if let Some(pending) = guard.as_mut() {
            pending.callbacks.push(Box::new(on_done));
            return;
        }

        drop(guard);
        on_done(outcome_if_join_target_gone());
    }

    /// Re-reads the phase and the style mask, then either hides, waits, or
    /// toggles. The toggle is reached only when `toggle_allowed` is still true.
    fn drive(window: &WebviewWindow) {
        let Some(epoch) = pending_lock().as_ref().map(|pending| pending.epoch) else {
            return;
        };
        let Some(ns_window) = native_window(window) else {
            finish(HideEnd::Failed);
            return;
        };

        let phase = current_phase();
        let mask = ns_window
            .styleMask()
            .contains(NSWindowStyleMask::FullScreen);
        let action = decide_hide(
            phase,
            mask,
            false,
            epoch,
            SHOW_EPOCH.load(Ordering::SeqCst),
            QUITTING.load(Ordering::SeqCst),
        );

        match action {
            HideAction::Cancelled => finish(HideEnd::Cancelled),
            HideAction::HideNow => finish(HideEnd::Hidden),
            HideAction::JoinPending => {}
            HideAction::WaitUntilEntered => {
                listen_for_enter(window);
                arm_watchdog(window);
            }
            HideAction::WaitUntilExited => {
                listen_for_exit(window);
                arm_watchdog(window);
            }
            HideAction::BeginExit => begin_exit(window, &ns_window, epoch),
        }
    }

    fn begin_exit(window: &WebviewWindow, ns_window: &NSWindow, epoch: u64) {
        // Replace any enter-wait listeners before the toggle, so a notification
        // delivered inside `toggleFullScreen:` still finds this wait.
        listen_for_exit(window);

        if !toggle_allowed(
            current_phase(),
            ns_window
                .styleMask()
                .contains(NSWindowStyleMask::FullScreen),
            epoch,
            SHOW_EPOCH.load(Ordering::SeqCst),
            QUITTING.load(Ordering::SeqCst),
        ) {
            // The window changed while the listeners were installed. Decide
            // again instead of toggling a stale request.
            drive(window);
            return;
        }

        if !claim_toggle(epoch) {
            return;
        }

        let Some(ns_window) = native_window(window) else {
            finish(HideEnd::Failed);
            return;
        };

        if !toggle_allowed(
            current_phase(),
            ns_window
                .styleMask()
                .contains(NSWindowStyleMask::FullScreen),
            epoch,
            SHOW_EPOCH.load(Ordering::SeqCst),
            QUITTING.load(Ordering::SeqCst),
        ) {
            if let Some(pending) = pending_lock().as_mut() {
                pending.toggled = false;
            }
            drive(window);
            return;
        }

        ns_window.toggleFullScreen(None);
        arm_watchdog(window);
    }

    /// Marks this wait as the one that called `toggleFullScreen:`.
    /// Returns false when the wait was cancelled or the epoch is stale, and
    /// in the stale case completes the wait as cancelled so nothing toggles.
    fn claim_toggle(epoch: u64) -> bool {
        let mut guard = pending_lock();
        let Some(pending) = guard.as_mut() else {
            return false;
        };
        if !super::fullscreen_exit_allowed(
            epoch,
            SHOW_EPOCH.load(Ordering::SeqCst),
            QUITTING.load(Ordering::SeqCst),
        ) {
            drop(guard);
            finish(HideEnd::Cancelled);
            return false;
        }
        pending.toggled = true;
        true
    }

    fn listen_for_enter(window: &WebviewWindow) {
        let Some(wait_id) = bump_wait_id() else {
            return;
        };
        let Some(ns_window) = native_window(window) else {
            finish(HideEnd::Failed);
            return;
        };

        let entered = window.clone();
        watch(
            &ns_window,
            unsafe { NSWindowDidEnterFullScreenNotification },
            move || {
                if wait_is_current(wait_id) {
                    // This notification is the enter completing. Set the phase
                    // here so a phase observer that has not run yet cannot
                    // make `drive` wait for another enter.
                    set_phase(FullscreenPhase::Fullscreen);
                    drive(&entered);
                }
            },
        );

        let failed = window.clone();
        watch_named(&ns_window, DID_FAIL_TO_ENTER, move || {
            on_enter_failed(wait_id, &failed);
        });
    }

    fn listen_for_exit(window: &WebviewWindow) {
        let Some(wait_id) = bump_wait_id() else {
            return;
        };
        let Some(ns_window) = native_window(window) else {
            finish(HideEnd::Failed);
            return;
        };

        watch(
            &ns_window,
            unsafe { NSWindowDidExitFullScreenNotification },
            move || {
                if wait_is_current(wait_id) {
                    set_phase(FullscreenPhase::Normal);
                    finish(HideEnd::Hidden);
                }
            },
        );

        let failed = window.clone();
        watch_named(&ns_window, DID_FAIL_TO_EXIT, move || {
            on_exit_failed(wait_id, &failed);
        });

        // `toggleFullScreen:` during an animation can come back as an enter.
        // That is a failure of this exit, not a cue to hide or toggle again.
        watch(
            &ns_window,
            unsafe { NSWindowDidEnterFullScreenNotification },
            move || {
                if wait_is_current(wait_id) {
                    set_phase(FullscreenPhase::Fullscreen);
                    finish(HideEnd::Failed);
                }
            },
        );
    }

    fn on_enter_failed(wait_id: u64, window: &WebviewWindow) {
        if !wait_is_current(wait_id) {
            return;
        }

        set_phase(FullscreenPhase::Normal);

        let Some(ns_window) = native_window(window) else {
            finish(HideEnd::Failed);
            return;
        };

        // The enter animation has ended. A `FullScreen` bit still set means
        // the window is in the space, so hiding would be the null-tile bug.
        if ns_window
            .styleMask()
            .contains(NSWindowStyleMask::FullScreen)
        {
            set_phase(FullscreenPhase::Fullscreen);
            finish(HideEnd::Failed);
            return;
        }

        finish(HideEnd::Hidden);
    }

    fn on_exit_failed(wait_id: u64, window: &WebviewWindow) {
        if !wait_is_current(wait_id) {
            return;
        }

        set_phase(FullscreenPhase::Fullscreen);

        let toggled = pending_lock()
            .as_ref()
            .map(|pending| pending.toggled)
            .unwrap_or(true);
        if toggled {
            finish(HideEnd::Failed);
            return;
        }

        // The system was already leaving fullscreen and that attempt failed.
        // One toggle, and only if the mask still says the window is in the space.
        drive(window);
    }

    fn bump_wait_id() -> Option<u64> {
        let mut guard = pending_lock();
        let pending = guard.as_mut()?;
        let wait_id = NEXT_WAIT_ID.fetch_add(1, Ordering::SeqCst);
        pending.wait_id = wait_id;
        drop(guard);
        // Drop listeners for the previous id before installing the new ones.
        // Their blocks may already be queued; the id check makes them no-ops.
        drop_hide_observers();
        Some(wait_id)
    }

    fn wait_is_current(wait_id: u64) -> bool {
        pending_lock().as_ref().map(|pending| pending.wait_id) == Some(wait_id)
    }

    fn finish(end: HideEnd) {
        let pending = pending_lock().take();
        let Some(pending) = pending else {
            return;
        };

        drop_hide_observers();

        let end = if end == HideEnd::Hidden
            && !super::fullscreen_exit_allowed(
                pending.epoch,
                SHOW_EPOCH.load(Ordering::SeqCst),
                QUITTING.load(Ordering::SeqCst),
            ) {
            HideEnd::Cancelled
        } else {
            end
        };

        for callback in pending.callbacks {
            callback(end);
        }
    }

    fn expire(wait_id: u64) {
        let pending = {
            let mut guard = pending_lock();
            if guard.as_ref().map(|pending| pending.wait_id) != Some(wait_id) {
                return;
            }
            guard.take()
        };
        let Some(pending) = pending else {
            return;
        };

        drop_hide_observers();
        for callback in pending.callbacks {
            callback(HideEnd::Failed);
        }
    }

    /// Same as `expire`, but safe to run off the main thread: it never touches
    /// observer tokens. Used only when the main queue itself cannot be reached.
    fn fail_wait_without_observers(wait_id: u64) {
        let pending = {
            let mut guard = pending_lock();
            if guard.as_ref().map(|pending| pending.wait_id) != Some(wait_id) {
                return;
            }
            guard.take()
        };
        let Some(pending) = pending else {
            return;
        };

        for callback in pending.callbacks {
            callback(HideEnd::Failed);
        }
    }

    fn arm_watchdog(window: &WebviewWindow) {
        let Some(wait_id) = pending_lock().as_ref().map(|pending| pending.wait_id) else {
            return;
        };
        let app = window.app_handle().clone();
        let spawned = std::thread::Builder::new()
            .name("pixen-fullscreen-hide".to_owned())
            .spawn(move || {
                std::thread::sleep(HIDE_BACKSTOP);
                if app.run_on_main_thread(move || expire(wait_id)).is_err() {
                    fail_wait_without_observers(wait_id);
                }
            });

        if spawned.is_err() {
            finish(HideEnd::Failed);
        }
    }

    /// Signals cancellation from whichever thread asked. The callbacks do not
    /// touch AppKit. Observer removal is queued onto the main thread, which is
    /// also where the tokens are dropped.
    pub(super) fn cancel(app: &tauri::AppHandle) {
        let pending = pending_lock().take();
        let Some(pending) = pending else {
            return;
        };

        for callback in pending.callbacks {
            callback(HideEnd::Cancelled);
        }

        let app = app.clone();
        // If this fails, the tokens stay in the main thread's local storage.
        // They are not moved onto this thread, so they cannot be released here.
        let _ = app.run_on_main_thread(drop_hide_observers);
    }

    fn observe_phase(ns_window: &NSWindow, name: &NSString, phase: FullscreenPhase) {
        let block = RcBlock::new(move |_note: NonNull<NSNotification>| {
            set_phase(phase);
        });
        let token = add_observer(ns_window, name, &block);
        PHASE_OBSERVERS.with(|cell| cell.borrow_mut().push(token));
    }

    fn observe_phase_named(ns_window: &NSWindow, name: &str, phase: FullscreenPhase) {
        let name = NSString::from_str(name);
        observe_phase(ns_window, &name, phase);
    }

    fn watch(ns_window: &NSWindow, name: &NSString, handler: impl Fn() + Send + 'static) {
        let block = RcBlock::new(move |_note: NonNull<NSNotification>| handler());
        let token = add_observer(ns_window, name, &block);
        HIDE_OBSERVERS.with(|cell| cell.borrow_mut().push(token));
    }

    fn watch_named(ns_window: &NSWindow, name: &str, handler: impl Fn() + Send + 'static) {
        let name = NSString::from_str(name);
        watch(ns_window, &name, handler);
    }

    fn add_observer(
        ns_window: &NSWindow,
        name: &NSString,
        block: &block2::DynBlock<dyn Fn(NonNull<NSNotification>)>,
    ) -> Retained<ProtocolObject<dyn NSObjectProtocol>> {
        let center = NSNotificationCenter::defaultCenter();
        let queue = NSOperationQueue::mainQueue();
        let object: &AnyObject = ns_window.as_ref();
        unsafe {
            center.addObserverForName_object_queue_usingBlock(
                Some(name),
                Some(object),
                Some(&queue),
                block,
            )
        }
    }

    /// Removes and drops hide observers. Both happen on the main thread.
    /// Off the main thread this returns without touching the tokens.
    fn drop_hide_observers() {
        if MainThreadMarker::new().is_none() {
            return;
        }

        let tokens = HIDE_OBSERVERS.with(|cell| std::mem::take(&mut *cell.borrow_mut()));
        let center = NSNotificationCenter::defaultCenter();
        for token in tokens {
            unsafe { center.removeObserver(token.as_ref()) };
        }
    }

    fn native_window(window: &WebviewWindow) -> Option<Retained<NSWindow>> {
        let raw = window.ns_window().ok()?;
        unsafe { Retained::retain(raw.cast()) }
    }

    #[cfg(test)]
    mod ownership {
        #[test]
        fn pending_hide_is_send_without_appkit_tokens() {
            fn assert_send<T: Send>() {}
            // `PendingHide` is the shared state. It compiles as `Send` only
            // because it holds callbacks and integers, not observer tokens.
            assert_send::<super::PendingHide>();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{
        capture_should_start, decide_hide, fullscreen_exit_allowed, keep_process_alive,
        outcome_if_join_target_gone, toggle_allowed, window_change_allowed, FullscreenPhase,
        HideAction, HideEnd,
    };

    // These tests cover the decisions the hide path makes. They do not create
    // AppKit objects, post notifications, or run on the main thread. The
    // notification delivery, `toggleFullScreen:`, and observer teardown still
    // have to be checked on macOS.

    #[test]
    fn keeps_the_process_alive_only_while_parked_and_not_quitting() {
        assert!(keep_process_alive(true, false));
        assert!(!keep_process_alive(false, false));
        assert!(!keep_process_alive(true, true));
        assert!(!keep_process_alive(false, true));
    }

    #[test]
    fn stale_epoch_cancels_before_fullscreen_exit() {
        assert_eq!(
            decide_hide(FullscreenPhase::Fullscreen, true, false, 1, 2, false),
            HideAction::Cancelled
        );
        assert!(!fullscreen_exit_allowed(1, 2, false));
        assert!(!toggle_allowed(
            FullscreenPhase::Fullscreen,
            true,
            1,
            2,
            false
        ));
    }

    #[test]
    fn joined_hide_does_not_hide_when_the_pending_exit_is_gone() {
        assert_eq!(outcome_if_join_target_gone(), HideEnd::Cancelled);
        assert_ne!(outcome_if_join_target_gone(), HideEnd::Hidden);
    }

    #[test]
    fn cancelled_capture_does_not_start() {
        assert!(!capture_should_start(HideEnd::Cancelled));
    }

    #[test]
    fn failed_capture_does_not_start() {
        assert!(!capture_should_start(HideEnd::Failed));
        assert!(capture_should_start(HideEnd::Hidden));
    }

    #[test]
    fn quit_cancels_a_pending_hide_without_changing_the_window() {
        assert!(!window_change_allowed(true));
        assert!(window_change_allowed(false));
        assert_eq!(
            decide_hide(FullscreenPhase::Fullscreen, true, true, 4, 4, true),
            HideAction::Cancelled
        );
        assert!(!toggle_allowed(
            FullscreenPhase::Fullscreen,
            true,
            4,
            4,
            true
        ));
    }

    #[test]
    fn entering_fullscreen_is_not_treated_as_a_normal_window() {
        assert_eq!(
            decide_hide(FullscreenPhase::Entering, false, false, 3, 3, false),
            HideAction::WaitUntilEntered
        );
        assert_eq!(
            decide_hide(FullscreenPhase::Entering, true, false, 3, 3, false),
            HideAction::WaitUntilEntered
        );
        assert!(!toggle_allowed(
            FullscreenPhase::Entering,
            true,
            3,
            3,
            false
        ));
    }

    #[test]
    fn an_exit_already_in_progress_is_not_toggled_again() {
        assert_eq!(
            decide_hide(FullscreenPhase::Exiting, true, false, 3, 3, false),
            HideAction::WaitUntilExited
        );
        assert!(!toggle_allowed(FullscreenPhase::Exiting, true, 3, 3, false));
        assert_eq!(
            decide_hide(FullscreenPhase::Fullscreen, true, true, 3, 3, false),
            HideAction::JoinPending
        );
    }

    #[test]
    fn fullscreen_phase_without_the_style_mask_waits_instead_of_hiding() {
        assert_eq!(
            decide_hide(FullscreenPhase::Fullscreen, false, false, 1, 1, false),
            HideAction::WaitUntilExited
        );
        assert!(!toggle_allowed(
            FullscreenPhase::Fullscreen,
            false,
            1,
            1,
            false
        ));
    }

    #[test]
    fn a_fullscreen_window_exits_before_it_is_hidden() {
        assert_eq!(
            decide_hide(FullscreenPhase::Fullscreen, true, false, 5, 5, false),
            HideAction::BeginExit
        );
        assert!(toggle_allowed(
            FullscreenPhase::Fullscreen,
            true,
            5,
            5,
            false
        ));
    }

    #[test]
    fn a_normal_window_hides_without_a_toggle() {
        assert_eq!(
            decide_hide(FullscreenPhase::Normal, false, false, 5, 5, false),
            HideAction::HideNow
        );
        assert!(!toggle_allowed(FullscreenPhase::Normal, false, 5, 5, false));
    }

    #[test]
    fn a_clear_style_mask_during_entry_does_not_allow_a_toggle_or_an_immediate_hide() {
        assert_ne!(
            decide_hide(FullscreenPhase::Entering, false, false, 1, 1, false),
            HideAction::HideNow
        );
        assert!(!toggle_allowed(
            FullscreenPhase::Entering,
            false,
            1,
            1,
            false
        ));
    }

    #[test]
    fn cancellation_is_not_a_hide_and_does_not_start_capture() {
        let end = outcome_if_join_target_gone();
        assert_eq!(end, HideEnd::Cancelled);
        assert!(!capture_should_start(end));
        assert!(!window_change_allowed(true));
    }
}
