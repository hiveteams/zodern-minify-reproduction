/* globals window */
/* eslint-disable global-require, no-restricted-syntax, guard-for-in, no-useless-escape, max-len, no-confusing-arrow, import/no-unresolved */
import { Meteor } from 'meteor/meteor';
import { HTTP } from 'meteor/http';
import moment from 'moment';
// import { Roles } from 'meteor/alanning:roles';
import { $ } from 'meteor/jquery';
import { SimpleSchema } from 'meteor/aldeed:simple-schema';
// import { FlowRouter } from 'meteor/kadira:flow-router';
import sanitizeHtml from 'sanitize-html';
import R from 'ramda';
import _ from 'lodash';
// import 'meteor/cwaring:modernizr';
import Autolinker from 'autolinker';

import OnboardingListManager from '/imports/ui/lib/onboarding-helpers.js';
// import { Organizations } from '/imports/api/organizations/organizations.js';
// import { insertMessage } from '/imports/api/messages/methods.js';
// import { getEmailQuery } from '/imports/api/users/helpers.js';

// // "Cached" list of Vanguard agents
// import AgentList from '/imports/ui/lib/vanguard-agents.js';
// import { VANGUARD, ENLIVANT } from '/imports/utils/customers-constants.js';
// import { UserSettings } from '../../api/user-settings/user-settings.js';
// import { Workspaces } from '../../api/workspaces/workspaces.js';
// import { Groups } from '../../api/groups/groups.js';
// import { MyFiles } from '../../api/files/files.js';
// import { ActivityFeeds } from '../../api/activity-feeds/activity-feeds.js';
// import { Labels } from '../../api/labels/labels';
// import { Projects } from '/imports/api/projects/projects.js';
// import { HiveOneDrive } from '/imports/api/one-drive/common';
// import { Emoji } from './emoji/emoji';
// import { HivePermissions } from '../../api/permissions/permissions';


let GoogleDriveRecentFiles;
let Desktop;

let Raven;
if (Meteor.isServer) {
  Raven = require('raven');
} else {
  Raven = require('raven-js');
}

if (Meteor.isClient) {
  // Desktop = require('/imports/api/desktop/client/desktop').Desktop; // eslint-disable-line
  // GoogleDriveRecentFiles = require('/imports/api/google-drive/client/google-drive').GoogleDriveRecentFiles; // eslint-disable-line
}

// if the first element has one of these values it means that the label is not selected
const emptyLabelsList = [null, 'none'];
// getFirstLabel :: Array -> String | false
// Returns first label ID or false if the label has an empty value
const getFirstLabel = R.compose(
  R.when(R.contains(R.__, emptyLabelsList), R.F),
  R.head,
);

const parseHex = (color = '#ffffff') => {
  color = color.replace('#', '');
  const r = parseInt(color.substr(0, 2), 16);
  const g = parseInt(color.substr(2, 2), 16);
  const b = parseInt(color.substr(4, 2), 16);
  return [r, g, b];
}

/**
 * Removes "script" words from the string if it follows "<" or "&lt;".
 * It doesn't clear all scripts from the string. It just breaks them.
 * Text may become strange, but safe
 *
 * @param {string} string - input string
 * @return {string}
 */
const breakScriptTags = string => string
  .replace(/;\/?script/gi, '') // replace all occurrences of "&lt;script" "&lt;/script"
  .replace(/<\/?script/gi, ''); // remove all occurrences of "<script", "</script"


// Global helper functions.
export default {
  // call meteor defer on the server
  // otherwise execute it normally on the client
  // because Meteor defer is losing userId() context
  // we may choose to act as a user in the case we want to defer
  // anything that is using userId() - such as method calls
  // passUserId - pass userId if you need to execute on behalf of different user
  defer(cb, shouldActAsUser = false, passUserId) {
    if (Meteor.isServer) {
      import actAsUser from '/imports/api/server/act-as-user.js'; // eslint-disable-line

      const userId = passUserId || Meteor.userId();
      Meteor.defer(() => {
        if (shouldActAsUser) {
          actAsUser(userId, cb);
        } else {
          cb();
        }
      });
    } else {
      cb();
    }
  },

  optimisticUpdate(callback = () => null, userId = Meteor.userId()) {
    if (Meteor.isClient) {
      return callback();
    } else if (Meteor.isServer) {
      Meteor.defer(() => import('/imports/api/server/act-as-user.js')
        .then(({ default: actAsUser }) => actAsUser(userId, callback)));
    }
  },

  escapeRegex(string) {
    // Escape ^$.*+-?=!:|\/()[]{},
    return string.replace(/[\^\$\.\*\+\-\?\=\!\:\|\\\/\(\)\[\]\{\}\,]/g, '\\$&');
  },
  subscribeForAttachments(attachments, instance) {
    const dropBoxFileIds = new Set();
    attachments.forEach((attachment) => {
      if (attachment.type === 'google-drive') {
        instance.subscribe('googleDriveFile', attachment.id);
      } else if (attachment.type === 'box') {
        instance.subscribe('boxPersonalFile', attachment.id);
        instance.subscribe('boxSharedFile', attachment.id);
      } else if (attachment.type === 'hive-drive' || attachment.type === 'sharedDriveLink') {
        instance.subscribe('hiveDriveFile', attachment.id);
      } else if (attachment.type === 'dropbox') {
        dropBoxFileIds.add(attachment.id);
      } else if (attachment.type === HiveOneDrive.name) {
        instance.subscribe('oneDriveFile', attachment.id);
      }
    });
    instance.subscribe('dropboxFiles', Array.from(dropBoxFileIds));
  },
  s3Img(name = '', folder = 'hv-static-content') {
    return `https://s3.amazonaws.com/${folder}/${name}`;
  },

  // Has the user using Slack for messaging?
  usingSlack() {
    const userId = Meteor.userId();
    const workspace = FlowRouter.getParam('workspaceId');
    const user = Meteor.users.findOne(userId, { fields: { 'services.slack': 1 } });
    const userSettings = UserSettings.findOne({ userId, workspace }, { fields: { messagingTool: 1 } });
    return user && user.services &&
      user.services.slack && userSettings && userSettings.messagingTool === 'slack';
  },

  // Has the user connected a Slack account?
  connectedSlack() {
    const user = Meteor.users.findOne(Meteor.userId(), { fields: { 'services.slack': 1 } });
    return user && user.services && user.services.slack;
  },

  // Transform object into url params string
  // E.g. { name: 'Buzz', color: 'yellow' }
  // Becomes: name=Buzz&color=yellow
  objectToParams(obj) {
    let str = '';
    for (const key in obj) {
      if (str !== '') {
        str += '&';
      }
      str += `${key}=${encodeURIComponent(obj[key])}`;
    }
    return str;
  },

  // Focus on input and move caret to the end
  placeCaretAtEnd(el) {
    el.focus();
    if (typeof window.getSelection !== 'undefined'
      && typeof document.createRange !== 'undefined') {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } else if (typeof document.body.createTextRange !== 'undefined') {
      const textRange = document.body.createTextRange();
      textRange.moveToElementText(el);
      textRange.collapse(false);
      textRange.select();
    }
  },

  // Sort array of documents by array of those ids
  sortByIdsArray(idsArray = [], array = [], onNotFound) {
    return array.sort((a, b) => {
      const indexA = idsArray.indexOf(a._id);
      const indexB = idsArray.indexOf(b._id);

      if (onNotFound && (indexA === indexB && indexA === -1)) {
        return onNotFound(a, b);
      }

      if (indexA === indexB) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  },

  // Return current user offset
  getUserUtcOfsset(options = {}) {
    let offset = moment.tz(Meteor.user().timezone).utcOffset();
    if (!options.convert) offset *= -1;

    switch (options.timeUnits) {
      case 'miliseconds':
        offset *= (60 * 1000);
        break;
      case 'seconds':
        offset *= 60;
        break;
      case 'minutes':
        break;
      case 'hours':
        offset /= 60;
        break;
      default:
        break;
    }

    return offset;
  },

  getUserTimezone(userId = Meteor.userId()) {
    const { timezone } = Meteor.users.findOne(userId, { fields: { timezone: 1 } }) || {};
    return timezone || moment.tz.guess();
  },

  formatDate(date) {
    if (date) {
      return moment(new Date(date)).format('MMM Do YYYY');
    }

    return null;
  },

  getDateWithTimezone(date, userId = Meteor.userId()) {
    const timezone = this.getUserTimezone(userId);
    return moment(date).tz(timezone).startOf('day').toDate();
  },

  getAtwhoCommands(isMessage = false) {
    const atWhoCommands = [
      { name: 'giphy', displayName: 'giphy&nbsp;<strong>search-term</strong>' },
    ];

    const user = Meteor.users.findOne(Meteor.userId(), { fields: { 'services.zoom': 1 } });
    if (isMessage && user && user.hasService('zoom')) {
      atWhoCommands.push({ name: 'zoom', displayName: 'zoom&nbsp;<strong>topic</strong>' });
    }

    return atWhoCommands;
  },

  currentMidday(date = moment()) {
    if (Meteor.isServer) {
      return this.getDateWithTimezone(date).add(12, 'hours');
    }
    return moment(date).startOf('day').add(12, 'hours');
  },

  lastMidnight() {
    return moment().startOf('day').toDate();
  },

  previousMidnight() {
    return moment().startOf('day').add(-1, 'days')
      .toDate();
  },

  storageAvailable(type = 'localStorage') {
    try {
      const storage = window[type];
      const x = '__storage_test__';
      storage.setItem(x, x);
      storage.removeItem(x);
      return true;
    } catch (e) {
      return false;
    }
  },

  nextMidnight() {
    return moment().startOf('day').add(1, 'days')
      .toDate();
  },

  followingMidnight() {
    return moment().startOf('day').add(2, 'days')
      .toDate();
  },

  // Validate email
  validateEmail(email) {
    const re = /^([\w-]+(?:\.[\w-]+)*)@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,6}(?:\.[a-z]{2})?)$/i;
    return re.test(email);
  },

  // Check if on mobile
  isMobile() {
    return window.innerWidth < 900;
  },

  // Capitalize first letter
  ucfirst(str) {
    const firstLetter = str.slice(0, 1);
    return firstLetter.toUpperCase() + str.substring(1);
  },

  parseCssDuration(duration) {
    if (duration) {
      if (duration.indexOf('ms') > -1) {
        duration = duration.slice(0, duration.indexOf('ms'));
        return parseInt(duration, 10);
      } else if (duration.indexOf('s') > -1) {
        duration = duration.slice(0, duration.indexOf('s'));
        return parseInt(duration, 10) * 1000;
      }
    }
    return 0;
  },

  getAWSKeyFromUrl(url) {
    const urlReg = /^https?:\/\/.*?\//g;
    return url.replace(urlReg, '');
  },

  startWithUrl(str) {
    const urlReg = /^https?:\/\//g;
    return urlReg.test(str);
  },

  escapeHTML(str) {
    const escapeMap = {
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '`': '&#x60;',
      '&': '&amp;',
    };

    return str.replace(/[&<>"'`]/g, char => escapeMap[char]);
  },

  escapeEmoji(str, isDesktop) {
    const body = this.stripHtml(str);
    const res = isDesktop ? body : this.escapeHTML(body);

    return Emoji.escapeTags(res, null, isDesktop)
  },

  unescapeHTML(str = '') {
    const unescapeMap = {
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#x27;': "'",
      '&#x60;': '`',
      '&amp;': '&',
    };

    for (const escapedChar in unescapeMap) {
      const regexp = new RegExp(escapedChar, 'g');
      str = str.replace(regexp, unescapeMap[escapedChar]);
    }
    return str;
  },

  // firstNameOrEmail: function(user) {
  //   return user.profile.firstName || user.emails[0].address;
  // },
  //
  fullNameOrEmail(user) {
    if (user.bot) {
      return user.profile.firstName;
    }
    if (user.profile.firstName && user.profile.lastName) {
      return `${user.profile.firstName} ${user.profile.lastName}`;
    }
    return user.emails[0].address;
  },

  groupCompletedActions(actions = []) {
    const now = moment();
    const yesterday = moment().subtract(1, 'day');
    const sections = [
      { key: 'today', title: 'Completed today', actions: [] },
      { key: 'yesterday', title: 'Completed yesterday', actions: [] },
      { key: 'thisWeek', title: 'Completed this week', actions: [] },
      { key: 'earlier', title: 'Completed earlier', actions: [] },
    ];

    actions.forEach((action) => {
      const checkedAt = moment(action.checkedDate);
      let section = 3;
      if (now.isSame(checkedAt, 'day')) {
        section = 0;
      } else if (yesterday.isSame(checkedAt, 'day')) {
        section = 1;
      } else if (now.isSame(checkedAt, 'week')) {
        section = 2;
      }
      sections[section].actions.push(action);
    });

    return sections;
  },

  // Takes any html element and ensures it stays visible on page
  positionElemOnPage($elem) {
    const off = $elem.offset();
    const t = off.top;
    const l = off.left;
    const w = $elem.width();
    const h = $elem.height();
    const docH = $('.container').height();
    const docW = $('.container').width();
    const isVisibleX = (l + w <= docW);
    const isVisibleY = (t + h <= docH);
    const newOffset = {};
    if (!isVisibleY) {
      newOffset.top = `${(docH - h)}px`;
    }
    if (!isVisibleX) {
      newOffset.left = `${docW - w}px`;
    }
    $elem.css({ ...newOffset });
    return $elem;
  },

  calcDropdownOffset(anchor, dropdownMenu, options = {}) {
    const $anchor = $(anchor);
    const $dropdownMenu = $(dropdownMenu);

    const elWidth = $anchor.outerWidth(!options.ignoreMargins);
    const elHeight = $anchor.outerHeight(!options.ignoreMargins);
    const elOffset = $anchor.offset();

    let dmWidth = $dropdownMenu.outerWidth(true);
    let dmHeight = $dropdownMenu.outerHeight(true);

    // Optionally pass childHeight + childWidth if dropdown isn't rendered yet
    // so we can use a fixed height or width for Dropdown Menu
    if (options.childHeight) {
      dmHeight = options.childHeight;
    }
    if (options.childWidth) {
      dmWidth = options.childWidth;
    }

    const minHeight = options.minHeight || dmHeight;

    const $container = $(document.body);
    const cHeight = $container.height();
    const cWidth = $container.width();

    const bodyOffset = 2;
    let { top, left } = elOffset;
    const { moveTop = 0, moveLeft = 0 } = options;
    top += moveTop;
    left += moveLeft;
    // Overflow element position
    if (options.overflowAnchor) {
      if (elOffset.top + dmHeight > cHeight) {
        top = elOffset.top - (dmHeight - elHeight);
      }
      if (elOffset.left + dmWidth > cWidth) {
        left = elOffset.left - (dmWidth - elWidth);
      }
    } else if (options.minBottom) {
      // Show with small offset from bottom
      if (top + elHeight + dmHeight + elHeight > cHeight) {
        top = cHeight - dmHeight - 10;
      } else {
        top += elHeight;
      }
      left = elOffset.left - (dmWidth - elWidth);
    } else {
      // Show dropdown below (or above) element
      if ((elOffset.top + elHeight + minHeight) < cHeight) {
        top = elOffset.top + elHeight;
      } else {
        top = elOffset.top - dmHeight;
      }
      left = elOffset.left - (dmWidth - elWidth);
    }

    if (options.left) {
      left += options.left;
    }

    if (options.showRight) {
      left = elOffset.left; // eslint-disable-line
    } else if (options.centered) {
      left = elOffset.left - ((dmWidth - elWidth) / 2);
    }

    // Prevent overflow by top of left
    if (left < 0) left = bodyOffset;
    if (top < 0) top = bodyOffset;

    // Prevent overflow by right
    const right = dmWidth + left;
    if (right > cWidth) left -= (right - cWidth);

    if (options.showLeft) {
      const newLeftOffset = left - elWidth;
      left = newLeftOffset < 0 ? bodyOffset : newLeftOffset;
    }

    if (options.inPixels) {
      top += 'px';
      left += 'px';
    }

    return { top, left };
  },

  // Takes in an email string, returns a case-insensitive
  // mongo db query based on Meteor user emails.
  getEmailQuery(email) {
    return getEmailQuery(email);
  },

  stripHtml(str = '') {
    const tmp = document.createElement('DIV');
    tmp.innerHTML = str;
    return tmp.textContent || tmp.innerText || '';
  },

  stripServerHTML(str, includeATag = false) {
    if (str) {
      // remove script tag
      str = breakScriptTags(str);

      // Replace <br> tag with \n
      str = str.replace(/<br\s*\/?>/gi, '\n');
      // Remove other tags
      if (includeATag) {
        return str.replace(/<(?!\/?a(?=>|\s.*>))\/?.*?>/gi, '');
      }

      return str.replace(/<\/?[^>]+(>|$)/gi, '');
    }

    return '';
  },

  htmlEntities(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/[^\x20-\x7E]/gmi, ' ');
  },

  stripMessageBody(body) {
    if (!body) return;

    return sanitizeHtml(body, {
      allowedTags: ['br', 'a', 'p', 'ul', 'ol', 'li'],
      allowedAttributes: {
        a: ['href', 'target', 'data-id'],
      },
      allowedClasses: {
        a: ['at-mention', 'jumpable'],
      },
    });
  },

  replaceBrWithNewLine(str) {
    return str && str.replace(/<br\s*\/?>/gi, '\n');
  },

  getUrlRegex() {
    return /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@*#\/%?()=~_|!:,.;]*[-A-Z0*-9+&@#\/%()=~_|])/ig;
  },

  isUrl(str) {
    return SimpleSchema.RegEx.Url.test(str);
  },

  isImage(str) {
    const regex = /\.(jpg|jpeg|png|gif)$/i;
    return regex.test(str);
  },

  removeNeedlessAtwho($input) {
    if (Meteor.isClient && $input) {
      const id = `#atwho-ground-${$input.attr('id')}`;
      $(id).parent().remove();
    }
  },

  getPanelSettings(filter, workspace = FlowRouter.getParam('workspaceId')) {
    const userId = Meteor.userId();
    const userSettings = UserSettings.findOne(
      { userId, workspace },
      { fields: { [filter]: 1 } },
    );
    if (!userSettings) return false;
    return userSettings[filter];
  },

  getUserSettingField(field, workspace) {
    const userId = Meteor.userId();
    const userSettings = UserSettings.findOne({ userId, workspace }, { fields: { [field]: 1 } });
    if (!userSettings) return false;
    return userSettings[field];
  },

  // See whether a document and user share a workspace
  isMemberOfWorkspace(userId, workspaceId) {
    const workspace = Workspaces.findOne(workspaceId);
    return workspace && workspace.isMember(userId);
  },

  getUserNames({ users = [] }) {
    const namesArray = [];
    users.forEach((id) => {
      const user = Meteor.users.findOne(
        id,
        { fields: { 'profile.firstName': 1, 'profile.lastName': 1, emails: 1 } },
      );
      if (user) {
        if (user._id === Meteor.userId()) namesArray.push('You');
        else namesArray.push(user.fullName() || user.emailAddress());
      }
    });

    return namesArray;
  },

  getCleanDateFormat(d = new Date()) {
    return `${d.getDate()}_${d.getMonth()}_${d.getYear()}`;
  },
  getRelativeFormattedTime(inputDate = new Date()) {
    const now = new Date();
    const today = moment(new Date());
    const then = moment(inputDate);
    if (now.toDateString() === inputDate.toDateString()) {
      // Same date (day)
      return moment(inputDate).format('h:mm a');
    } else if (today.diff(then, 'days') < 7) {
      // Same week
      return moment(inputDate).format('ddd [at] h:mm a');
    }
    // Show full date
    return moment(inputDate).format('MMM D [at] h:mm a');
  },

  sortFilesAlpha(arr, direction = 'asc') {
    const dirMultipler = direction === 'asc' ? 1 : -1;

    return arr.sort((a, b) => {
      if (a.type < b.type) {
        return -1;
      }
      if (a.type > b.type) {
        return 1;
      }

      if (a.name.toLowerCase() < b.name.toLowerCase()) {
        return -1 * dirMultipler;
      }
      if (a.name.toLowerCase() > b.name.toLowerCase()) {
        return 1 * dirMultipler;
      }

      return 0;
    });
  },

  sortByString(property) {
    return (a, b) => this.sortNameAlpha(a[property], b[property]);
  },

  sortBytDate(property, recentDate = false) {
    return (a, b) => {
      const aValue = a[property] instanceof Date ? a[property].valueOf() : 0;
      const bValue = b[property] instanceof Date ? b[property].valueOf() : 0;
      if (recentDate) return bValue - aValue;
      return aValue - bValue;
    };
  },

  sortData(arr, attr, type = 'alpha', direction = 'asc') {
    return arr.sort((a, b) => {
      const isAlpha = type === 'alpha';
      const av = isAlpha ? a[attr].toLowerCase() : a[attr];
      const bv = isAlpha ? b[attr].toLowerCase() : b[attr];
      const order = direction === 'asc' ? 1 : -1;
      if (isAlpha) {
        return av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' }) * order;
      }

      return (av - bv) * order;
    });
  },

  /**
   * sort array of strings by multiple fields
   * Pass this function to data.sort(sortByMultipleFields(['name', '-country']))
   * fields @Array of fields to be sorted by '-country' indicates the sort direction desc
   */
  sortByMultipleFields(fields) {
    return (a, b) => fields.map((field) => {
      let dir = 1;
      if (field[0] === '-') {
        dir = -1;
        field = field.substring(1);
      }
      if (a[field].toLowerCase() > b[field].toLowerCase()) {
        return dir;
      }

      if (a[field].toLowerCase() < b[field].toLowerCase()) {
        return -(dir);
      }

      return 0;
    }).reduce((p, n) => {
      // if we are sorting by more than 1 field, we need to decide which field has more 'weight'
      // so this reducer returns the first non-zero value it encounters
      // e.g. the above map may return [0, 1] then this reduce will return 1
      if (p) return p;
      return n;
    }, 0);
  },

  sortNameAlpha(nameOne = '', nameTwo = '') {
    const lowerNameOne = nameOne.toLowerCase();
    const lowerNameTwo = nameTwo.toLowerCase();
    if (lowerNameOne < lowerNameTwo) {
      return -1;
    } else if (lowerNameOne > lowerNameTwo) {
      return 1;
    }
    return 0;
  },

  determineAttachmentType($element) {
    if ($element && typeof $element.hasClass === 'function') {
      if ($element.hasClass('google-drive')) {
        return 'google-drive';
      } else if ($element.hasClass('box')) {
        return 'box';
      } else if ($element.hasClass('dropbox')) {
        return 'dropbox';
      } else if ($element.hasClass('hive-drive')) {
        return 'hive-drive';
      } else if ($element.hasClass('note-thumb') || $element.hasClass('note-item')) {
        return 'note';
      }
    }
    return false;
  },

  matchPreviewConditions({ url }) {
    if (Meteor.isElectron && this.isImage(url) && Desktop.fs.existsSync(url)) {
      const MAX_PREVIEW_IMAGE_SIZE_MB = 10;
      const stats = Desktop.fs.statSync(url);
      return stats.isFile() && (stats.size / 1024000) < MAX_PREVIEW_IMAGE_SIZE_MB;
    }
    return false;
  },

  // Get users most recent group (not hidden)
  getMostRecentGroup(workspaceId) {
    const workspace = Workspaces.findOne({ _id: workspaceId }, { fields: { _id: 1 } });
    const mostRecent = (workspace && workspace.mostRecentGroup()) || {};

    return mostRecent._id;
  },

  scrollToGroup(groupId, containerSelector = '#dm-thumbs', complete = () => { }) {
    if ($(window).width() < 900) return;
    const $container = $(containerSelector);
    const $selectedGroup = $container.find(`#${groupId}`);
    if (!$selectedGroup.length) return;
    // scroll to top
    const gOffset = $selectedGroup.position();
    // get position of element in scroller
    const position = this.getElementPositionInScroller($selectedGroup, $container);
    if (position !== 0) {
      $container.animate({ scrollTop: $container.scrollTop() + gOffset.top }, { complete, duration: 200 });
    } else {
      complete();
    }
  },

  /**
   * @returns {number} returns integer representing position in scroller. [-1 if above, 0 if in view, 1 if below]
   */
  getElementPositionInScroller($element, $scroller) {
    // calculate center of element
    const gHeight = $element.outerHeight(true);
    const groupYPos = $element.position().top + (gHeight / 2);
    // if is above
    if (groupYPos < 0) return -1;
    // if is below
    if (groupYPos > $scroller.height()) return 1;
    // if in view
    return 0;
  },

  // Find the group which has the given members
  groupFromMembers(members, workspaceId) {
    let group = '';

    // Exclude the everyone group for special case of 2 members
    // First try to find a 1-2-1 group
    group = Groups.findOne({
      $and: [
        { members: { $all: members } },
        { members: { $size: members.length } },
        // {name: {$ne: 'Everyone'}},
        { everyoneGroup: { $ne: true } },
        { workspace: workspaceId },
        { name: { $exists: false } },
      ],
    }, { fields: { _id: 1 } });

    // If there's no 1-2-1 group, look for a created group
    if (!group) {
      group = Groups.findOne({
        $and: [
          { members: { $all: members } },
          { members: { $size: members.length } },
          // {name: {$ne: 'Everyone'}},
          { everyoneGroup: { $ne: true } },
          { workspace: workspaceId },
        ],
      }, { fields: { _id: 1 } });
    }

    return group && group._id;
  },

  profilePhoto(uid) {
    const userId = uid || Meteor.userId();
    const user = Meteor.users.findOne(userId, { fields: { bot: 1, photo: 1, 'profile.photo': 1 } });

    // If user not yet loaded, return blank image
    if (!user) return '/img/blank-profile.png';

    // If user.profile.photo is set and nothing else is found, use it
    if (user.profile && user.profile.photo) return user.profile.photo;

    // Show blank if no photo assigned
    return '/img/blank-profile.png';
  },

  // Get user photo for email
  getUserPhoto(userId) {
    const user = Meteor.users.findOne(userId, { fields: { photo: 1 } });
    return (user && user.photo) || 'https://s3.amazonaws.com/hv-static-content/blank-profile.png';
  },

  dropFileMessagePanel(id, targetGroup, senderName) {
    // if it is BOX then we go by id, other we go by _id
    let itemData = MyFiles.findOne({ $or: [{ _id: id }, { id }] });
    if (Meteor.isClient && !itemData) {
      itemData = GoogleDriveRecentFiles.findOne(id);
    }

    let itemId = id;
    let itemType = 'file';
    // No actual sharing operation is done if item is from Google Drive or Box
    if (itemData.fileStore === 'google') {
      itemType = 'google-drive';
    } else if (itemData.fileStore === 'box') {
      itemType = 'box';
      itemId = itemData.id;
    } else if (itemData.fileStore === 'dropbox') {
      itemType = 'dropbox';
      itemId = itemData.id;

      // if the file is publicly  we will insert it into mongo
      if (itemData.shared_link && itemData.shared_link.access === 'open') {
        // making sure we are using box original id
        itemData._id = itemData.id;
        Meteor.call('myFilesUpsert', itemData.id, itemData);
      }
    }

    // Send message informing share
    const newMessageObj = {
      containerType: 'group',
      containerId: targetGroup._id,
      body: `${senderName} has shared ${itemData.name}`,
      attachments: [{
        attachedItemType: itemType,
        attachedItemId: itemId,
      }],
      workspace: targetGroup.workspace,
    };

    Meteor.call('messages.insert', newMessageObj);
    // Complete onboarding milestone
    OnboardingListManager.completeItem('shareFile');
  },

  dropActionMessagePanel({ id, targetGroup, senderName, body = `${senderName} wants you to know about an action:`, scrollToBottom = () => { } }) {
    // Send message informing share
    const newMessageObj = {
      containerType: 'group',
      containerId: targetGroup._id,
      attachments: [{
        attachedItemType: 'action',
        attachedItemId: id,
      }],
      body,
      workspace: targetGroup.workspace,
    };

    insertMessage.call(newMessageObj);
    // Complete onboarding milestone
    OnboardingListManager.completeItem('shareAction');

    scrollToBottom();
  },

  shareFileAndSendMessage(fileId, groupId) {
    // Get group
    const group = Groups.findOne(groupId);

    if (group.members) {
      // Get sender name
      const user = Meteor.user();
      const senderName = user.getFirstName();

      // Create a message to notify users about the share
      const newMessageObj = {
        containerType: 'group',
        containerId: group._id,
        body: `${senderName} has shared a file`,
        attachments: [{
          attachedItemType: 'file',
          attachedItemId: fileId,
        }],
        workspace: group.workspace,
      };

      Meteor.call('messages.insert', newMessageObj);
      OnboardingListManager.completeItem('shareFile');
    }
  },
  parseRgba(rgbaString) {
    const [r, g, b, a] = rgbaString.match(/(\d\.\d|\d+)/g);
    return [+r, +g, +b, +a];
  },
  colorRgba(color = '#aaaaaa') {
    return color.includes('#') ? parseHex(color) : this.parseRgba(color);
  },
  // Return whether a color is light enough that it needs dark text
  // to maintain contrast
  colorIsLight(color = '#ffffff') {
    let r = 0;
    let g = 0;
    let b = 0;
    if (color.includes('#')) {
      [r, g, b] = parseHex(color);
    } else {
      [r, g, b] = this.parseRgba(color);
    }
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return yiq >= 208;
  },

  hex2rgba(color = '#aaaaaa', opacity = 100) {
    const [r, g, b] = parseHex(color);
    opacity /= 100;
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  },

  colorIndexToHex(index) {
    const colors = [
      // Pastel blue
      '#3498db',
      // Pastel yellow
      '#f1c40f',
      // Pastel green
      '#2ecc71',
      // Pastel red
      '#e74c3c',
      // Pastel orange
      '#e67e22',
      // Pastel turquoise
      '#1abc9c',
      // Pastel purple
      '#9b59b6',
      // Pastel black
      '#34495e',
      // Pastel dark green
      '#188546',
      // Pastel dark blue
      '#07558A',
      // Paste light orange
      '#F2C094',
      // Pastel light green
      '#A0FAC6',
      // Pastel lilac
      '#C0C5FC',
      // More
      '#fffafa',
      '#fff0f5',
      '#ffe4e1',
      '#2f4f4f',
      '#191970',
      '#9370db',
      '#da70d6',
      '#b03060',
      '#ff4500',
      '#ff7f50',
      '#eedd82',
      '#9acd32',
      '#556b2f',
      '#5f9ea0',
      '#00ced1',
    ];

    while (index >= colors.length) {
      index -= colors.length;
    }

    return colors[index];
  },

  getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return false;
  },

  setEndOfContenteditable(contentEditableElement) {
    let range;
    let selection;
    if (document.createRange) {
      range = document.createRange();
      range.selectNodeContents(contentEditableElement);
      range.collapse(false);
      selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    } else if (document.selection) {
      range = document.body.createTextRange();
      range.moveToElementText(contentEditableElement);
      range.collapse(false);
      range.select();
    }
  },
  spamNameRegex: /^[^;<>.\//\\/。点]*$/,
  // Email Regex is RFC 5322 Official Standard
  emailRegex: /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,

  getNestedKey(obj, key) {
    return key.split('.').reduce((o, x) => (typeof o === 'undefined' || o === null) ? o : o[x], obj);
  },
  getUtcOfsset(timezone, date) {
    if (date) {
      return moment.tz(date, timezone).utcOffset() / 60;
    }

    return moment.tz(timezone).utcOffset() / 60;
  },
  openUrlSafe(url, newTab = true) {
    if (Meteor.isCordova) {
      window.open(url, '_system', 'location=yes');
    } else if (Meteor.isElectron) {
      Desktop.shell.openExternal(url);
    } else if (newTab) {
      window.open(url, '_blank');
    } else {
      window.location = url;
    }
  },
  getDefaultProjectColours() {
    return [
      '#3390dc',
      '#3fcaca',
      '#42c299',
      '#5a77c7',
      '#986EAD',
      '#B4A3DE',
      '#C54C82',
      '#D2465F',
      '#F6799A',
      '#F98064',
      '#FDC76D',
    ];
  },
  isOrgAdmin(workspaceId = FlowRouter.getParam('workspaceId'), userId = Meteor.userId()) {
    return Organizations.find({ workspaces: workspaceId, admin: userId }, { fields: { admin: 1, workspaces: 1 } }).count() > 0;
  },

  isWorkspaceAdmin(workspaceId = FlowRouter.getParam('workspaceId'), userId = Meteor.userId()) {
    const workspace = Workspaces.findOne(workspaceId, { fields: { members: 1, createdBy: 1 } });
    return workspace.getWorkspaceAdmins().includes(userId);
  },
  getOrganizationAdminIds(workspace) {
    const workspaceId = workspace || FlowRouter.getParam('workspaceId');
    const organization = Organizations.findOne({ workspaces: workspaceId }, { fields: { admin: 1 } }) || {};

    return organization.admin || [];
  },

  canInvite() {
    const userId = Meteor.userId();
    if (!userId) return false;

    const workspaceId = FlowRouter.getParam('workspaceId');

    const workspace = Workspaces.findOne(
      workspaceId,
      { fields: { allowManageUsers: 1, externalMembers: 1 } },
    );

    // external users cannot invite new users
    if (workspace && workspace.isExternalUser(userId)) {
      return false;
    }

    const org = Organizations.findOne(
      { workspaces: workspaceId, admin: userId },
      { fields: { _id: 1 } },
    );

    return org || (workspace && workspace.allowManageUsers);
  },

  getEmailsFromStr(str = '') {
    const emailRegex = /(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))/g;
    return str.match(emailRegex) || [];
  },
  stringToCamelCase(str = '') {
    return str.trim()
      .replace(/[^A-Za-z]/g, ' ')
      .replace(/(.)/g, (a, l) => l.toLowerCase())
      .replace(/(\s.)/g, (a, l) => l.toUpperCase())
      .replace(/[^A-Za-z\u00C0-\u00ff]/g, '');
  },
  riskExtensions() {
    return [
      // High-Risk File Extensions
      'ACTION', 'APK', 'APP', 'BAT', 'BIN', 'CMD', 'COM', 'COMMAND', 'CPL', 'CSH', 'EXE', 'GADGET', 'INF', 'INS', 'INX',
      'IPA', 'ISU', 'JOB', 'JSE', 'KSH', 'LNK', 'MSC', 'MSI', 'MSP', 'MST', 'OSX', 'OUT', 'PAF', 'PIF', 'PRG',
      'PS1', 'REG', 'RGS', 'RUN', 'SCR', 'SCT', 'SHB', 'SHS', 'U3P', 'VB', 'VBE', 'VBS', 'VBSCRIPT', 'WORKFLOW',
      'WS', 'WSF', 'WSH',
      // Other Executable File Extensions
      '0XE', '73K', '89K', 'A6P', 'AC', 'ACC', 'ACR', 'ACTM', 'AHK', 'AIR', 'APP', 'ARSCRIPT', 'AS', 'ASB', 'AWK',
      'AZW2', 'BEAM', 'BTM', 'CEL', 'CELX', 'CHM', 'COF', 'CRT', 'DEK', 'DLD', 'DMC', 'DOCM', 'DOTM', 'DXL', 'EAR',
      'EBM', 'EBS', 'EBS2', 'ECF', 'EHAM', 'ELF', 'ES', 'EX4', 'EXOPC', 'EZS', 'FAS', 'FKY', 'FPI', 'FRS', 'FXP',
      'GS', 'HAM', 'HMS', 'HPF', 'HTA', 'IIM', 'IPF', 'ISP', 'JAR', 'JS', 'JSX', 'LO', 'LS', 'MAM', 'MCR', 'MEL',
      'MPX', 'MRC', 'MS', 'MXE', 'NEXE', 'OBS', 'ORE', 'OTM', 'PEX', 'PLX', 'POTM', 'PPAM', 'PPSM', 'PPTM', 'PRC',
      'PVD', 'PWC', 'PYC', 'PYO', 'QPX', 'RBX', 'ROX', 'RPJ', 'S2A', 'SBS', 'SCA', 'SCAR', 'SCB', 'SCRIPT', 'SMM',
      'SPR', 'TCP', 'THM', 'TLB', 'TMS', 'UDF', 'UPX', 'URL', 'VLX', 'WCM', 'WIDGET', 'WIZ', 'WPK', 'WPM', 'XAP',
      'XBAP', 'XLAM', 'XLM', 'XLSM', 'XLTM', 'XQT', 'XYS', 'ZL9',
    ];
  },
  isVanguardAgent(userId = Meteor.userId()) {
    // Vanguard only workspace - 'agent' roles can't update statuses
    const workspaceId = FlowRouter.getParam('workspaceId');
    const isAgent = Roles.userIsInRole(userId, 'agent');
    const isVanguard = VANGUARD === workspaceId;
    return isAgent && isVanguard;
  },
  isAgent(userId = Meteor.userId()) {
    // Vanguard only workspace - 'agent' roles can't update statuses
    const workspaceId = FlowRouter.getParam('workspaceId');
    const isAgent = Roles.userIsInRole(userId, 'agent');
    const isVanguard = [VANGUARD, ENLIVANT].indexOf(workspaceId) > -1;
    return isAgent && isVanguard;
  },
  getVanguardAgents() {
    const exclude = [];
    const workspace = FlowRouter.getParam('workspaceId');
    if (workspace === VANGUARD) {
      AgentList.get().forEach(u => exclude.push(u));
    }
    return exclude;
  },

  isUrlProtocol(str) {
    // const allProtocols = /^[^:]+(?=:\/\/)/i;
    const urlProtocols = /^(?:(ht|f)tp(s?)\:\/\/)?/i;
    return !!str.match(urlProtocols)[0];
  },
  isRoleAdmin() {
    const userId = Meteor.userId();
    return Roles.userIsInRole(userId, ['admin']);
  },
  isCurrentWorkspace(workspaceId) {
    return FlowRouter.getParam('workspaceId') === workspaceId;
  },
  replaceToList(source) {
    const titles = source.split('\n').filter(t => t).join('\n');
    return titles.replace(/^([\s\w\d\r\n]+[.)]|[-•·üvØ§])\s+/gim, '');
  },
  trimInnerTextOnPaste({ currentTarget }) {
    // Waiting for paste complete
    setTimeout(() => {
      currentTarget.innerText = this.replaceToList(currentTarget.innerText);
      this.setEndOfContenteditable(currentTarget);
    }, 0);
  },
  hasUnreadFeeds(containerId) {
    return !!ActivityFeeds.find(
      { containerId, isRead: false, assignedTo: Meteor.userId() },
      { fields: { _id: 1 } },
    ).count();
  },
  string2ArrayBuffer(string) {
    const buffer = new ArrayBuffer(string.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i !== string.length; ++i) {
      view[i] = string.charCodeAt(i) & 0xFF; // eslint-disable-line
    }
    return buffer;
  },
  convert2file(file) {
    return new Blob([this.string2ArrayBuffer(file)], { type: 'application/octet-stream' });
  },
  getWorkspaceFeature(field, workspaceId = FlowRouter.getParam('workspaceId')) {
    // TODO Temporary allows messaging for mobile
    if (field === 'messaging' && this.isMobile()) {
      return true;
    }
    const [workspace = {}] = Workspaces.find(
      workspaceId,
      { fields: { [`features.${field}`]: 1 } },
    ).fetch();
    const features = workspace.features || { [field]: false };
    return features[field];
  },

  /**
   * getColorByLabelsList
   *
   * Returns hex color by item labels. Uses first label color as base color
   * @param {array} labels - list of labels
   * @return {string}
   */
  getColorByLabelsList(labels = [], DEFAULT_ITEM_COLOR = '#eeeeee') {
    const firstLabel = getFirstLabel(labels);

    // returns default color if a label isn't selected
    if (!firstLabel) {
      return DEFAULT_ITEM_COLOR;
    }

    const label = Labels.findOne({ _id: firstLabel }, { fields: { labelHex: 1, color: 1 } });

    if (label) {
      return label.labelHex || this.colorIndexToHex(label.color);
    }
    return DEFAULT_ITEM_COLOR;
  },

  noneToLabels(labels) {
    if (!labels || !labels.length) return [];

    let newList = labels;
    const noneVal = 'none';
    const noneIndex = newList.indexOf(noneVal);

    if (noneIndex === 0) {
      return newList;
    }

    if (noneIndex > 0) {
      newList = newList.slice(noneIndex, noneIndex + 1);
    }

    return [noneVal].concat(newList);
  },

  /**
   * Captures data to send to sentry - you would use this if you will be throwing an error immediately after
   * @param {object} data - extra data to send to sentry
   */
  captureData(data) {
    if (Meteor.isClient) {
      // on client just use setExtraContext so we don't overrite user context
      Raven.setExtraContext(data);
    } else {
      // on server use mergeContext since setExtraContext does not exist for serverside Raven
      Raven.mergeContext({ extra: data });
    }
  },

  /**
   * Reports error to Sentry
   * @param {Error} err - error being reported
   * @param {object} extra - data that will be passed along with this error to sentry
   */
  captureException(err, extra = {}) {
    if (err) {

      // add name to extra which allows us to fingerprint this error
      if (err.message) {
        extra.name = err.message;
      }

      // log to papertrail
      console.log('Sentry capture exception', err);
      Raven.captureException(err, { extra });
    }
  },

  /**
   * Captures breadcrumbs for the callback being executed
   * @param {string} message - breadcrumb message
   * @param {Object} data - breadcrumb data
   * @param {function} callback - function to apply the breadcrumbs to
   */
  captureBreadcrumbs(message, data, callback) {
    Raven.context(() => {
      // create breadcrumb
      const breadcrumb = { message };
      // add data to breadcrumb if it exists
      if (data) breadcrumb.data = data;
      // send breadcrumb to raven
      Raven.captureBreadcrumb(breadcrumb);
      // callback if it exists
      if (callback) callback();
    });
  },
  checkVideoExt(type) {
    return (/(webm|mp4|mov)$/i).test(type);
  },
  checkImageExt(type) {
    return (/(gif|jpg|jpeg|tiff|png)$/i).test(type);
  },
  checkVideoSupport(format) {
    const replace = {
      mov: 'mp4',
    };
    const ext = replace[format] || format;
    const videoEl = document.createElement('video');
    const notSupport = '';
    return videoEl.canPlayType && notSupport !== (videoEl.canPlayType(`video/${ext}`));
  },
  getDayOfMonthForRecurring(day, startMonthDate) {
    // get the date and year
    const monthYearString = startMonthDate.format('MM-YYYY');
    const lastDayString = startMonthDate.format('Do');
    let dayString = day;

    if (dayString === 'last') {
      dayString = lastDayString;
    }

    const dateString = `${dayString}-${monthYearString}`;
    return moment(dateString, 'Do-MM-YYYY').startOf('day');
  },
  // TODO: Should optimize this using moment() instead of using "for" cycles
  getFirstOccurance(recurringObj) {
    const { type, days, startDate, endDate, interval } = recurringObj;
    if (type !== 'never') {
      if (type === 'weekly') {
        for (let date = moment(startDate); date.isBefore(endDate); date.add(1, 'days')) {
          if (days.indexOf(date.format('ddd')) > -1) {
            return date.toDate();
          }
        }
      } else {
        let i = 0;
        const startMonthDate = moment(startDate);
        if (startMonthDate.isAfter(this.getDayOfMonthForRecurring(days[0], startMonthDate))) {
          startMonthDate.add(1, 'months');
        }
        for (; startMonthDate.isSameOrBefore(endDate); startMonthDate.add(1, 'months')) {
          // consider the interval - hit or miss
          if (i % interval === 0) {
            const date = this.getDayOfMonthForRecurring(days[0], startMonthDate);
            // if the date is in the past then ignore it
            if (date.isBefore(moment())) continue; // eslint-disable-line
            return date.toDate();
          }
          i++;
        }
      }
    }
  },
  // getExtensionByFileName :: String -> String
  getExtensionByFileName: R.compose(R.toLower, R.last, R.split('.')),

  /**
   * Captures message to send to sentry
   * @param {string} message - message to send to sentry
   * @param {string} level - level sentry will log this messsage at. ('info', 'warning', 'error')
   * @param {object} data - data that will be passed along with this message to sentry
   */
  captureMessage(message, level = 'error', data = {}) {
    // log to papertrail
    console.log('Sentry capture message called:', message);
    Raven.captureMessage(message, { level, extra: data });
  },
  initializePnotifyEvents(notification, onClick) {
    // Handle close notification click event
    notification.get(0).find('.ui-pnotify-closer').click((event) => {
      event.stopPropagation();
    });
    // Handle notification click event
    notification.get(0).click(onClick);
  },

  momentToDate(momentDate, defaultValue = null) {
    return momentDate ? momentDate.toDate() : defaultValue;
  },

  dateToMoment(date, defaultValue = null) {
    return date ? moment(date) : defaultValue;
  },

  autolink(input) {
    const className = 'autolink';
    return Autolinker.link(input, {
      urls: {
        schemeMatches: true,
        wwwMatches: true,
        tldMatches: false,
      },
      email: true,
      newWindow: true,
      className,
      stripPrefix: false,
      stripTrailingSlash: true,
      phone: this.isMobile(),
      // bug in autolinker doesn't ignore phone #
      // so we are replacing the funcation and matching only urls
      replaceFn(match) {
        if (match.getType() === 'email') {
          const email = match.getEmail();
          return `<a href="mailto:${email}" class="${className}">${email}</a>`;
        }
      },
    });
  },

  hasService(user, service) {
    return _.get(user, `services.${service}`);
  },
  getProjectMembers(projectId, includeSelf = true) {
    const project = Projects.findOne(projectId, { fields: { userId: 1, sharingType: 1, members: 1, workspace: 1 } });
    let members = project ? project.getUsersList({ includeUnassigned: false }) : [];

    if (!includeSelf) {
      const userId = Meteor.userId();
      members = _.without(members, userId);
    }

    return members;
  },
  groupReactions(reactions) {
    if (!reactions) return false;
    const gr = {};
    reactions.forEach(r => {
      if (r.emoji in gr) {
        gr[r.emoji].users.push(r.userId);
      } else {
        gr[r.emoji] = {
          emoji: r.emoji,
          users: [r.userId],
        };
      }
    });

    return gr;
  },
  searchBy(search, field = 'name') {
    return item => item[field].toLowerCase().includes(search.toLowerCase());
  },
  retryHttpCall(method, url, options, callback = () => { }) {
    // eslint-disable-next-line prefer-const
    let { retries = 5, timeout = 5000 } = options;
    const error5xx = R.compose(
      R.startsWith('5'),
      R.toString,
      R.propOr('', 'error'),
    );
    const opts = R.omit(['retries', 'timeout'], options);
    do {
      try {
        HTTP.call(method, url, opts, callback);
        break;
      } catch (err) {
        callback(err);
        if (!error5xx(err)) {
          break;
        }
        Meteor._sleepForMs(timeout);
        retries--;
      }
    } while (retries > 0);
  },

  /**
   * @param document {{ createdBy, workspace }} - Collection document
   * @param currentUserId {string} - user ID to check
   * @return {boolean} Permission state
   */
  hasPermissions(document = {}, currentUserId = Meteor.userId()) {
    if (!document.createdBy || !currentUserId) {
      return false;
    }
    if (document.createdBy === currentUserId) {
      return true
    }

    const workspaceDocument = Workspaces.findOne({ _id: document.workspace }, { fields: { members: 1, createdBy: 1 } });
    return workspaceDocument && workspaceDocument.getWorkspaceAdmins().includes(currentUserId);
  },
  isLargeWorkspace(_id) {
    return Workspaces.find(
      { _id, 'members.50': { $exists: true } },
      { fields: { members: 1 } }).count() > 0;
  },
  formatAtwhoForNewsAndComents(body) {
    body = body.replace(/(<a class="at-mention.*?<\/a>)/gm, (res, $1) => (
      `<span class="atwho-inserted" data-atwho-at-query="@">${$1}</span>&zwj;`
    ));
    return body;
  },

  blurDropDownFocus() {
    const $activeElement = $(document.activeElement);
    if ($activeElement.hasClass('dropdown-toggle')) {
      $activeElement.blur();
    }
  },

  getProjectIdIfUserHasPermission(workspaceId, assignee) {
    const wsp = Workspaces.findOne(workspaceId, { fields: { externalMembers: 1 } });
    const hasPermission = wsp.hasPermissions(assignee, [HivePermissions.action.project]);
    if (!hasPermission) {
      return wsp.getExternalUserProjectId(assignee);
    }
  },
  /**
   * Return promise with file if it's not directory
   * If it's directory return pending promise
   *
   * @param file
   */
  notDirectory(file) {
    return new Promise(resolve => {
      if (file.type) {
        resolve(file);
      }
      const reader = new FileReader();

      // Can read files, but not directories.
      reader.onprogress = (event) => {
        if (event.type === 'progress') {
          resolve(file);
          reader.abort();
        }
      };
      // error in case of directory
      reader.onerror = () => {
        resolve(null);
      }
      // Wait for result.
      reader.readAsDataURL(file);
    });
  },
  /**
   *
   * @param cases represent as object, like { case1: 1, case2: 2, case3: 3 }
   * @param defaultCase it's default value that will be returned if there is not any match at 'cases' param
   * @returns {function(*=): *} // return function that accept 'key' as params and if call return value according to @cases param
   */
  switchcase: ({ cases, defaultCase }) => key =>
    R.prop(key, cases) ? cases[key] : defaultCase,

  getSortOptions(sortType) {
    const switchParams = {
      cases: {
        rank: { urgent: -1, rank: 1 },
        date: { urgent: -1, hasDeadline: -1, deadline: 1, rank: 1 },
        deadline: { urgent: -1, hasDeadline: -1, deadline: 1, rank: 1 },
        modifiedAt: { modifiedAt: -1 },
        checkedDate: { checkedDate: -1, rank: 1 },
      },
      defaultCase: { urgent: -1, rank: 1 },
    }
    const switchBySortType = this.switchcase(switchParams);

    return switchBySortType(sortType);
  },

  getWorkspaceLabels({ workspace, options = {}}) {
    const workspaceLabels = {};
    Labels.find({ workspace }, options).forEach(label => {
      workspaceLabels[label._id] = label
    });
    return workspaceLabels;
  }
};
