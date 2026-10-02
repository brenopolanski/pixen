//! Login-item registration through `SMAppService`.
//!
//! A sandboxed Mac App Store app cannot write `~/Library/LaunchAgents`, which
//! is what `tauri-plugin-autostart` does. Registering the main app needs no
//! extra entitlement. The plugin stays only so an older LaunchAgent can be
//! turned off once.

use objc2_foundation::NSAppleEventManager;
use objc2_service_management::{SMAppService, SMAppServiceStatus};

/// `kAEOpenApplication` ('oapp').
const OPEN_APPLICATION: u32 = u32::from_be_bytes(*b"oapp");
/// `keyAEPropData` ('prdt').
const PROP_DATA: u32 = u32::from_be_bytes(*b"prdt");
/// `keyAELaunchedAsLogInItem` ('lgit').
const LAUNCHED_AS_LOGIN_ITEM: u32 = u32::from_be_bytes(*b"lgit");

/// Enabled, or waiting on the user in System Settings. Both mean the item is on.
pub fn is_enabled() -> bool {
    let status = unsafe { SMAppService::mainAppService().status() };

    status == SMAppServiceStatus::Enabled || status == SMAppServiceStatus::RequiresApproval
}

/// Registers or unregisters the main app. `false` means the call was refused.
pub fn set_enabled(enabled: bool) -> bool {
    let service = unsafe { SMAppService::mainAppService() };
    let result = if enabled {
        unsafe { service.registerAndReturnError() }
    } else {
        unsafe { service.unregisterAndReturnError() }
    };

    result.is_ok()
}

/// Whether this process was started as a login item.
///
/// `currentAppleEvent` is nil when setup runs before the event is delivered.
/// That reads as a normal launch, which shows the window rather than hiding a
/// launch the user asked for.
pub fn launched_as_login_item() -> bool {
    let Some(event) = NSAppleEventManager::sharedAppleEventManager().currentAppleEvent() else {
        return false;
    };

    describes_login_launch(
        event.eventID(),
        event
            .paramDescriptorForKeyword(PROP_DATA)
            .as_ref()
            .map(|descriptor| descriptor.enumCodeValue()),
        event
            .paramDescriptorForKeyword(LAUNCHED_AS_LOGIN_ITEM)
            .is_some(),
    )
}

/// `kAEOpenApplication` whose `keyAEPropData` is `keyAELaunchedAsLogInItem`,
/// or an event that carries the `'lgit'` parameter itself.
pub fn describes_login_launch(
    event_id: u32,
    prop_data: Option<u32>,
    has_login_param: bool,
) -> bool {
    if has_login_param {
        return true;
    }

    event_id == OPEN_APPLICATION && prop_data == Some(LAUNCHED_AS_LOGIN_ITEM)
}

#[cfg(test)]
mod tests {
    use super::{describes_login_launch, LAUNCHED_AS_LOGIN_ITEM, OPEN_APPLICATION};

    #[test]
    fn an_open_application_event_marked_as_a_login_item_is_a_background_launch() {
        assert!(describes_login_launch(
            OPEN_APPLICATION,
            Some(LAUNCHED_AS_LOGIN_ITEM),
            false
        ));
    }

    #[test]
    fn a_login_item_parameter_is_enough_on_its_own() {
        assert!(describes_login_launch(0, None, true));
    }

    #[test]
    fn an_ordinary_open_is_not_a_login_launch() {
        assert!(!describes_login_launch(OPEN_APPLICATION, None, false));
        assert!(!describes_login_launch(
            OPEN_APPLICATION,
            Some(u32::from_be_bytes(*b"othe")),
            false
        ));
        assert!(!describes_login_launch(
            0,
            Some(LAUNCHED_AS_LOGIN_ITEM),
            false
        ));
    }
}
