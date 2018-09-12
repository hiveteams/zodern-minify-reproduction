import { Meteor } from 'meteor/meteor';
// import is from 'is_js';

// // method stack
// import './method-stack.js';

// // Backwards compatibility
// import '../meteor-backwards-compatibility';

// // set browser agent in the header - used for less browser mixin
// import './agent.js';
// // import only for touch devices
// if (is.touchDevice()) {
//   // Jquery touch punch plugin
//   if (is.windows()) {
//     import '/imports/ui/lib/mobile/jquery.ui.touch-punch-windows.js';
//   } else {
//     import '/imports/ui/lib/mobile/jquery.ui.touch-punch.js';
//   }
// }
// // import only for IE
// if (is.ie() || is.edge()) {
//   // Hive icomoon font
//   import '/imports/ui/stylesheets/hivecons.less';
// }

// Polyfills
// import './polyfills.js';
// // Sortable Widget
// import './sortable_setup.js';
// // Environment helpers
// import '../environment-helpers.js';
// // blaze cacher
// import './londonCacher.js';
// import './chatCacher.js';
// // SS Settings
// import '../simple-schema-settings.js';
// // TS Settings
// import './timesync-settings.js';

// User helpers
// import '../../api/users/users.js';
// // Desktop/Electron helpers
// import '/imports/api/desktop/client/desktop.js';
// // Segment setup
// import './segment-setup.js';
// // Global template helpers
// import './global-template-helpers.js';
// Narrow screen helper
// import './narrow-screen.js';
// Bootstrap focus loop for nested modals fix
// import '/imports/ui/lib/client/bootstrap-modal-overrides.js';
// // Window unload
// import './window-unload.js';
// // Routes
// import './routes.js';
// Custom logout
// import './logout.js';
// logger
// import './logger.js';

// Init At.js
// import '/imports/ui/components/client/at.js/atwho.css';
// import '/imports/ui/components/client/at.js/atwho.js';
// import '/imports/ui/components/client/at.js/jquery.caret.js';

// // subaction hooks
// import '../../api/actions/subaction-hooks.js';

// // User presence
// import '/imports/startup/client/user-presence.js';

// if (!Meteor.isProduction()) {
//   // test helpers
//   import '/imports/api/test-helpers/client/client.js';
// }

// prevent hot code reload from reordering meteor css styles in head tag
// import '/imports/startup/client/hot-code-reload-style-order.js';

// import '/imports/startup/client/storage-picker-load';

// Dev mode exports globals
// if (Meteor.isDev()) {
//   import '/imports/api/dev-api.js';
// }


import "/imports/ui/lib/general-helpers.js"